// Hook do fluxo de importação de participantes via CSV/XLSX.
// Validação linha a linha, dedupe em memória + contra o backend (chave campanha+email),
// token único por participante, progresso incremental e relatório final com motivo
// de cada linha ignorada. Gravação com concorrência limitada para suportar 5.000+ linhas.
import { useRef, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { parseCsv, parseXlsx, emailValido, LinhaArquivo } from '@/lib/importacao/arquivo'

export interface LinhaIgnorada {
  linha: number
  motivo: string
  nome: string
  email: string
}

export interface ResultadoImportacao {
  importados: number
  ignorados: number
  duplicadosArquivo: number
  duplicadosCampanha: number
  erros: number
  detalhes: LinhaIgnorada[]
}

export interface ProgressoImportacao {
  fase: 'idle' | 'lendo' | 'importando' | 'concluido'
  lidas: number
  total: number
  importados: number
  ignorados: number
}

const TOKEN_ALFABETO = 'abcdefghijkmnopqrstuvwxyz23456789'

/** Gera um token criptograficamente aleatório (a colisão é tratada pela unique do backend). */
function gerarToken(): string {
  const rand = new Uint32Array(24)
  crypto.getRandomValues(rand)
  let token = 'tok_'
  for (let i = 0; i < 24; i++) token += TOKEN_ALFABETO[rand[i] % TOKEN_ALFABETO.length]
  return token
}

const CONCORRENCIA = 8

export function useImportacaoCsv(campaignId: string) {
  const [progresso, setProgresso] = useState<ProgressoImportacao>({
    fase: 'idle',
    lidas: 0,
    total: 0,
    importados: 0,
    ignorados: 0,
  })
  const emAndamento = useRef(false)
  const cancelado = useRef(false)

  const importarArquivo = async (file: File): Promise<ResultadoImportacao> => {
    if (emAndamento.current) throw new Error('Já existe uma importação em andamento.')
    if (!campaignId) throw new Error('Selecione a campanha antes de importar.')
    emAndamento.current = true
    cancelado.current = false

    setProgresso({ fase: 'lendo', lidas: 0, total: 0, importados: 0, ignorados: 0 })

    try {
      // --- leitura do arquivo ---
      const nomeLower = file.name.toLowerCase()
      let parsed: { linhas: LinhaArquivo[]; total: number }
      if (nomeLower.endsWith('.xlsx')) {
        const buf = await file.arrayBuffer()
        parsed = await parseXlsx(buf)
      } else if (
        nomeLower.endsWith('.csv') ||
        nomeLower.endsWith('.txt') ||
        nomeLower.endsWith('.tsv')
      ) {
        parsed = parseCsv(await file.text())
      } else {
        throw new Error('Formato não suportado. Envie um arquivo .csv ou .xlsx.')
      }

      const { linhas } = parsed
      setProgresso((p) => ({ ...p, fase: 'importando', lidas: 0, total: linhas.length }))

      // --- e-mails já cadastrados na campanha (dedupe contra o banco) ---
      const existentes = new Set<string>()
      let page = 1
      for (;;) {
        const pageRes = await pb.collection('participants').getList(page, 500, {
          filter: `campaign_id = "${campaignId}"`,
          fields: 'email',
        })
        for (const it of pageRes.items) existentes.add(String(it.email).trim().toLowerCase())
        if (page >= pageRes.totalPages) break
        page++
      }

      // --- validação linha a linha (rápida, em memória) ---
      const resultado: ResultadoImportacao = {
        importados: 0,
        ignorados: 0,
        duplicadosArquivo: 0,
        duplicadosCampanha: 0,
        erros: 0,
        detalhes: [],
      }
      const vistosNoArquivo = new Map<string, number>() // email -> 1ª linha em que apareceu
      const paraImportar: { nome: string; email: string; linha: number }[] = []

      const ignorar = (
        item: LinhaArquivo,
        motivo: string,
        nome = item.nome.trim(),
        email = item.email.trim().toLowerCase(),
      ) => {
        resultado.ignorados++
        resultado.detalhes.push({ linha: item.linha, motivo, nome, email })
      }

      for (const item of linhas) {
        setProgresso((p) => ({ ...p, lidas: p.lidas + 1 }))

        const email = item.email.trim().toLowerCase()
        const nome = item.nome.trim()

        if (!email && !nome) ignorar(item, 'linha vazia', '', '')
        else if (!nome) ignorar(item, 'sem nome', '', email)
        else if (!email) ignorar(item, 'sem e-mail', nome, '')
        else if (!emailValido(email)) ignorar(item, `e-mail inválido (${item.email.trim()})`)
        else if (vistosNoArquivo.has(email)) {
          resultado.duplicadosArquivo++
          ignorar(
            item,
            `e-mail duplicado no arquivo (1ª ocorrência na linha ${vistosNoArquivo.get(email)})`,
          )
        } else if (existentes.has(email)) {
          resultado.duplicadosCampanha++
          ignorar(item, 'e-mail já cadastrado nesta campanha')
        } else {
          vistosNoArquivo.set(email, item.linha)
          paraImportar.push({ nome, email, linha: item.linha })
        }

        if (resultado.ignorados % 25 === 0) {
          setProgresso((p) => ({ ...p, ignorados: resultado.ignorados }))
        }
      }

      // --- gravação com concorrência limitada ---
      let cursor = 0
      const gravarUm = async (item: { nome: string; email: string; linha: number }) => {
        if (cancelado.current) return
        try {
          try {
            await pb.collection('participants').create({
              campaign_id: campaignId,
              nome: item.nome,
              email: item.email,
              token: gerarToken(),
              respondido: false,
            })
          } catch (err: unknown) {
            const msg = (err as Error)?.message || ''
            // colisão de token (unique): reaplica com um novo token
            if (/token/i.test(msg)) {
              await pb.collection('participants').create({
                campaign_id: campaignId,
                nome: item.nome,
                email: item.email,
                token: gerarToken(),
                respondido: false,
              })
            } else {
              throw err
            }
          }
          existentes.add(item.email)
          resultado.importados++
        } catch (err: unknown) {
          const msg = (err as Error)?.message || 'falha desconhecida'
          if (/duplicate|unique/i.test(msg)) {
            // concorrência: cadastrado entre a checagem e a gravação
            resultado.duplicadosCampanha++
            resultado.ignorados++
            resultado.detalhes.push({
              linha: item.linha,
              motivo: 'e-mail já cadastrado nesta campanha',
              nome: item.nome,
              email: item.email,
            })
          } else {
            resultado.erros++
            resultado.ignorados++
            resultado.detalhes.push({
              linha: item.linha,
              motivo: `erro ao gravar: ${msg}`,
              nome: item.nome,
              email: item.email,
            })
          }
        }
        setProgresso((p) => ({
          ...p,
          lidas: p.lidas + 1,
          importados: resultado.importados,
          ignorados: resultado.ignorados,
        }))
      }

      const worker = async () => {
        for (;;) {
          if (cancelado.current) return
          const idx = cursor++
          if (idx >= paraImportar.length) return
          await gravarUm(paraImportar[idx])
        }
      }
      setProgresso((p) => ({ ...p, lidas: 0, total: paraImportar.length }))
      await Promise.all(Array.from({ length: CONCORRENCIA }, () => worker()))

      setProgresso((p) => ({
        ...p,
        fase: 'concluido',
        importados: resultado.importados,
        ignorados: resultado.ignorados,
      }))
      return resultado
    } finally {
      emAndamento.current = false
    }
  }

  const cancelar = () => {
    cancelado.current = true
  }

  return { progresso, importarArquivo, cancelar }
}
