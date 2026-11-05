/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook para envio de e-mails de convite e registro de ações
 * Rota customizada:
 * POST /backend/v1/nps/send-invite { campaignId, participantId, isResend, baseUrl }
 */

routerAdd('POST', '/backend/v1/nps/send-invite', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    return e.json(401, { error: 'Não autorizado' })
  }

  const reqInfo = e.requestInfo()
  const data = reqInfo.body || {}
  const campaignId = data.campaignId
  const participantId = data.participantId
  const isResend = !!data.isResend
  const baseUrl = data.baseUrl || 'https://fundatec.org.br'

  if (!campaignId || !participantId) {
    return e.json(400, { error: 'campaignId e participantId são obrigatórios' })
  }

  try {
    const campaign = $app.findRecordById('campaigns', campaignId)
    const participant = $app.findRecordById('participants', participantId)

    const inviteLink = `${baseUrl}/avaliar/${participant.getString('token')}`

    const emailSubject = isResend
      ? `[Lembrete] Pesquisa de Satisfação NPS - ${campaign.getString('nome')}`
      : `Convite: Pesquisa de Satisfação NPS - ${campaign.getString('nome')}`

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #0284c7; margin-bottom: 8px;">Fundatec NPS</h2>
          <p style="color: #64748b; font-size: 14px;">Pesquisa de Satisfação e Qualidade</p>
        </div>
        <p>Olá, <strong>${participant.getString('nome')}</strong>,</p>
        <p>Gostaríamos muito de saber como foi sua experiência: <em>"${campaign.getString('pergunta_nps')}"</em></p>
        <p>${campaign.getString('texto_geral') || 'Sua avaliação é rápida e nos ajuda a melhorar nossos serviços continuamente.'}</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteLink}" style="background-color: #0284c7; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Responder Avaliação Agora
          </a>
        </div>
        <p style="font-size: 12px; color: #94a3b8;">
          Se o botão não funcionar, copie e cole o link a seguir no seu navegador:<br/>
          <a href="${inviteLink}" style="color: #0284c7;">${inviteLink}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center;">
          Fundatec - Fundação Universidade Empresa de Tecnologia e Ciências
        </p>
      </div>
    `

    // Dispara envio de e-mail pelo serviço de e-mail do Skip Cloud
    let statusEnvio = 'sucesso'
    let detalhe = isResend
      ? 'Reenvio de convite por e-mail realizado.'
      : 'Convite inicial enviado por e-mail com link pessoal.'

    try {
      const email = new MailerMessage({
        from: {
          address: $app.settings().meta.senderAddress || 'noreply@fundatec.org.br',
          name: $app.settings().meta.senderName || 'NPS Fundatec',
        },
        to: [{ address: participant.getString('email'), name: participant.getString('nome') }],
        subject: emailSubject,
        html: htmlBody,
      })
      $app.newMailClient().send(email)
    } catch (err) {
      statusEnvio = 'falha'
      detalhe = `Erro ao disparar e-mail: ${err.message || String(err)}`
    }

    // Registra o envio na coleção dispatches
    const dispatchesCol = $app.findCollectionByNameOrId('dispatches')
    const dispatch = new Record(dispatchesCol)
    dispatch.set('campaign_id', campaign.id)
    dispatch.set('participant_id', participant.id)
    dispatch.set('tipo', isResend ? 'reenvio' : 'inicial')
    dispatch.set('destinatario', participant.getString('email'))
    dispatch.set('status', statusEnvio)
    dispatch.set('detalhe', detalhe)
    $app.save(dispatch)

    // Registra log do sistema
    const logsCol = $app.findCollectionByNameOrId('system_logs')
    const log = new Record(logsCol)
    log.set('acao', isResend ? 'reenvio_convite' : 'envio_convite')
    log.set(
      'detalhe',
      `Convite ${isResend ? 'reenviado' : 'enviado'} para ${participant.getString('email')} na campanha "${campaign.getString('nome')}". Status: ${statusEnvio}`,
    )
    log.set('usuario', authRecord.getString('email') || 'admin')
    $app.save(log)

    return e.json(200, {
      success: statusEnvio === 'sucesso',
      status: statusEnvio,
      detalhe: detalhe,
      inviteLink: inviteLink,
    })
  } catch (err) {
    return e.json(500, { error: err.message || String(err) })
  }
})
