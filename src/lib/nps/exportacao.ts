// Exportações do dashboard: CSV nativo (sem dependências) e PDF (jsPDF, ~380 KB).
// Regra inegociável: respostas anônimas NUNCA mostram nome/e-mail em nenhuma exportação.
import { calcularNps, formulaNps, rotuloContato } from './calculos'
import type { Campaign, SurveyResponse } from '@/types/nps'

// ---------- CSV ----------

function esc(valor: string | number | boolean): string {
  const s = String(valor ?? '')
  // Aspas duplas, separador e quebras de linha são escapados.
  return `"${s.replace(/"/g, '""')}"`
}

function baixar(nome: string, conteudo: BlobPart, tipo: string): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function baixarCsv(
  nome: string,
  cabecalho: string[],
  linhas: (string | number | boolean)[][],
): void {
  const csv = [cabecalho, ...linhas].map((l) => l.map(esc).join(';')).join('\r\n')
  // BOM para o Excel abrir acentuação correta
  baixar(nome, '\uFEFF' + csv, 'text/csv;charset=utf-8')
}

export function fmtDataHora(iso: string): string {
  if (!iso) return ''
  return iso.slice(0, 16).replace('T', ' ')
}

// ---------- Relatório da campanha (CSV) ----------

export function exportarRelatorioCsv(
  campanha: Campaign,
  respostas: SurveyResponse[],
  periodo: { de: string; ate: string },
  detratoresTratados: number,
): void {
  const d = calcularNps(respostas)
  const linhas: (string | number | boolean)[][] = []

  linhas.push(['Relatório NPS — Fundatec'])
  linhas.push(['Campanha', campanha.nome])
  linhas.push(['Área', campanha.area_nome || campanha.expand?.area_id?.nome || ''])
  linhas.push(['Pergunta NPS', campanha.pergunta_nps])
  linhas.push(['Período', `${periodo.de} a ${periodo.ate}`])
  linhas.push(['Gerado em', fmtDataHora(new Date().toISOString())])
  linhas.push([])

  linhas.push(['KPIs do período'])
  linhas.push(['Respostas no período', d.total])
  linhas.push(['Promotores (9–10)', d.promotores])
  linhas.push(['Neutros (7–8)', d.neutros])
  linhas.push(['Detratores (0–6)', d.detratores])
  linhas.push(['% Promotores', d.pctPromotores])
  linhas.push(['% Neutros', d.pctNeutros])
  linhas.push(['% Detratores', d.pctDetratores])
  linhas.push(['NPS do período', d.nps ?? '—'])
  linhas.push(['Fórmula', formulaNps(d)])
  linhas.push(['Detratores tratados', detratoresTratados])
  linhas.push([])

  linhas.push(['Distribuição de notas'])
  linhas.push(['Nota', 'Respostas', '%'])
  d.counts.forEach((c, nota) => linhas.push([nota, c, d.pct[nota]]))
  linhas.push([])

  linhas.push(['Respostas do período'])
  linhas.push([
    'Data',
    'Respondente',
    'Nota',
    'Classificação',
    'Justificativa (detrator)',
    'Comentário',
  ])
  for (const r of respostas) {
    linhas.push([
      fmtDataHora(r.created),
      rotuloContato(r), // 'Anônimo' quando anônima — sem nome/e-mail
      r.nota,
      r.classificacao,
      r.justificativa_detrator || '',
      r.comentario || '',
    ])
  }
  linhas.push([])

  linhas.push(['Detratores (0–6) e tratativa'])
  linhas.push([
    'Data',
    'Respondente',
    'Nota',
    'Justificativa',
    'Comentário',
    'Tratado',
    'Nota interna',
  ])
  for (const r of respostas.filter((x) => x.nota <= 6)) {
    linhas.push([
      fmtDataHora(r.created),
      rotuloContato(r),
      r.nota,
      r.justificativa_detrator || '',
      r.comentario || '',
      r.tratado ? 'Sim' : 'Não',
      r.nota_interna || '',
    ])
  }

  const slug = campanha.slug || 'campanha'
  baixarCsv(`relatorio-nps-${slug}-${periodo.de}-${periodo.ate}.csv`, [], linhas)
}

// ---------- Relatório da campanha (PDF, jsPDF) ----------

const AZUL = [7, 89, 133] as const // sky-800 aproximado
const CINZA = [100, 116, 139] as const // slate-500

