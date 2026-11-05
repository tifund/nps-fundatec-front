/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook para envio de e-mails de convite e registro de ações
 * Rota customizada:
 * POST /backend/v1/nps/send-invite { campaignId, participantId, isResend, baseUrl }
 */

// ============================================================
// GET /backend/v1/nps/survey-context?token=... OU ?slug=...
// Rota pública que devolve o contexto da avaliação (campanha,
// participante e perguntas adicionais) para a página pública.
// Substitui a leitura pública direta de participants/campaigns,
// que agora é bloqueada pelas regras de API fechadas.
// ============================================================
routerAdd('GET', '/backend/v1/nps/survey-context', (e) => {
  const info = e.requestInfo()
  const query = info.query || {}
  const token = (query.token || '').toString().trim()
  const slug = (query.slug || '').toString().trim()

  try {
    let participant = null
    let campaign = null

    if (token) {
      const found = $app.findRecordsByFilter('participants', 'token = {:t}', '', 1, 0, { t: token })
      if (found.length === 0) {
        return e.json(404, { error: 'Convite não encontrado ou link de avaliação inválido.' })
      }
      participant = found[0]
      campaign = $app.findRecordById('campaigns', participant.getString('campaign_id'))
    } else if (slug) {
      const found = $app.findRecordsByFilter('campaigns', 'slug = {:s}', '', 1, 0, { s: slug })
      if (found.length === 0) {
        return e.json(404, { error: 'Campanha não encontrada ou link indisponível.' })
      }
      campaign = found[0]
    } else {
      return e.json(400, { error: 'Informe o token do convite ou o slug da campanha.' })
    }

    // Estado de encerramento: status manual ou vigência expirada
    const nowStr = new Date().toISOString().replace('T', ' ')
    const vigenciaFim = campaign.getString('vigencia_fim')
    let closedReason = ''
    if (campaign.getString('status') !== 'ativa') {
      closedReason = 'encerrada'
    } else if (vigenciaFim !== '' && vigenciaFim < nowStr) {
      closedReason = 'expirada'
    } else if (participant && participant.getBool('respondido')) {
      closedReason = 'ja_respondida'
    }

    // Nome da área (para o selo do cabeçalho da avaliação)
    let areaNome = ''
    const areaId = campaign.getString('area_id')
    if (areaId !== '') {
      try {
        const area = $app.findRecordById('areas', areaId)
        areaNome = area.getString('nome')
      } catch (_) {}
    }

    // Perguntas adicionais (somente se a campanha ainda está aberta)
    const questions = []
    if (closedReason === '') {
      const qs = $app.findRecordsByFilter('questions', 'campaign_id = {:c}', 'ordem', 500, 0, {
        c: campaign.id,
      })
      for (const q of qs) {
        questions.push({
          id: q.id,
          enunciado: q.getString('enunciado'),
          tipo: q.getString('tipo'),
          obrigatoria: q.getBool('obrigatoria'),
          ordem: q.getInt('ordem'),
        })
      }
    }

    return e.json(200, {
      campaign: {
        id: campaign.id,
        nome: campaign.getString('nome'),
        pergunta_nps: campaign.getString('pergunta_nps'),
        texto_geral: campaign.getString('texto_geral'),
        justificativa_detrator: campaign.getString('justificativa_detrator'),
        status: campaign.getString('status'),
        vigencia_fim: vigenciaFim,
        modo_acesso: campaign.getString('modo_acesso'),
        area_nome: areaNome,
      },
      participant: participant
        ? {
            id: participant.id,
            nome: participant.getString('nome'),
            respondido: participant.getBool('respondido'),
          }
        : null,
      questions: questions,
      closed_reason: closedReason,
    })
  } catch (err) {
    return e.json(500, { error: err.message || String(err) })
  }
})

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

