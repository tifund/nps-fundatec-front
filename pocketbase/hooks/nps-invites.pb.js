/// <reference path="../pb_data/types.d.ts" />

/**
 * Disparo em lote de convites por e-mail (Resend) para uma campanha.
 * Rota: POST /backend/v1/nps/send-invites-batch { campaignId, mode, baseUrl }
 *   mode = "inicial"      -> apenas participantes que ainda NÃO receberam envio
 *   mode = "reenvio_todos"-> TODOS os convocados (independente de já ter recebido)
 *
 * TRAVAS (server-side):
 *   - campanha precisa estar ATIVA e dentro da vigência;
 *   - modo link aberto não tem envio individual;
 *   - participante que JÁ RESPONDEU nunca recebe e-mail (nenhum modo);
 *   - erro em um e-mail não interrompe o lote (status "falha" + detalhe).
 *
 * LOG: cada envio grava um registro em dispatches (data/hora, destinatário,
 * tipo inicial/reenvio, status enviado/erro) — nada é apagado.
 *
 * Requer o segredo RESEND_API_KEY (Skip Cloud, $os.getenv).
 */

routerAdd('POST', '/backend/v1/nps/send-invites-batch', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    return e.json(401, { error: 'Não autorizado' })
  }

  const data = e.requestInfo().body || {}
  const campaignId = data.campaignId
  const mode = data.mode === 'reenvio_todos' ? 'reenvio_todos' : 'inicial'
  const baseUrl = (data.baseUrl || '').toString().replace(/\/+$/, '') || 'https://fundatec.org.br'

  if (!campaignId) {
    return e.json(400, { error: 'campaignId é obrigatório' })
  }

  try {
    const campaign = $app.findRecordById('campaigns', campaignId)

    // TRAVA: só campanha ativa envia convites
    if (campaign.getString('status') !== 'ativa') {
      return e.json(400, {
        error: 'Esta campanha está encerrada e não aceita novos envios de convite.',
      })
    }
    // TRAVA: vigência expirada bloqueia o disparo
    const vigenciaFim = campaign.getString('vigencia_fim')
    if (vigenciaFim !== '' && vigenciaFim < new Date().toISOString().replace('T', ' ')) {
      return e.json(400, {
        error: 'A vigência desta campanha expirou e novos envios não são permitidos.',
      })
    }
    // TRAVA: link aberto não tem envio individual
    if (campaign.getString('modo_acesso') !== 'convites') {
      return e.json(400, {
        error: 'Campanhas em modo "link aberto" não utilizam envio de convites individuais.',
      })
    }

    // Texto do e-mail configurado na campanha ({{pnome}} e {{link}})
    const textoCampanha = (campaign.getString('texto_email_convite') || '').trim()
    const campaignName = campaign.getString('nome')
    const isResendMode = mode === 'reenvio_todos'
    const emailSubject = isResendMode
      ? '[Lembrete] Pesquisa de Satisfação NPS - ' + campaignName
      : 'Convite: Pesquisa de Satisfação NPS - ' + campaignName

    const templateCorpo =
      textoCampanha !== ''
        ? textoCampanha
        : '<p>Ol&aacute;, <strong>{{pnome}}</strong>,</p>' +
          '<p>Gostar&iacute;amos muito de saber como foi sua experi&ecirc;ncia com a Fundatec. ' +
          'Sua opini&atilde;o &eacute; fundamental para aprimorarmos continuamente nossos servi&ccedil;os.</p>' +
          '<p style="text-align:center; margin: 24px 0;">' +
          '<a href="{{link}}" style="background-color:#0284c7; color:#ffffff; padding:12px 28px; ' +
          'text-decoration:none; border-radius:6px; font-weight:bold; display:inline-block;">' +
          'Responder Avalia&ccedil;&atilde;o Agora</a></p>' +
          '<p style="font-size:12px; color:#64748b;">Se o bot&atilde;o n&atilde;o funcionar, copie e cole ' +
          'este link no navegador: <a href="{{link}}">{{link}}</a></p>' +
          '<p style="font-size:11px; color:#94a3b8; text-align:center;">' +
          'Fundatec &bull; Fundação Universidade Empresa de Tecnologia e Ciências</p>'

    // Seleção de participantes:
    //  - "inicial": quem ainda não tem dispatch registrado
    //  - "reenvio_todos": todos os convocados
    // Em ambos os casos, quem JÁ RESPONDEU fica de fora (trava do reenvio).
    const todos = $app.findRecordsByFilter('participants', 'campaign_id = {:c}', 'created', 0, 0, {
      c: campaignId,
    })

    // dispatches registrados para esta campanha (para saber quem já recebeu)
    const enviados = {}
    const dispatchesCol = $app.findCollectionByNameOrId('dispatches')
    const existing = $app.findRecordsByFilter(
      'dispatches',
      "campaign_id = '" + campaignId + "'",
      '',
      0,
      0,
    )
    for (const d of existing) {
      const pid = d.getString('participant_id')
      if (pid !== '') {
        enviados[pid] = true
      }
    }

    const alvos = []
    let jaRespondido = 0
    let jaRecebido = 0
    for (const p of todos) {
      if (p.getBool('respondido')) {
        jaRespondido++
        continue
      }
      if (mode === 'inicial' && enviados[p.id]) {
        jaRecebido++
        continue
      }
      alvos.push(p)
    }

    if (alvos.length === 0) {
      const motivo =
        jaRespondido > 0
          ? ' Todos os demais participantes já responderam ou já receberam o convite.'
          : ''
      return e.json(200, {
        enviados: 0,
        erros: 0,
        ignorados: jaRespondido + jaRecebido,
        detalhe: 'Nenhum participante elegível para este disparo.' + motivo,
      })
    }

    // Remetente do sistema (Resend exige domínio verificado na conta da chave)
    const fromEmail = $os.getenv('RESEND_FROM_EMAIL') || 'nao_responder@sistemas.fundatec.org.br'
    const fromName = 'Fundatec NPS'
    const apiKey = $os.getenv('RESEND_API_KEY') || ''

    let enviadosOk = 0
    let erros = 0
    const resultados = []

    for (const p of alvos) {
      const link = baseUrl + '/avaliar/' + p.getString('token')
      const pnome = p.getString('nome').trim().split(/\s+/)[0] || p.getString('nome')
      const corpo = templateCorpo.split('{{pnome}}').join(pnome).split('{{link}}').join(link)

      const htmlBody =
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 8px;">' +
        '<div style="text-align: center; margin-bottom: 24px;">' +
        '<h2 style="color: #0284c7; margin-bottom: 8px;">Fundatec NPS</h2>' +
        '<p style="color: #64748b; font-size: 14px;">Pesquisa de Satisfação e Qualidade</p>' +
        '</div>' +
        corpo +
        '<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />' +
        '<p style="font-size: 11px; color: #94a3b8; text-align: center;">' +
        'Fundatec - Fundação Universidade Empresa de Tecnologia e Ciências</p>' +
        '</div>'

      let statusEnvio = 'sucesso'
      let detalhe = isResendMode
        ? 'Reenvio de convite por e-mail (disparo em lote).'
        : 'Convite inicial enviado por e-mail com link pessoal.'

      if (apiKey === '') {
        statusEnvio = 'falha'
        detalhe = 'Erro ao disparar e-mail: RESEND_API_KEY não configurada no backend.'
        erros++
      } else {
        try {
          const res = $http.send({
            url: 'https://api.resend.com/emails',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + apiKey,
            },
            body: JSON.stringify({
              from: fromName + ' <' + fromEmail + '>',
              to: [p.getString('email')],
              subject: emailSubject,
              html: htmlBody,
            }),
          })
          const st = res.status_code !== undefined ? res.status_code : res.statusCode || 0
          if (st >= 200 && st < 300) {
            enviadosOk++
          } else {
            statusEnvio = 'falha'
            let msg = 'HTTP ' + st
            try {
              const parsed = JSON.parse(
                typeof res.body === 'string' ? res.body : JSON.stringify(res.body),
              )
              if (parsed && parsed.message) msg = msg + ': ' + parsed.message
            } catch (_) {}
            detalhe = 'Erro ao disparar e-mail: ' + msg
            erros++
          }
        } catch (err) {
          statusEnvio = 'falha'
          detalhe = 'Erro ao disparar e-mail: ' + (err.message || String(err))
          erros++
        }
      }

      // LOG do disparo (nada é apagado do log)
      try {
        const dispatch = new Record(dispatchesCol)
        dispatch.set('campaign_id', campaignId)
        dispatch.set('participant_id', p.id)
        dispatch.set('tipo', isResendMode ? 'reenvio' : 'inicial')
        dispatch.set('destinatario', p.getString('email'))
        dispatch.set('status', statusEnvio)
        dispatch.set('detalhe', detalhe)
        $app.save(dispatch)
      } catch (logErr) {
        console.log('Falha ao registrar dispatch: ' + (logErr.message || String(logErr)))
      }

      resultados.push({
        participante: p.id,
        status: statusEnvio,
      })
    }

    // Log do sistema (resumo do disparo)
    try {
      const logsCol = $app.findCollectionByNameOrId('system_logs')
      const log = new Record(logsCol)
      log.set('acao', isResendMode ? 'reenvio_convites_lote' : 'envio_convites_lote')
      log.set(
        'detalhe',
        (isResendMode ? 'Reenvio' : 'Envio') +
          ' em lote na campanha "' +
          campaignName +
          '": ' +
          enviadosOk +
          ' enviado(s), ' +
          erros +
          ' erro(s). Usuario: ' +
          (authRecord.getString('email') || 'admin'),
      )
      log.set('usuario', authRecord.getString('email') || 'admin')
      $app.save(log)
    } catch (_) {}

    return e.json(200, {
      enviados: enviadosOk,
      erros: erros,
      ignorados: jaRespondido + jaRecebido,
      jaRespondidos: jaRespondido,
      resultados: resultados,
    })
  } catch (err) {
    return e.json(500, { error: err.message || String(err) })
  }
})
