import pb from '@/lib/pocketbase/client'
import { Participant } from '@/types/nps'

export async function getParticipants(campaignId?: string): Promise<Participant[]> {
  const filter = campaignId ? `campaign_id = "${campaignId}"` : ''
  return await pb.collection('participants').getFullList<Participant>({
    filter,
    sort: '-created',
    expand: 'campaign_id',
  })
}

export async function getParticipantByToken(token: string): Promise<Participant> {
  return await pb.collection('participants').getFirstListItem<Participant>(`token = "${token}"`, {
    expand: 'campaign_id',
  })
}

export async function createParticipant(data: {
  campaign_id: string
  nome: string
  email: string
}): Promise<Participant> {
  // Gera token único legível e seguro
  const token = `tok_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`
  return await pb.collection('participants').create<Participant>({
    ...data,
    token,
    respondido: false,
  })
}

export async function importParticipantsBatch(
  campaignId: string,
  list: { nome: string; email: string }[],
): Promise<{ added: number; errors: number }> {
  let added = 0
  let errors = 0

  for (const item of list) {
    try {
      if (!item.email || !item.nome) continue
      const token = `tok_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`
      await pb.collection('participants').create({
        campaign_id: campaignId,
        nome: item.nome.trim(),
        email: item.email.trim().toLowerCase(),
        token,
        respondido: false,
      })
      added++
    } catch {
      errors++
    }
  }

  return { added, errors }
}

export async function markParticipantAnswered(participantId: string): Promise<void> {
  await pb.collection('participants').update(participantId, {
    respondido: true,
    respondido_em: new Date().toISOString(),
  })
}