// ============================================================
// onRecordCreate survey_responses
// Validação obrigatória ANTES de gravar qualquer resposta:
//   - campanha existente, ativa e dentro da vigência;
//   - com token: convite existente nesta campanha e que ainda
//     NÃO tenha respondido; marca participante.respondido = true;
//   - sem token: permitido somente se a campanha for ativa com
//     modo_acesso = link_aberto (convites individuais rejeitam);
//   - registra log do sistema (o create público em system_logs
//     foi fechado; o log agora é escrito aqui, server-side).
// Rejeita com 400 qualquer caso inválido.
// ============================================================
onRecordCreate((e) => {
  const record = e.record
  const body = e.requestInfo().body || {}
  const token = (body.token || '').toString().trim()

  // Campanha informada deve existir
  let campaign = null
  try {
    campaign = $app.findRecordById('campaigns', record.getString('campaign_id'))
  } catch (_) {
    throw new BadRequestError('Campanha de avaliação inválida.')
  }

  // Campanha precisa estar ativa
  if (campaign.getString('status') !== 'ativa') {
    throw new BadRequestError('Esta campanha de avaliação já foi encerrada.')
  }

  // Vigência
  const nowStr = new Date().toISOString().replace('T', ' ')
  const vigenciaFim = campaign.getString('vigencia_fim')
  if (vigenciaFim !== '' && vigenciaFim < nowStr) {
    throw new BadRequestError('O período de recebimento de respostas desta campanha expirou.')
  }

  let participant = null
  if (token !== '') {
    // Modo convite: token deve existir e pertencer à campanha
    const found = $app.findRecordsByFilter(
      'participants',
      'token = {:t} && campaign_id = {:c}',
      '',
      1,
      0,
      { t: token, c: campaign.id },
    )
    if (found.length === 0) {
      throw new BadRequestError('Convite inválido, inexistente ou não pertence a esta campanha.')
    }
    participant = found[0]
    if (participant.getBool('respondido')) {
      throw new BadRequestError('Este convite já foi utilizado para envio de avaliação.')
    }
    // Vínculo da resposta com o participante do convite
    record.set('participant_id', participant.id)
  } else {
    // Sem token: apenas campanha ativa de link aberto
    if (campaign.getString('modo_acesso') !== 'link_aberto') {
      throw new BadRequestError(
        'Esta campanha só aceita respostas através do convite individual recebido.',
      )
    }
  }

  // Grava a resposta
  e.next()

  // No modo convite, marca o participante como respondido
  if (participant) {
    participant.set('respondido', true)
    participant.set('respondido_em', nowStr)
    $app.save(participant)
  }

  // Log do sistema (server-side; o create público em system_logs foi fechado)
  try {
    const logsCol = $app.findCollectionByNameOrId('system_logs')
    const log = new Record(logsCol)
    log.set('acao', 'resposta_enviada')
    log.set(
      'detalhe',
      'Avaliação NPS registrada com nota ' +
        record.getInt('nota') +
        ' (' +
        record.getString('classificacao') +
        ') na campanha "' +
        campaign.getString('nome') +
        '".' +
        (participant ? ' Participante: ' + participant.getString('nome') + '.' : ' Link aberto.'),
    )
    log.set('usuario', participant ? participant.getString('email') : 'Visitante (link aberto)')
    $app.save(log)
  } catch (err) {
    console.log('Falha ao registrar log de resposta: ' + (err.message || String(err)))
  }
}, 'survey_responses')

