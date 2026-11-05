import pb from '@/lib/pocketbase/client'
import { SurveyResponse, SystemLog } from '@/types/nps'

export async function getSurveyResponses(campaignId?: string): Promise<SurveyResponse[]> {
  const filter = campaignId ? `campaign_id = "${campaignId}"` : ''
  return await pb.collection('survey_responses').getFullList<SurveyResponse>({
    filter,
    sort: '-created',
    expand: 'campaign_id,participant_id',
  })
}

/**
 * Registra a resposta da avaliação pública.
 *
 * Fluxo seguro (regras fechadas + hook onCreate):
 * - o create público em survey_responses exige nota (0-10) e classificação;
 * - o hook server-side valida token/campanha ativa/vigência/já respondeu,
 *   vincula o participante quando o convite existe (body.token) e marca
 *   respondido = true;
 * - o log do sistema é gravado pelo hook (system_logs não aceita mais
 *   creates públicos).
 */
export async function submitSurveyResponse(data: {
  campaign_id: string
  token?: string
  nota: number
  comentario?: string
  justificativa_detrator?: string
  anonimo: boolean
  respostas_adicionais?: { question_id: string; enunciado: string; valor: string | number }[]
}): Promise<SurveyResponse> {
  let classificacao: 'promotor' | 'neutro' | 'detrator' = 'neutro'
  if (data.nota >= 9) {
    classificacao = 'promotor'
  } else if (data.nota <= 6) {
    classificacao = 'detrator'
  }

  return await pb.collection('survey_responses').create<SurveyResponse>({
    campaign_id: data.campaign_id,
    // token do convite (quando houver); o hook valida e vincula o participante
    token: data.token || '',
    nota: data.nota,
    classificacao,
    comentario: data.comentario || '',
    justificativa_detrator: data.justificativa_detrator || '',
    anonimo: data.anonimo,
    respostas_adicionais: data.respostas_adicionais || [],
  })
}

export async function getSystemLogs(limit: number = 50): Promise<SystemLog[]> {
  return await pb
    .collection('system_logs')
    .getList<SystemLog>(1, limit, {
      sort: '-created',
    })
    .then((res) => res.items)
}
