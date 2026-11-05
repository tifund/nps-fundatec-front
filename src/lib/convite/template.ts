import { Campaign, Participant } from '@/types/nps'

/**
 * Template de e-mail de convite NPS Fundatec.
 * Substitui {{pnome}} pelo primeiro nome do participante e {{link}} pelo
 * link pessoal da avaliação. Usado na prévia e na "mensagem pronta" (copiar).
 * O MESMO template vive no hook (nps-invites.pb.js) para o disparo real.
 */

export function primeiroNome(nome: string): string {
  return (nome || '').trim().split(/\s+/)[0] || ''
}

export function linkConvite(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/avaliar/${token}`
}

export function renderConviteHtml(textoCampanha: string, pnome: string, link: string): string {
  const corpo = (textoCampanha || '').split('{{pnome}}').join(pnome).split('{{link}}').join(link)
  return `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 8px;">
  <div style="text-align: center; margin-bottom: 24px;">
    <h2 style="color: #0284c7; margin-bottom: 8px;">Fundatec NPS</h2>
    <p style="color: #64748b; font-size: 14px;">Pesquisa de Satisfação e Qualidade</p>
  </div>
  ${corpo}
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
  <p style="font-size: 11px; color: #94a3b8; text-align: center;">
    Fundatec - Fundação Universidade Empresa de Tecnologia e Ciências
  </p>
</div>`
}

/** Texto simples (WhatsApp, Teams etc.) com o link embutido. */
export function conviteParaTexto(textoCampanha: string, pnome: string, link: string): string {
  const base = (textoCampanha || '').split('{{pnome}}').join(pnome).split('{{link}}').join(link)
  // Remove tags do editor rico para um texto colável em outros canais
  const semTags = base
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&atilde;/gi, 'ã')
    .replace(/&otilde;/gi, 'õ')
    .replace(/&ccedil;/gi, 'ç')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return `${semTags}\n\n${link}`
}

/** Assunto do e-mail de convite (inicial x reenvio). */
export function assuntoConvite(campaign: Campaign, isResend: boolean): string {
  return isResend
    ? `[Lembrete] Pesquisa de Satisfação NPS - ${campaign.nome}`
    : `Convite: Pesquisa de Satisfação NPS - ${campaign.nome}`
}

/** Prévia do e-mail para um participante de exemplo. */
export function previewParaParticipante(
  campaign: Campaign,
  participant: Participant | null,
  baseUrl: string,
): { assunto: string; html: string } {
  const pnome = participant ? primeiroNome(participant.nome) : '{{pnome}}'
  const link = participant ? linkConvite(baseUrl, participant.token) : '.../avaliar/{{token}}'
  return {
    assunto: assuntoConvite(campaign, false),
    html: renderConviteHtml(campaign.texto_email_convite, pnome, link),
  }
}