// ============================================================
// [TEMPORÁRIO — SELF-TEST] GET /backend/v1/nps/security-selftest
// Valida o bloqueio anônimo por coleção/operação e o fluxo real
// das duas páginas públicas (token e link aberto). Remove após uso.
// ============================================================
routerAdd('GET', '/backend/v1/nps/security-selftest', (e) => {
  const results = []
  const candidates = [
    ($app.settings().meta.appUrl || '').replace(/\/+$/, ''),
    ($os.getenv('PB_INSTANCE_URL') || '').replace(/\/+$/, ''),
  ].filter((u) => u !== '')
  let baseUrl = candidates[0] || ''
  let probed = null
  if (candidates.length > 1) {
    for (const cand of candidates) {
      try {
        const probe = $http.send({ url: cand + '/api/health', method: 'GET' })
        const st = probe.status_code !== undefined ? probe.status_code : probe.statusCode || 0
        if (st > 0 && st < 500) {
          baseUrl = cand
          probed = { url: cand, status: st }
          break
        }
      } catch (_) {}
    }
  }
  if (baseUrl === '') {
    return e.json(500, { error: 'appUrl indefinido' })
  }

  function tryReq(method, path, body) {
    try {
      const res = $http.send({
        url: baseUrl + path,
        method: method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : null,
      })
      let text = ''
      if (res.body !== undefined && res.body !== null) {
        text = typeof res.body === 'string' ? res.body : JSON.stringify(res.body)
      }
      const status = res.status_code !== undefined ? res.status_code : res.statusCode || 0
      return { status: status, body: text }
    } catch (err) {
      return { status: 0, body: err.message || String(err) }
    }
  }

  function parseBody(text) {
    try {
      return JSON.parse(text)
    } catch (_) {
      return null
    }
  }

  // 1) Bloqueio anônimo: cada coleção, cada operação (survey_responses create
  //    é a única exceção pública e é testada à parte, com validação do hook)
  const collections = [
    'users',
    'areas',
    'campaigns',
    'questions',
    'participants',
    'dispatches',
    'survey_responses',
    'system_logs',
  ]
  const createBodies = {
    users: { email: 't@t.com', password: 'x', passwordConfirm: 'x' },
    areas: { nome: 'teste-seguranca' },
    campaigns: {
      nome: 't',
      pergunta_nps: 't',
      modo_acesso: 'convites',
      status: 'ativa',
      justificativa_detrator: 'nenhuma',
      slug: 't-seg',
    },
    questions: { enunciado: 't', tipo: 'texto', ordem: 1 },
    participants: { nome: 't', email: 't@t.com', token: 't-seg' },
    dispatches: { tipo: 'inicial', destinatario: 't@t.com', status: 'registrado' },
    system_logs: { acao: 't-seg' },
  }
  for (const col of collections) {
    const ops = [
      ['list', 'GET', '/backend/v1/collections/' + col + '/records', null],
      ['view', 'GET', '/backend/v1/collections/' + col + '/records/nonexistent0000000', null],
      ['create', 'POST', '/backend/v1/collections/' + col + '/records', createBodies[col] || {}],
      ['update', 'PATCH', '/backend/v1/collections/' + col + '/records/nonexistent0000000', {}],
      ['delete', 'DELETE', '/backend/v1/collections/' + col + '/records/nonexistent0000000', null],
    ]
    for (const op of ops) {
      let res
      if (col === 'survey_responses' && op[0] === 'create') {
        continue // testado nos blocos 2-4 abaixo
      }
      res = tryReq(op[1], op[2], op[3])
      results.push({
        test: 'anon ' + col + ' ' + op[0],
        status: res.status,
        pass: res.status >= 400,
      })
    }
  }

  // Campanha real de convites (seed)
  let camp1 = null
  try {
    camp1 = $app.findFirstRecordByFilter('campaigns', 'slug = {:s}', { s: 'nps-ensino-2025-1' })
  } catch (_) {}
  const campId = camp1 ? camp1.id : ''

  // 2) Create anônimo com token inválido deve falhar 400
  const resBadToken = tryReq('POST', '/backend/v1/collections/survey_responses/records', {
    campaign_id: campId,
    token: 'tok_INVALIDO_teste_seguranca',
    nota: 5,
    classificacao: 'neutro',
  })
  results.push({
    test: 'survey_responses create com token inválido',
    status: resBadToken.status,
    pass: resBadToken.status >= 400,
  })

  // 3) Create anônimo SEM token em campanha de convites deve falhar 400
  const resNoToken = tryReq('POST', '/backend/v1/collections/survey_responses/records', {
    campaign_id: campId,
    nota: 5,
    classificacao: 'neutro',
  })
  results.push({
    test: 'survey_responses create sem token em campanha de convites',
    status: resNoToken.status,
    pass: resNoToken.status >= 400,
  })

  // 4) survey_responses list/view anônimo deve bloquear
  const resList = tryReq('GET', '/backend/v1/collections/survey_responses/records')
  results.push({
    test: 'anon survey_responses list',
    status: resList.status,
    pass: resList.status >= 400,
  })
  const resView = tryReq(
    'GET',
    '/backend/v1/collections/survey_responses/records/nonexistent0000000',
  )
  results.push({
    test: 'anon survey_responses view',
    status: resView.status,
    pass: resView.status >= 400,
  })

  // ---- Fluxo real da página de convites (/avaliar/:token) ----
  // Participante TEMPORÁRIO criado só para o teste (removido no fim, junto
  // com a resposta criada), para não alterar os dados de demonstração.
  let tmpParticipant = null
  try {
    const partsCol = $app.findCollectionByNameOrId('participants')
    tmpParticipant = new Record(partsCol)
    tmpParticipant.set('campaign_id', campId)
    tmpParticipant.set('nome', 'Selftest Temp')
    tmpParticipant.set('email', 'selftest.temp@exemplo.com')
    tmpParticipant.set('token', 'tok_selftest_' + Date.now())
    tmpParticipant.set('respondido', false)
    $app.save(tmpParticipant)
  } catch (err) {
    results.push({
      test: 'preparação participante temp',
      status: 0,
      pass: false,
      error: err.message || String(err),
    })
  }

  if (tmpParticipant) {
    const tmpToken = tmpParticipant.getString('token')

    // 5) Contexto por token (o que a página /avaliar/:token carrega)
    const ctxToken = tryReq('GET', '/backend/v1/nps/survey-context?token=' + tmpToken)
    const ctxParsed = parseBody(ctxToken.body)
    results.push({
      test: 'fluxo convites: survey-context por token',
      status: ctxToken.status,
      pass:
        ctxToken.status === 200 &&
        !!ctxParsed &&
        ctxParsed.campaign &&
        ctxParsed.participant &&
        ctxParsed.participant.nome === 'Selftest Temp',
    })

    // 6) Submissão REAL com token válido
    const sub = tryReq('POST', '/backend/v1/collections/survey_responses/records', {
      campaign_id: campId,
      token: tmpToken,
      nota: 9,
      classificacao: 'promotor',
      comentario: 'Auto-teste automatizado de seguranca (removido em seguida).',
    })
    const subParsed = parseBody(sub.body)
    results.push({
      test: 'fluxo convites: submissão real com token',
      status: sub.status,
      pass: sub.status === 200 && !!subParsed && !!subParsed.id,
    })

    // 7) Participante deve ter ficado marcado como respondido
    let markedOk = false
    let createdResponseId = ''
    try {
      const after = $app.findRecordById('participants', tmpParticipant.id)
      markedOk = after.getBool('respondido')
    } catch (_) {}
    if (subParsed && subParsed.id) {
      createdResponseId = subParsed.id
    }
    results.push({
      test: 'fluxo convites: participante marcado respondido',
      status: 200,
      pass: markedOk,
    })

    // 8) Reenvio pelo mesmo token deve falhar 400
    const dup = tryReq('POST', '/backend/v1/collections/survey_responses/records', {
      campaign_id: campId,
      token: tmpToken,
      nota: 3,
      classificacao: 'detrator',
    })
    results.push({
      test: 'fluxo convites: reenvio pelo mesmo token',
      status: dup.status,
      pass: dup.status >= 400,
    })

    // 9) Contexto após resposta deve indicar ja_respondida
    const ctx2 = tryReq('GET', '/backend/v1/nps/survey-context?token=' + tmpToken)
    results.push({
      test: 'fluxo convites: contexto após resposta (ja_respondida)',
      status: ctx2.status,
      pass: ctx2.status === 200 && ctx2.body.indexOf('ja_respondida') !== -1,
    })

    // Limpeza dos dados temporários do teste
    if (createdResponseId !== '') {
      try {
        $app.delete($app.findRecordById('survey_responses', createdResponseId))
      } catch (_) {}
    }
    try {
      $app.delete($app.findRecordById('participants', tmpParticipant.id))
    } catch (_) {}
  }

  // ---- Fluxo real da página de link aberto (/avaliar/aberto/:slug) ----
  // Campanha TEMPORÁRIA ativa de link aberto (removida no fim).
  let tmpOpenCamp = null
  try {
    const campsCol = $app.findCollectionByNameOrId('campaigns')
    tmpOpenCamp = new Record(campsCol)
    tmpOpenCamp.set('nome', 'Selftest Aberta ' + Date.now())
    if (camp1) {
      tmpOpenCamp.set('area_id', camp1.getString('area_id'))
    }
    tmpOpenCamp.set('pergunta_nps', 'Pergunta de auto-teste?')
    tmpOpenCamp.set('modo_acesso', 'link_aberto')
    tmpOpenCamp.set('status', 'ativa')
    tmpOpenCamp.set('justificativa_detrator', 'nenhuma')
    tmpOpenCamp.set('slug', 'selftest-aberta-' + Date.now())
    $app.save(tmpOpenCamp)
  } catch (err) {
    results.push({
      test: 'preparação campanha temp',
      status: 0,
      pass: false,
      error: err.message || String(err),
    })
  }

  if (tmpOpenCamp) {
    const tmpSlug = tmpOpenCamp.getString('slug')

    // 10) Contexto por slug (o que a página /avaliar/aberto/:slug carrega)
    const ctxOpen = tryReq('GET', '/backend/v1/nps/survey-context?slug=' + tmpSlug)
    const ctxOpenParsed = parseBody(ctxOpen.body)
    results.push({
      test: 'fluxo link aberto: survey-context por slug',
      status: ctxOpen.status,
      pass:
        ctxOpen.status === 200 &&
        !!ctxOpenParsed &&
        !!ctxOpenParsed.campaign &&
        ctxOpenParsed.campaign.modo_acesso === 'link_aberto',
    })

    // 11) Submissão REAL sem token em campanha de link aberto
    const subOpen = tryReq('POST', '/backend/v1/collections/survey_responses/records', {
      campaign_id: tmpOpenCamp.id,
      nota: 7,
      classificacao: 'neutro',
      comentario: 'Auto-teste automatizado de seguranca (removido em seguida).',
    })
    const subOpenParsed = parseBody(subOpen.body)
    results.push({
      test: 'fluxo link aberto: submissão real sem token',
      status: subOpen.status,
      pass: subOpen.status === 200 && !!subOpenParsed && !!subOpenParsed.id,
    })

    // Limpeza
    if (subOpenParsed && subOpenParsed.id) {
      try {
        $app.delete($app.findRecordById('survey_responses', subOpenParsed.id))
      } catch (_) {}
    }
    try {
      $app.delete($app.findRecordById('campaigns', tmpOpenCamp.id))
    } catch (_) {}
  }

  // ---- Campanha encerrada rejeita resposta ----
  let tmpClosedCamp = null
  try {
    const campsCol = $app.findCollectionByNameOrId('campaigns')
    tmpClosedCamp = new Record(campsCol)
    tmpClosedCamp.set('nome', 'Selftest Encerrada ' + Date.now())
    if (camp1) {
      tmpClosedCamp.set('area_id', camp1.getString('area_id'))
    }
    tmpClosedCamp.set('pergunta_nps', 'Pergunta de auto-teste?')
    tmpClosedCamp.set('modo_acesso', 'link_aberto')
    tmpClosedCamp.set('status', 'encerrada')
    tmpClosedCamp.set('justificativa_detrator', 'nenhuma')
    tmpClosedCamp.set('slug', 'selftest-encerrada-' + Date.now())
    $app.save(tmpClosedCamp)

    const resClosed = tryReq('POST', '/backend/v1/collections/survey_responses/records', {
      campaign_id: tmpClosedCamp.id,
      nota: 5,
      classificacao: 'neutro',
    })
    results.push({
      test: 'campanha encerrada rejeita resposta',
      status: resClosed.status,
      pass: resClosed.status >= 400,
    })
  } catch (err) {
    results.push({
      test: 'campanha encerrada rejeita resposta',
      status: 0,
      pass: false,
      error: err.message || String(err),
    })
  } finally {
    if (tmpClosedCamp) {
      try {
        $app.delete($app.findRecordById('campaigns', tmpClosedCamp.id))
      } catch (_) {}
    }
  }

  const failed = results.filter((r) => r.pass === false).length
  return e.json(200, {
    baseUrl: baseUrl,
    summary: { total: results.length, failed: failed },
    results: results,
  })
})

