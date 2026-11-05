// Camada de dados do dashboard NPS: buscas no PocketBase e agregação por período.
// Toda leitura é feita pelo SDK autenticado — LEITURA também enxerga os dashboards.
import pb from '@/lib/pocketbase/client'
import { getAreas } from '@/services/areas'
import { getSurveyResponses } from '@/services/responses'
import { calcularNps, respostaNoPeriodo, isoHoje, isoNDiasAtras } from '@/lib/nps/calculos'
import type { Area, Campaign, CampaignStats } from '@/types/nps'

export { isoHoje, isoNDiasAtras }
export type { Area, Campaign }

export interface PeriodoFiltro {
  de: string
  ate: string
}

export const PERIODO_PADRAO_DIAS = 90

export function periodoPadrao(): PeriodoFiltro {
  return { de: isoNDiasAtras(PERIODO_PADRAO_DIAS), ate: isoHoje() }
}

export interface VisaoGeral {
  campanhasAtivas: number
  totalRespostas: number
  npsGeral: number | null
  linhas: LinhaCampanha[]
}

export interface LinhaCampanha {
  campaign: Campaign
  stats: CampaignStats
  respostas: number
  nps: number | null
  npsTexto: string
}

export interface DetalheCampanha {
  campaign: Campaign
  stats: CampaignStats
  respostas: SurveyResponse[] // já filtradas pelo período
}

// getSurveyResponses pagina por 100; buscamos 1 página só (o dashboard usa
// as respostas do período, que raramente passam disso; se passar, aviso no console).
export async function carregarRespostas(): Promise<SurveyResponse[]> {
  const todas = await getSurveyResponses()
  if (todas.length === 100) {
    try {
      const mais = await pb.collection('survey_responses').getFullList({
        sort: '-created',
        batch: 10,
      })
      return mais as unknown as SurveyResponse[]
    } catch {
      return todas
    }
  }
  return todas
}

export async function carregarCampanhas(): Promise<Campaign[]> {
  return await pb.collection('campaigns').getFullList<Campaign>({ sort: '-created' })
}

export async function carregarAreas(): Promise<Area[]> {
  return await getAreas()
}

export function filtrarCampanhas(campanhas: Campaign[], areaId: string): Campaign[] {
  if (areaId) return campanhas.filter((c) => c.area_id === areaId)
  return campanhas
}

export function filtrarRespostas(
  respostas: SurveyResponse[],
  campanhaId: string,
  periodo: PeriodoFiltro,
): SurveyResponse[] {
  return respostas.filter(
    (r) => r.campaign_id === campanhaId && respostaNoPeriodo(r, periodo.de, periodo.ate),
  )
}

export function npsDe(respostas: SurveyResponse[]): number | null {
  return calcularNps(respostas).nps
}

export function npsTexto(nps: number | null): string {
  return nps === null ? '—' : String(nps)
}

// ---------- Visão geral ----------

export async function carregarVisaoGeral(
  campanhas: Campaign[],
  respostas: SurveyResponse[],
  periodo: PeriodoFiltro,
): Promise<VisaoGeral> {
  const linhas: LinhaCampanha[] = campanhas.map((c) => {
    const doPeriodo = respostas.filter(
      (r) => r.campaign_id === c.id && respostaNoPeriodo(r, periodo.de, periodo.ate),
    )
    return {
      campaign: c,
      stats: {
        total_participants: c.expand?.total_participantes ?? 0,
        answered: doPeriodo.length,
        response_rate: c.expand?.total_participantes
          ? doPeriodo.length / c.expand.total_participantes
          : 0,
        nps: calcularNps(doPeriodo).nps ?? 0,
      },
      respostas: doPeriodo.length,
      nps: calcularNps(doPeriodo).nps,
      npsTexto: npsTexto(calcularNps(doPeriodo).nps),
    }
  })
  const totalRespostas = linhas.reduce((a, l) => a + l.respostas, 0)
  const todas = respostas.filter((r) => respostaNoPeriodo(r, periodo.de, periodo.ate))
  return {
    campanhasAtivas: campanhas.filter((c) => c.status === 'ativa').length,
    totalRespostas,
    npsGeral: calcularNps(todas).nps,
    linhas,
  }
}

// ---------- Detalhe da campanha ----------

export async function carregarDetalhe(campaignId: string): Promise<Campaign | null> {
  try {
    return (await pb.collection('campaigns').getOne<Campaign>(campaignId)) as Campaign
  } catch {
    return null
  }
}
