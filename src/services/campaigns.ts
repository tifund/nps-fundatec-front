import pb from '@/lib/pocketbase/client'
import { Campaign, CampaignQuestion, CreateCampaignPayload } from '@/types/nps'

export interface CampaignStats {
  convocados: number
  respondidos: number
  respostas: number
  nps: number | null
}

export async function getCampaigns(): Promise<Campaign[]> {
  try {
    const records = await pb.collection('campaigns').getFullList<Campaign>({
      sort: '-created',
    })
    return records
  } catch {
    return []
  }
}

export async function getCampaignById(id: string): Promise<Campaign | null> {
  try {
    return await pb.collection('campaigns').getOne<Campaign>(id)
  } catch {
    return null
  }
}

export async function getCampaignBySlug(slug: string): Promise<Campaign | null> {
  try {
    const records = await pb.collection('campaigns').getList<Campaign>(1, 1, {
      filter: `slug = "${slug}"`,
    })
    return records.items[0] || null
  } catch {
    return null
  }
}

export async function getCampaignQuestions(campaignId: string): Promise<CampaignQuestion[]> {
  try {
    const records = await pb.collection('questions').getFullList<CampaignQuestion>({
      filter: `campaign_id = "${campaignId}"`,
      sort: 'ordem',
    })
    return records
  } catch {
    return []
  }
}

export async function createCampaign(
  payload: CreateCampaignPayload,
  perguntas: { enunciado: string; tipo: 'nota' | 'texto'; obrigatoria: boolean; ordem: number }[],
): Promise<Campaign> {
  const record = await pb.collection('campaigns').create<Campaign>(payload)

  for (const p of perguntas) {
    await pb.collection('questions').create({
      campaign_id: record.id,
      enunciado: p.enunciado,
      tipo: p.tipo,
      obrigatoria: p.obrigatoria,
      ordem: p.ordem,
    })
  }
  return record
}

export async function updateCampaign(
  id: string,
  payload: CreateCampaignPayload,
  perguntas: { enunciado: string; tipo: 'nota' | 'texto'; obrigatoria: boolean; ordem: number }[],
): Promise<Campaign> {
  const record = await pb.collection('campaigns').update<Campaign>(id, payload)

  // Sincroniza as perguntas adicionais: recria a lista por completo.
  const atuais = await pb.collection('questions').getFullList<CampaignQuestion>({
    filter: `campaign_id = "${id}"`,
  })
  for (const q of atuais) {
    await pb.collection('questions').delete(q.id)
  }
  for (const p of perguntas) {
    await pb.collection('questions').create({
      campaign_id: id,
      enunciado: p.enunciado,
      tipo: p.tipo,
      obrigatoria: p.obrigatoria,
      ordem: p.ordem,
    })
  }
  return record
}

/** Encerra a campanha: status = encerrada. Não aceita mais respostas nem reenvios. */
export async function closeCampaign(id: string): Promise<Campaign> {
  return pb.collection('campaigns').update<Campaign>(id, { status: 'encerrada' })
}

/** Ativa a campanha — o backend rejeita sem área vinculada/pergunta NPS ou prazo vencido. */
export async function activateCampaign(id: string): Promise<Campaign> {
  return pb.collection('campaigns').update<Campaign>(id, { status: 'ativa' })
}

/**
 * Exclui a campanha. O backend bloqueia a exclusão quando existem respostas
 * (survey_responses vinculadas) — apenas encerrar é permitido nesse caso.
 */
export async function deleteCampaign(id: string): Promise<void> {
  await pb.collection('campaigns').delete(id)
}

/**
 * Estatísticas por campanha: convocados (participants), respondidos
 * (participants marcados como respondidos) e total de respostas (survey_responses).
 * O NPS atual usa a pergunta NPS: nota >= 9 promotora, <= 6 detratora.
 */
export async function getCampaignStats(
  campaignIds: string[],
): Promise<{ stats: Record<string, CampaignStats> }> {
  const stats: Record<string, CampaignStats> = {}
  for (const id of campaignIds) {
    stats[id] = { convocados: 0, respondidos: 0, respostas: 0, nps: null }
  }
  if (campaignIds.length === 0) return { stats }

  const filterIn = `(${campaignIds.map((id) => `campaign_id = "${id}"`).join(' || ')})`

  const [participants, responses] = await Promise.all([
    pb.collection('participants').getFullList<{ campaign_id: string; respondido: boolean }>({
      filter: filterIn,
      fields: 'id,campaign_id,respondido',
    }),
    pb.collection('survey_responses').getFullList<{ campaign_id: string; nota: number }>({
      filter: filterIn,
      fields: 'id,campaign_id,nota',
    }),
  ])

  for (const p of participants) {
    if (!stats[p.campaign_id]) continue
    stats[p.campaign_id].convocados++
    if (p.respondido) stats[p.campaign_id].respondidos++
  }
  for (const r of responses) {
    if (!stats[r.campaign_id]) continue
    stats[r.campaign_id].respostas++
  }
  for (const id of campaignIds) {
    const s = stats[id]
    if (s.respostas > 0) {
      const all = responses.filter((r) => r.campaign_id === id)
      const promotores = all.filter((r) => r.nota >= 9).length
      const detratores = all.filter((r) => r.nota <= 6).length
      s.nps = Math.round(((promotores - detratores) / all.length) * 100)
    }
  }
  return { stats }
}

export type { CreateCampaignPayload }

/** Cria uma pergunta adicional avulsa (usada no gerenciador pós-criação). */
export async function createQuestion(payload: {
  campaign_id: string
  enunciado: string
  tipo: 'nota' | 'texto'
  obrigatoria: boolean
  ordem: number
}): Promise<CampaignQuestion> {
  return pb.collection('questions').create<CampaignQuestion>(payload)
}

/** Exclui uma pergunta adicional. */
export async function deleteQuestion(id: string): Promise<void> {
  await pb.collection('questions').delete(id)
}
