// Cálculos de NPS compartilhados pelo Dashboard (visão geral e por campanha).
// NPS = %promotores (9–10) − %detratores (0–6), sempre sobre o PERÍODO filtrado.
import type { SurveyResponse } from '@/types/nps'

export type Faixa = 'detrator' | 'neutro' | 'promotor'

export const corFaixa: Record<Faixa, string> = {
  detrator: '#e11d48', // rose-600
  neutro: '#f59e0b', // amber-500
  promotor: '#059669', // emerald-600
}

export function faixaDaNota(nota: number): Faixa {
  if (nota >= 9) return 'promotor'
  if (nota >= 7) return 'neutro'
  return 'detrator'
}

export interface Distribuicao {
  counts: number[] // índice 0..10
  pct: number[] // índice 0..10 (com 1 decimal)
  detratores: number
  neutros: number
  promotores: number
  pctDetratores: number
  pctNeutros: number
  pctPromotores: number
  nps: number | null // −100 a +100
  total: number
}

export function calcularNps(respostas: { nota: number }[]): Distribuicao {
  const counts = new Array(11).fill(0) as number[]
  for (const r of respostas) {
    const n = Math.round(r.nota)
    if (n >= 0 && n <= 10) counts[n]++
  }
  const total = counts.reduce((a, b) => a + b, 0)
  const pct = counts.map((c) => (total > 0 ? Math.round((c / total) * 1000) / 10 : 0))
  const detratores = counts.slice(0, 7).reduce((a, b) => a + b, 0)
  const neutros = counts[7] + counts[8]
  const promotores = counts[9] + counts[10]
  const pDet = total > 0 ? Math.round((detratores / total) * 1000) / 10 : 0
  const pNeu = total > 0 ? Math.round((neutros / total) * 1000) / 10 : 0
  const pPro = total > 0 ? Math.round((promotores / total) * 1000) / 10 : 0
  return {
    counts,
    pct,
    detratores,
    neutros,
    promotores,
    pctDetratores: pDet,
    pctNeutros: pNeu,
    pctPromotores: pPro,
    nps: total > 0 ? Math.round(pPro - pDet) : null,
    total,
  }
}

// Fórmula aplicada, junto ao número — transparência do cálculo.
export function formulaNps(d: Distribuicao): string {
  if (d.total === 0) return 'NPS = %promotores − %detratores (sem respostas no período)'
  return `NPS = ${d.pctPromotores.toFixed(1)}% promotores − ${d.pctDetratores.toFixed(
    1,
  )}% detratores = ${d.nps}`
}

// Contato do respondente: NUNCA exposto quando a resposta é anônima.
export function contatoDaResposta(r: SurveyResponse): { nome: string; email: string } | null {
  if (r.anonimo) return null
  const p = r.expand?.participant_id
  if (!p) return null
  return { nome: p.nome || 'Não identificado', email: p.email || '' }
}

export function rotuloContato(r: SurveyResponse): string {
  return r.anonimo ? 'Anônimo' : contatoDaResposta(r)?.nome || 'Não identificado'
}

// ---------- Filtro por data (afeta TODOS os números das telas) ----------

// "2025-01-31" -> "2025-01-31 00:00:00.000Z" (comparação lexicográfica com o created do PB)
export function inicioDoDia(isoDate: string): string {
  return `${isoDate}T00:00:00.000Z`
}

export function fimDoDia(isoDate: string): string {
  return `${isoDate}T23:59:59.999Z`
}

export function respostaNoPeriodo(r: SurveyResponse, de: string, ate: string): boolean {
  const criado = r.created
  return criado >= inicioDoDia(de) && criado <= fimDoDia(ate)
}

export function isoHoje(): string {
  return new Date().toISOString().slice(0, 10)
}

export function isoNDiasAtras(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

// ---------- Evolução do NPS por período (semana ou mês) ----------

export interface PontoEvolucao {
  rotulo: string
  nps: number | null
  respostas: number
}

function chaveSemana(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z')
  // Segunda-feira da semana (UTC)
  const dia = d.getUTCDay() // 0=dom
  const recuo = dia === 0 ? 6 : dia - 1
  d.setUTCDate(d.getUTCDate() - recuo)
  return d.toISOString().slice(0, 10)
}

function rotuloSemana(chave: string): string {
  const [a, m, dd] = chave.split('-')
  return `sem ${dd}/${m}`
}

function chaveMes(iso: string): string {
  return iso.slice(0, 7) // yyyy-MM
}

function rotuloMes(chave: string): string {
  const [a, m] = chave.split('-')
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${meses[Number(m) - 1]}/${a.slice(2)}`
}

// Agrupa as respostas do período por semana (quando ≤ ~12 semanas) ou por mês.
// Sem dados suficientes (menos de 2 períodos com respostas) devolve [] —
// a tela mostra "sem dados suficientes" em vez de uma linha enganosa.
export function evolucaoNps(
  respostas: SurveyResponse[],
  granularidade: 'semana' | 'mes',
): PontoEvolucao[] {
  const grupos = new Map<string, { notas: number[]; ordem: string }>()
  for (const r of respostas) {
    const iso = r.created.slice(0, 10)
    const chave = granularidade === 'semana' ? chaveSemana(iso) : chaveMes(iso)
    const g = grupos.get(chave) || { notas: [], ordem: chave }
    g.notas.push(r.nota)
    grupos.set(chave, g)
  }
  const chaves = [...grupos.keys()].sort()
  if (chaves.length < 2) return []
  return chaves.map((chave) => {
    const d = calcularNps(grupos.get(chave)!.notas.map((n) => ({ nota: n })))
    return {
      rotulo: granularidade === 'semana' ? rotuloSemana(chave) : rotuloMes(chave),
      nps: d.nps,
      respostas: d.total,
    }
  })
}

// Granularidade sugerida pelo tamanho do período (≤ 12 semanas = semanal)
export function granularidadeDoPeriodo(de: string, ate: string): 'semana' | 'mes' {
  const dias =
    (new Date(ate + 'T12:00:00Z').getTime() - new Date(de + 'T12:00:00Z').getTime()) / 86400000
  return dias <= 7 * 12 ? 'semana' : 'mes'
}