export async function exportarRelatorioPdf(
  campanha: Campaign,
  respostas: SurveyResponse[],
  periodo: { de: string; ate: string },
  detratoresTratados: number,
): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const larguraPag = doc.internal.pageSize.getWidth()
  const alturaPag = doc.internal.pageSize.getHeight()
  const margem = 40
  const larguraUtil = larguraPag - margem * 2
  const d = calcularNps(respostas)
  let y = margem

  const texto = (s: string, size = 10, cor: number[] = [30, 41, 59], negrito = false): void => {
    if (y > alturaPag - 60) {
      doc.addPage()
      y = margem
    }
    doc.setFont('helvetica', negrito ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.setTextColor(cor[0], cor[1], cor[2])
    const linhasTxt = doc.splitTextToSize(s, larguraUtil)
    for (const l of linhasTxt) {
      doc.text(l, margem, y)
      y += size * 1.35
    }
  }

  const pular = (n = 8): void => {
    y += n
  }

  // Cabeçalho
  doc.setFillColor(AZUL[0], AZUL[1], AZUL[2])
  doc.rect(0, 0, larguraPag, 64, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Fundatec — Relatório NPS', margem, 30)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Pesquisa de Satisfação', margem, 46)
  y = 92

  doc.setTextColor(30, 41, 59)
  texto(`Campanha: ${campanha.nome}`, 13, [15, 23, 42], true)
  texto(
    `Área: ${campanha.area_nome || campanha.expand?.area_id?.nome || '—'}   ·   Período: ${periodo.de} a ${periodo.ate}`,
    10,
    CINZA,
  )
  texto(`Pergunta NPS: ${campanha.pergunta_nps}`, 10, CINZA)
  pular(6)

  texto('KPIs do período', 11, [15, 23, 42], true)
  texto(
    `Respostas no período: ${d.total}    ·    Promotores (9–10): ${d.promotores} (${d.pctPromotores}%)    ·    Neutros (7–8): ${d.neutros} (${d.pctNeutros}%)    ·    Detratores (0–6): ${d.detratores} (${d.pctDetratores}%)`,
  )
  texto(`NPS do período: ${d.nps ?? '—'}    ·    Fórmula: ${formulaNps(d)}`)
  texto(`Detratores tratados: ${detratoresTratados}`)
  pular(8)

  // Distribuição de notas
  texto('Distribuição de notas (0–10)', 11, [15, 23, 42], true)
  pular(4)
  const maxCount = Math.max(1, ...d.counts)
  const alturaBarra = 42
  const larguraBarra = Math.min(30, larguraUtil / 14)
  for (let nota = 0; nota <= 10; nota++) {
    const x = margem + nota * (larguraBarra + 4)
    const h = Math.round((d.counts[nota] / maxCount) * alturaBarra)
    const cor: number[] = nota <= 6 ? [225, 29, 72] : nota <= 8 ? [245, 158, 11] : [5, 150, 105]
    doc.setFillColor(cor[0], cor[1], cor[2])
    doc.rect(x, y + (alturaBarra - h), larguraBarra, Math.max(h, 1), 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(100, 116, 139)
    doc.text(String(nota), x + larguraBarra / 2, y + alturaBarra + 10, { align: 'center' })
    doc.text(String(d.counts[nota]), x + larguraBarra / 2, y + alturaBarra + 20, {
      align: 'center',
    })
  }
  y += alturaBarra + 34
  pular(6)

  // Respostas do período (anonimato preservado)
  texto('Respostas do período', 11, [15, 23, 42], true)
  pular(2)
  const linhasResp: (string | number)[][] = respostas.map((r) => [
    fmtDataHora(r.created),
    rotuloContato(r),
    r.nota,
    r.classificacao,
  ])
  if (linhasResp.length === 0) texto('Sem respostas no período.', 9, CINZA)
  else {
    autoTabela(
      doc,
      ['Data', 'Respondente', 'Nota', 'Classificação'],
      linhasResp,
      larguraUtil,
      margem,
      () => (y = margem + 40),
    )
    y += 10
  }

  // Detratores e tratativa
  if (y > alturaPag - 120) {
    doc.addPage()
    y = margem
  }
  texto('Detratores (0–6) e tratativa', 11, [15, 23, 42], true)
  pular(2)
  const det = respostas.filter((r) => r.nota <= 6)
  const linhasDet: string[][] = det.map((r) => [
    fmtDataHora(r.created),
    rotuloContato(r),
    String(r.nota),
    (r.justificativa_detrator || '—').slice(0, 140),
    (r.comentario || '—').slice(0, 140),
    r.tratado ? 'Sim' : 'Não',
  ])
  if (linhasDet.length === 0) texto('Sem detratores no período.', 9, CINZA)
  else
    autoTabela(
      doc,
      ['Data', 'Respondente', 'Nota', 'Justificativa', 'Comentário', 'Tratado'],
      linhasDet,
      larguraUtil,
      margem,
      () => (y = margem + 40),
    )

  // Rodapé
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text(
    `Gerado pelo painel NPS Fundatec em ${fmtDataHora(new Date().toISOString())} — respostas anônimas não expõem nome nem e-mail.`,
    margem,
    alturaPag - 24,
  )

  const slug = campanha.slug || 'campanha'
  doc.save(`relatorio-nps-${slug}-${periodo.de}-${periodo.ate}.pdf`)
}

// Tabela simples em múltiplas páginas (sem dependência externa).
function autoTabela(
  doc: import('jspdf').jsPDF,
  cabecalho: string[],
  linhas: (string | number)[][],
  larguraUtil: number,
  x: number,
  novaPag: () => void,
): void {
  const colW = larguraUtil / cabecalho.length
  const desenharLinha = (cells: (string | number)[], negrito: boolean, fundo: boolean): number => {
    let maxLins = 1
    const porCol: string[][] = []
    doc.setFont('helvetica', negrito ? 'bold' : 'normal')
    doc.setFontSize(8)
    cells.forEach((c, i) => {
      const t = doc.splitTextToSize(String(c ?? ''), colW - 8) as string[]
      porCol.push(t)
      maxLins = Math.max(maxLins, t.length)
    })
    const hLinha = 12 + (maxLins - 1) * 9
    if (fundo) {
      doc.setFillColor(241, 245, 249)
      doc.rect(x, y - 9, larguraUtil, hLinha + 4, 'F')
    }
    porCol.forEach((t, i) => {
      doc.setTextColor(30, 41, 59)
      t.forEach((linha, j) => doc.text(linha, x + i * colW + 4, y + j * 9))
    })
    return hLinha
  }

  y += desenharLinha(cabecalho, true, true) + 2
  for (const l of linhas) {
    const h = desenharLinha(l, false, false) + 2
    y += h
    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage()
      novaPag()
      y += desenharLinha(cabecalho, true, true) + 2
    }
  }
}
