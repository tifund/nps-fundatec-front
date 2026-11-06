import pb from '@/lib/pocketbase/client'
import { Dispatch } from '@/types/nps'

export type ModoDisparo = 'inicial' | 'reenvio_todos'

export interface ResultadoDisparo {
  participante: string
  email: string
  status: 'sucesso' | 'falha'
}

export interface RespostaDisparo {
  enviados: number
  erros: number
  ignorados: number
  jaRespondidos?: number
  detalhe?: string
  resultados?: ResultadoDisparo[]
}

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

/**
 * Redefinição de senha de outro usuário pelo painel, via rota de backend
 * executada com privilégio de superuser (sem exigir oldPassword).
 * Requisitos da rota: sessão autenticada com perfil ADMIN. A senha provisória
 * é gerada no FRONTEND (src/lib/senha.ts) e enviada no corpo da chamada;
 * o backend nunca a registra em log (LGPD) e o frontend não a grava em
 * nenhuma coleção — ela é exibida em tela apenas para o admin copiar.
 */
export async function resetSenhaViaBackend(
  usuarioId: string,
  novaSenha: string,
): Promise<{ success: boolean }> {
  return await pb.send<{ success: boolean }>('/backend/v1/nps/reset-senha', {
    method: 'POST',
    body: { usuarioId, novaSenha },
  })
}

/**
 * Disparo em lote pelo backend (hook /backend/v1/nps/send-invites-batch).
 * O backend decide quem recebe (trava de respondentes/já recebidos), envia
 * via Resend e grava o log em dispatches — o frontend só dispara e resume.
 */
export async function sendInvitesBatch(
  campaignId: string,
  modo: ModoDisparo,
): Promise<RespostaDisparo> {
  const baseUrl = window.location.origin
  const res = await pb.send<RespostaDisparo>('/backend/v1/nps/send-invites-batch', {
    method: 'POST',
    body: { campaignId, mode: modo, baseUrl },
  })
  return res
}
