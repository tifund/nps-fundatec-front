import pb from '@/lib/pocketbase/client'
import { Dispatch } from '@/types/nps'

export async function getDispatches(campaignId?: string): Promise<Dispatch[]> {
  const filter = campaignId ? `campaign_id = "${campaignId}"` : ''
  return await pb.collection('dispatches').getFullList<Dispatch>({
    filter,
    sort: '-created',
    expand: 'campaign_id,participant_id',
  })
}

export async function createDispatchRecord(data: {
  campaign_id: string
  participant_id?: string
  tipo: 'inicial' | 'reenvio' | 'copia_link'
  destinatario: string
  status: 'sucesso' | 'falha' | 'registrado'
  detalhe?: string
}): Promise<Dispatch> {
  return await pb.collection('dispatches').create<Dispatch>(data)
}

export async function sendInviteViaBackend(
  campaignId: string,
  participantId: string,
  isResend: boolean = false,
): Promise<{ success: boolean; status: string; detalhe: string; inviteLink?: string }> {
  try {
    const baseUrl = window.location.origin
    const res = await pb.send<{
      success: boolean
      status: string
      detalhe: string
      inviteLink?: string
    }>('/backend/v1/nps/send-invite', {
      method: 'POST',
      body: {
        campaignId,
        participantId,
        isResend,
        baseUrl,
      },
    })
    return res
  } catch (err: unknown) {
    const errorMsg = (err as Error)?.message || 'Falha na requisição de envio'
    // fallback registrando o envio localmente
    await pb.collection('dispatches').create({
      campaign_id: campaignId,
      participant_id: participantId,
      tipo: isResend ? 'reenvio' : 'inicial',
      destinatario: 'participante',
      status: 'falha',
      detalhe: errorMsg,
    })
    return {
      success: false,
      status: 'falha',
      detalhe: errorMsg,
    }
  }
}
