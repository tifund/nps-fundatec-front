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

export async function submitSurveyResponse(data: {
  campaign_id: string
  participant_id?: string
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

  const response = await pb.collection('survey_responses').create<SurveyResponse>({
    ...data,
    classificacao,
  })

  // Se veio de participante, marca como respondido
  if (data.participant_id) {
    try {
      await pb.collection('participants').update(data.participant_id, {
        respondido: true,
        respondido_em: new Date().toISOString(),
      })
    } catch (e) {
      console.error('Erro ao atualizar participante como respondido:', e)
    }
  }

  // Registra log da resposta
  try {
    await pb.collection('system_logs').create({
      acao: 'resposta_enviada',
      detalhe: `Avaliação NPS registrada com nota ${data.nota} (${classificacao}) para campanha ${data.campaign_id}`,
      usuario: data.anonimo ? 'Anônimo' : data.participant_id || 'Visitante',
    })
  } catch {
    /* intentionally ignored */
  }

  return response
}

export async function getSystemLogs(limit: number = 50): Promise<SystemLog[]> {
  return await pb
    .collection('system_logs')
    .getList<SystemLog>(1, limit, {
      sort: '-created',
    })
    .then((res) => res.items)
}