// ============================================================
// onRecordDelete areas — PROTEÇÃO DE INTEGRIDADE
// Uma área com campanhas vinculadas NÃO pode ser excluída
// (vale para qualquer chamada de API, inclusive com token de
// admin/gestor). Nesses casos a área só pode ser desativada.
// ============================================================
onRecordDelete((e) => {
  const vinculadas = $app.findRecordsByFilter(
    'campaigns',
    "area_id = '" + e.record.id + "'",
    '',
    1,
    1,
  )
  if (vinculadas.length > 0) {
    throw new BadRequestError(
      'Esta área possui campanhas vinculadas e não pode ser excluída. ' +
        'Somente áreas sem campanhas podem ser excluídas — desative esta área para impedir novas campanhas.',
    )
  }
  e.next()
}, 'areas')

// ============================================================
// onRecordCreate / onRecordUpdate areas — nome único com mensagem
// amigável (o índice UNIQUE já existe; aqui antecipamos a validação
// de forma case-insensitive para devolver erro claro ao usuário).
// Nota: funções top-level não são visíveis dentro dos callbacks do
// JSVM, então a lógica fica inline em cada handler.
// ============================================================
onRecordCreate((e) => {
  const nome = (e.record.getString('nome') || '').trim().toLowerCase()
  if (nome === '') {
    throw new BadRequestError('Informe o nome da área de negócio.')
  }
  const todas = $app.findRecordsByFilter('areas', "id != ''", '', 500, 0)
  for (const a of todas) {
    if (a.getString('nome').trim().toLowerCase() === nome) {
      throw new BadRequestError('Já existe uma área de negócio com este nome.')
    }
  }
  e.next()
}, 'areas')

onRecordUpdate((e) => {
  const nome = (e.record.getString('nome') || '').trim().toLowerCase()
  if (nome === '') {
    throw new BadRequestError('Informe o nome da área de negócio.')
  }
  const todas = $app.findRecordsByFilter('areas', "id != ''", '', 500, 0)
  for (const a of todas) {
    if (a.id === e.record.id) continue
    if (a.getString('nome').trim().toLowerCase() === nome) {
      throw new BadRequestError('Já existe uma área de negócio com este nome.')
    }
  }
  e.next()
}, 'areas')
