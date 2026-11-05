// Parser e validação de arquivos de importação de participantes (CSV / XLSX).
// Sem dependências externas: XLSX é lido via zip local + DecompressionStream +
// DOMParser sobre o worksheet XML (aceita sharedStrings e inlineStr).
// O fluxo de importação em lote (dedupe, progresso, relatório) vive em useImportacaoCsv.

export interface LinhaArquivo {
  nome: string
  email: string
  linha: number
}

export interface ResultadoParse {
  linhas: LinhaArquivo[]
  total: number
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function emailValido(v: string): boolean {
  return EMAIL_RE.test(v.trim())
}

function normalizeKey(k: string): string {
  return k
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '')
}

function isNomeKey(k: string): boolean {
  return ['nome', 'name', 'nomes', 'nomecompleto', 'participante', 'aluno', 'pessoa'].includes(
    normalizeKey(k),
  )
}

function isEmailKey(k: string): boolean {
  return ['email', 'eemail', 'e_mail', 'email1', 'emails', 'emailprincipal'].includes(
    normalizeKey(k),
  )
}

/** Detecta qual coluna é NOME e qual é EMAIL nos cabeçalhos (aceita maiúsculas/minúsculas e variações). */
export function mapearColunas(cabecalhos: string[]): { nome: number; email: number } | null {
  let nome = -1
  let email = -1
  for (let i = 0; i < cabecalhos.length; i++) {
    const k = normalizeKey(cabecalhos[i])
    if (isEmailKey(k) && email === -1) email = i
    if (isNomeKey(k) && nome === -1) nome = i
  }
  if (nome === -1 && email === -1) return null
  if (nome === -1) nome = 0
  if (email === -1) email = cabecalhos.length > 1 ? 1 : -1
  if (nome === -1 || email === -1) return null
  return { nome, email }
}

interface ZipEntry {
  name: string
  dataStart: number
  compSize: number
  method: number
}

/** Varre o central directory do ZIP localizando os arquivos internos do XLSX. */
function zipEntries(bytes: Uint8Array): ZipEntry[] {
  // End of central directory (PK\x05\x06), buscado de trás para frente
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (
      bytes[i] !== 0x50 ||
      bytes[i + 1] !== 0x4b ||
      bytes[i + 2] !== 0x05 ||
      bytes[i + 3] !== 0x06
    ) {
      continue
    }
    const dv = new DataView(bytes.buffer, bytes.byteOffset + i)
    const cdSize = dv.getUint32(12, true)
    const cdOffset = dv.getUint32(16, true)
    const entries: ZipEntry[] = []
    let p = cdOffset
    const cdEnd = Math.min(cdOffset + cdSize, bytes.length)
    while (p + 46 <= cdEnd) {
      const d = new DataView(bytes.buffer, bytes.byteOffset + p)
      if (d.getUint32(0, true) !== 0x02014b50) break
      const method = d.getUint16(10, true)
      const compSize = d.getUint32(20, true)
      const nameLen = d.getUint16(28, true)
      const extraLen = d.getUint16(30, true)
      const commentLen = d.getUint16(32, true)
      const localOffset = d.getUint32(42, true)
      const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen))
      // dados começam após o local file header de 30 bytes + nome + extra
      const ldv = new DataView(bytes.buffer, bytes.byteOffset + localOffset)
      const lNameLen = ldv.getUint16(26, true)
      const lExtraLen = ldv.getUint16(28, true)
      entries.push({
        name,
        dataStart: localOffset + 30 + lNameLen + lExtraLen,
        compSize,
        method,
      })
      p += 46 + nameLen + extraLen + commentLen
    }
    return entries
  }
  return []
}

async function inflateRaw(bytes: Uint8Array, e: ZipEntry): Promise<string> {
  const raw = bytes.subarray(e.dataStart, e.dataStart + e.compSize)
  if (e.method === 0) return new TextDecoder().decode(raw)
  const ds = new DecompressionStream('deflate-raw')
  const stream = new Blob([raw as BlobPart]).stream().pipeThrough(ds)
  const buf = await new Response(stream).arrayBuffer()
  return new TextDecoder().decode(buf)
}

