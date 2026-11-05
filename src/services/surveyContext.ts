import pb from '@/lib/pocketbase/client'
import { SurveyContext } from '@/types/nps'

/**
 * Busca o contexto da avaliação pública (campanha, participante e perguntas)
 * pela rota pública do backend. O acesso direto e anônimo a campaigns,
 * participants e questions está fechado pelas regras de API — o hook devolve
 * apenas os dados necessários para renderizar a avaliação.
 */
export async function getSurveyContext(params: {
  token?: string
  slug?: string
}): Promise<SurveyContext> {
  const query = params.token
    ? `token=${encodeURIComponent(params.token)}`
    : `slug=${encodeURIComponent(params.slug || '')}`
  return await pb.send<SurveyContext>(`/backend/v1/nps/survey-context?${query}`, {
    method: 'GET',
  })
}
