import pb from '@/lib/pocketbase/client'
import type { SurveyContext } from '@/types/nps'

// Contexto devolvido pela rota pública /backend/v1/nps/survey-context
// (o acesso público direto a campaigns/participants/questions está fechado)

// Contexto por parâmetro da página pública /avaliacao:
//  - Convite individual: /avaliacao?c={token}
//  - Link aberto:        /avaliacao?campanha={id_publico}
export type ParametroAvaliacao =
  | { tipo: 'token'; token: string }
  | { tipo: 'campanha'; campanhaId: string }

export function parseAvaliacaoParams(params: URLSearchParams): ParametroAvaliacao | null {
  const token = (params.get('c') || '').trim()
  if (token) return { tipo: 'token', token }
  const campanha = (params.get('campanha') || '').trim()
  if (campanha) return { tipo: 'campanha', campanhaId: campanha }
  return null
}

export async function getSurveyContext(
  params: { token?: string; slug?: string } | ParametroAvaliacao,
): Promise<SurveyContext> {
  const qs = new URLSearchParams()
  if ('tipo' in params) {
    if (params.tipo === 'token') qs.set('token', params.token)
    else qs.set('campanha_id', params.campanhaId)
  } else {
    if (params.token) qs.set('token', params.token)
    if (params.slug) qs.set('slug', params.slug)
  }
  return pb.send<SurveyContext>(`/backend/v1/nps/survey-context?${qs.toString()}`, {
    method: 'GET',
  })
}