async function readZipText(bytes: Uint8Array, name: string): Promise<string | null> {
  const e = zipEntries(bytes).find((x) => x.name === name)
  if (!e) return null
  return inflateRaw(bytes, e)
}

/** Lê a primeira planilha de um arquivo XLSX e devolve as linhas NOME/EMAIL. */
export async function parseXlsx(arrayBuffer: ArrayBuffer): Promise<ResultadoParse> {
  const bytes = new Uint8Array(arrayBuffer)

  const sharedXml = await readZipText(bytes, 'xl/sharedStrings.xml')
  const shared: string[] = []
  if (sharedXml) {
    const doc = new DOMParser().parseFromString(sharedXml, 'text/xml')
    const items = doc.getElementsByTagName('si')
    for (let i = 0; i < items.length; i++) {
      const texts = items[i].getElementsByTagName('t')
      let s = ''
      for (let j = 0; j < texts.length; j++) s += texts[j].textContent || ''
      shared.push(s)
    }
  }

  let sheetXml = await readZipText(bytes, 'xl/worksheets/sheet1.xml')
  if (!sheetXml) {
    // workbook sem sheet1: pega a primeira planilha que existir
    const candidates = zipEntries(bytes)
      .filter((x) => x.name.startsWith('xl/worksheets/sheet') && x.name.endsWith('.xml'))
      .sort((a, b) => a.name.localeCompare(b.name))
    if (candidates.length > 0) {
      sheetXml = await readZipText(bytes, candidates[0].name)
    }
  }
  if (!sheetXml) throw new Error('Planilha principal não encontrada no arquivo XLSX.')

  const doc = new DOMParser().parseFromString(sheetXml, 'text/xml')
  const rows = doc.getElementsByTagName('row')

  const linhas: LinhaArquivo[] = []
  let cols: { nome: number; email: number } | null = null
  let rowIdx = 0

  for (let r = 0; r < rows.length; r++) {
    rowIdx++
    const cells = rows[r].getElementsByTagName('c')
    const vals: string[] = []
    for (let c = 0; c < cells.length; c++) {
      const cell = cells[c]
      const type = cell.getAttribute('t')
      let text = ''
      if (type === 's') {
        const v = cell.getElementsByTagName('v')[0]
        text = shared[Number(v?.textContent || '0')] ?? ''
      } else if (type === 'inlineStr') {
        const ts = cell.getElementsByTagName('t')
        for (let j = 0; j < ts.length; j++) text += ts[j].textContent || ''
      } else {
        const v = cell.getElementsByTagName('v')[0]
        text = v?.textContent || ''
      }
      vals[c] = text
    }

    if (!cols) {
      // primeira linha com conteúdo: tenta reconhecer cabeçalho NOME/EMAIL
      const found = mapearColunas(vals)
      if (found) {
        cols = found
        continue
      }
      // sem cabeçalho reconhecido: colunas fixas 0 = nome, 1 = email
      cols = { nome: 0, email: 1 }
    }

    const nome = (vals[cols.nome] || '').trim()
    const email = (vals[cols.email] || '').trim()
    if (!nome && !email) continue
    linhas.push({ nome, email, linha: rowIdx })
  }

  return { linhas, total: rowIdx }
}

/** Lê um arquivo de texto (CSV/TSV) — aceita ; , ou tab, e cabeçalhos NOME/EMAIL. */
export function parseCsv(text: string): ResultadoParse {
  const linhas: LinhaArquivo[] = []
  const allLines = text.replace(/\r\n?/g, '\n').split('\n')
  let cols: { nome: number; email: number } | null = null
  let rowIdx = 0

  for (const raw of allLines) {
    const clean = raw.trim()
    if (!clean) continue
    rowIdx++
    const delim = clean.includes(';') ? ';' : clean.includes('\t') ? '\t' : ','
    const cells = clean.split(delim).map((c) => c.trim().replace(/^"(.*)"$/, '$1'))

    if (!cols) {
      const found = mapearColunas(cells)
      if (found) {
        cols = found
        continue
      }
      cols = { nome: 0, email: 1 }
    }

    const nome = (cells[cols.nome] || '').trim()
    const email = (cells[cols.email] || '').trim()
    if (!nome && !email) continue
    linhas.push({ nome, email, linha: rowIdx })
  }

  return { linhas, total: rowIdx }
}
