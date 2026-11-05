import pb from '@/lib/pocketbase/client'
import { Campaign, Question } from '@/types/nps'

export async function getCampaigns(): Promise<Campaign[]> {
  return await pb.collection('campaigns').getFullList<Campaign>({
    sort: '-created',
    expand: 'area_id',
  })
}

export async function getCampaignById(id: string): Promise<Campaign> {
  return await pb.collection('campaigns').getOne<Campaign>(id, {
    expand: 'area_id',
  })
}

export async function getCampaignBySlug(slug: string): Promise<Campaign> {
  return await pb.collection('campaigns').getFirstListItem<Campaign>(`slug = "${slug}"`, {
    expand: 'area_id',
  })
}

export async function createCampaign(data: {
  nome: string
  area_id: string
  pergunta_nps: string
  modo_acesso: 'convites' | 'link_aberto'
  status: 'ativa' | 'encerrada'
  vigencia_fim?: string
  justificativa_detrator: 'obrigatoria' | 'geral' | 'nenhuma'
  texto_geral?: string
  slug: string
}): Promise<Campaign> {
  return await pb.collection('campaigns').create<Campaign>(data)
}

export async function updateCampaign(id: string, data: Partial<Campaign>): Promise<Campaign> {
  return await pb.collection('campaigns').update<Campaign>(id, data)
}

export async function closeCampaign(id: string): Promise<Campaign> {
  return await pb.collection('campaigns').update<Campaign>(id, {
    status: 'encerrada',
  })
}

// Perguntas Adicionais da Campanha
export async function getCampaignQuestions(campaignId: string): Promise<Question[]> {
  return await pb.collection('questions').getFullList<Question>({
    filter: `campaign_id = "${campaignId}"`,
    sort: 'ordem',
  })
}

export async function createQuestion(data: {
  campaign_id: string
  enunciado: string
  tipo: 'nota' | 'texto'
  obrigatoria: boolean
  ordem: number
}): Promise<Question> {
  return await pb.collection('questions').create<Question>(data)
}

export async function deleteQuestion(id: string): Promise<boolean> {
  return await pb.collection('questions').delete(id)
}
