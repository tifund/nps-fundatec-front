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
  | { tipo: 'slug'; slug: string }

export function parseAvaliacaoParams(
  searchParams?: URLSearchParams,
  routeParams?: { token?: string; slug?: string },
): ParametroAvaliacao | null {
  // 1) Rota no caminho: /avaliar/:token
  const routeToken = (routeParams?.token || '').trim()
  if (routeToken) return { tipo: 'token', token: routeToken }

  // 2) Rota no caminho: /avaliar/aberto/:slug
  const routeSlug = (routeParams?.slug || '').trim()
  if (routeSlug) return { tipo: 'slug', slug: routeSlug }

  // 3) Query string fallback: ?c={token}
  const tokenQuery = (searchParams?.get('c') || '').trim()
  if (tokenQuery) return { tipo: 'token', token: tokenQuery }

  // 4) Query string fallback: ?campanha={id_publico}
  const campanhaQuery = (searchParams?.get('campanha') || '').trim()
  if (campanhaQuery) return { tipo: 'campanha', campanhaId: campanhaQuery }

  return null
}

export async function getSurveyContext(
  params: { token?: string; slug?: string; campanhaId?: string } | ParametroAvaliacao,
): Promise<SurveyContext> {
  const qs = new URLSearchParams()
  if ('tipo' in params) {
    if (params.tipo === 'token') qs.set('token', params.token)
    else if (params.tipo === 'slug') qs.set('slug', params.slug)
    else qs.set('campanha_id', params.campanhaId)
  } else {
    if (params.token) qs.set('token', params.token)
    if (params.slug) qs.set('slug', params.slug)
    if (params.campanhaId) qs.set('campanha_id', params.campanhaId)
  }
  return pb.send<SurveyContext>(`/backend/v1/nps/survey-context?${qs.toString()}`, {
    method: 'GET',
  })
}
