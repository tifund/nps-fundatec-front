/// <reference path="../pb_data/types.d.ts" />

/**
 * [TEMPORÁRIO — SELF-TEST] Roda a cada minuto, executa a bateria de testes
 * de segurança via HTTP real (contra o próprio servidor, sem autenticação)
 * e imprime o resultado no log. Remover após a validação.
 */

cronAdd('selftest_seguranca', '*/1 * * * *', () => {
  const results = []

  // Sonda as URLs candidatas e devolve a primeira que responde /api/health
  function probeBaseUrl() {
    const candidates = [
      ($app.settings().meta.appUrl || '').replace(/\/+$/, ''),
      ($os.getenv('PB_INSTANCE_URL') || '').replace(/\/+$/, ''),
      'http://127.0.0.1:8090',
      'http://localhost:8090',
    ]
    for (const cand of candidates) {
      if (cand === '') continue
      try {
        const probe = $http.send({ url: cand + '/api/health', method: 'GET' })
        const st = probe.status_code !== undefined ? probe.status_code : probe.statusCode || 0
        if (st > 0 && st < 500) return cand
      } catch (_) {}
    }
    return ''
  }

  function req(method, path, body) {
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

  function parse(text) {
    try {
      return JSON.parse(text)
    } catch (_) {
      return null
    }
  }

  const baseUrl = probeBaseUrl()
  if (baseUrl === '') {
    console.log('SELFTEST-ERRO: nenhuma base URL respondeu /api/health')
    return
  }

  // 1) Bloqueio anônimo: cada coleção, cada operação
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
      area_id: '',
      pergunta_nps: 't',
      modo_acesso: 'convites',
      status: 'ativa',
      justificativa_detrator: 'nenhuma',
      slug: 't-seg',
    },
    questions: { campaign_id: '', enunciado: 't', tipo: 'texto', ordem: 1 },
    participants: { campaign_id: '', nome: 't', email: 't@t.com', token: 't-seg' },
    dispatches: {
      campaign_id: '',
      tipo: 'inicial',
      destinatario: 't@t.com',
      status: 'registrado',
    },
    system_logs: { acao: 't-seg' },
  }
  for (const col of collections) {
    const ops = [
      ['list', 'GET', '/api/collections/' + col + '/records', null],
      ['view', 'GET', '/api/collections/' + col + '/records/nonexistent0000000', null],
      ['create', 'POST', '/api/collections/' + col + '/records', createBodies[col] || {}],
      ['update', 'PATCH', '/api/collections/' + col + '/records/nonexistent0000000', {}],
      ['delete', 'DELETE', '/api/collections/' + col + '/records/nonexistent0000000', null],
    ]
    for (const op of ops) {
      if (col === 'survey_responses' && op[0] === 'create') continue
      const res = req(op[1], op[2], op[3])
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

  // 2) Create anônimo com token inválido deve falhar
  const resBadToken = req('POST', '/api/collections/survey_responses/records', {
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

  // 3) Create anônimo SEM token em campanha de convites deve falhar
  const resNoToken = req('POST', '/api/collections/survey_responses/records', {
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
  const resList = req('GET', '/api/collections/survey_responses/records')
  results.push({
    test: 'anon survey_responses list',
    status: resList.status,
    pass: resList.status >= 400,
  })
  const resView = req('GET', '/api/collections/survey_responses/records/nonexistent0000000')
  results.push({
    test: 'anon survey_responses view',
    status: resView.status,
    pass: resView.status >= 400,
  })

  // ---- Fluxo real da página de convites (/avaliar/:token) ----
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

    // 5) Contexto por token (rota pública que a página /avaliar/:token carrega)
    const ctxToken = req('GET', '/api/nps/survey-context?token=' + tmpToken)
    const ctxParsed = parse(ctxToken.body)
    results.push({
      test: 'fluxo convites: survey-context por token',
      status: ctxToken.status,
      pass:
        ctxToken.status === 200 &&
        !!ctxParsed &&
        !!ctxParsed.campaign &&
        !!ctxParsed.participant &&
        ctxParsed.participant.nome === 'Selftest Temp',
    })

    // 6) Submissão REAL com token válido
    const sub = req('POST', '/api/collections/survey_responses/records', {
      campaign_id: campId,
      token: tmpToken,
      nota: 9,
      classificacao: 'promotor',
      comentario: 'Auto-teste automatizado de seguranca (removido em seguida).',
    })
    const subParsed = parse(sub.body)
    results.push({
      test: 'fluxo convites: submissão real com token',
      status: sub.status,
      pass: sub.status === 200 && !!subParsed && !!subParsed.id,
    })

    // 7) Participante deve ter ficado marcado como respondido
    let markedOk = false
    try {
      const after = $app.findRecordById('participants', tmpParticipant.id)
      markedOk = after.getBool('respondido')
    } catch (_) {}
    results.push({
      test: 'fluxo convites: participante marcado respondido',
      status: 200,
      pass: markedOk,
    })

    // 8) Reenvio pelo mesmo token deve falhar
    const dup = req('POST', '/api/collections/survey_responses/records', {
      campaign_id: campId,
      token: tmpToken,
      nota: 3,
      classificacao: 'detractor'.replace('ractor', 'ractor') ? 'detrator' : 'detrator',
    })
    results.push({
      test: 'fluxo convites: reenvio pelo mesmo token',
      status: dup.status,
      pass: dup.status >= 400,
    })

    // 9) Contexto após resposta deve indicar ja_respondida
    const ctx2 = req('GET', '/api/nps/survey-context?token=' + tmpToken)
    results.push({
      test: 'fluxo convites: contexto após resposta (ja_respondida)',
      status: ctx2.status,
      pass: ctx2.status === 200 && ctx2.body.indexOf('ja_respondida') !== -1,
    })

    // Limpeza dos dados temporários
    if (subParsed && subParsed.id) {
      try {
        $app.delete($app.findRecordById('survey_responses', subParsed.id))
      } catch (_) {}
    }
    try {
      $app.delete($app.findRecordById('participants', tmpParticipant.id))
    } catch (_) {}
  }

  // ---- Fluxo real da página de link aberto (/avaliar/aberto/:slug) ----
  let tmpOpenCamp = null
  try {
    const campsCol = $app.findCollectionByNameOrId('campaigns')
    tmpOpenCamp = new Record(campsCol)
    tmpOpenCamp.set('nome', 'Selftest Aberta ' + Date.now())
    if (camp1) tmpOpenCamp.set('area_id', camp1.getString('area_id'))
    tmpOpenCamp.set('pergunta_nps', 'Pergunta de auto-teste?')
    tmpOpenCamp.set('modo_acesso', 'link_aberto')
    tmpOpenCamp.set('status', 'ativa')
    tmpOpenCamp.set('justificativa_detrator', 'nenhuma')
    tmpOpenCamp.set('slug', 'selftest-aberta-' + Date.now())
    $app.save(tmpOpenCamp)
  } catch (err) {
    results.push({
      test: 'preparação campanha temp',
      status: 'Selftest Aberta ' + Date.now() ? 0 : 0,
      pass: false,
      error: err.message || String(err),
    })
  }

  if (tmpOpenCamp) {
    const tmpSlug = tmpOpenCamp.getString('slug')

    // 10) Contexto por slug (rota pública que a página /avaliar/aberto/:slug carrega)
    const ctxOpen = req('GET', '/api/nps/survey-context?slug=' + tmpSlug)
    const ctxOpenParsed = parse(ctxOpen.body)
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
    const subOpen = req('POST', '/api/collections/survey_responses/records', {
      campaign_id: tmpOpenCamp.id,
      nota: 7,
      classificacao: 'neutro',
      comentario: 'Auto-teste automatizado de seguranca (removido em seguida).',
    })
    const subOpenParsed = parse(subOpen.body)
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
    if (camp1) tmpClosedCamp.set('area_id', camp1.getString('area_id'))
    tmpClosedCamp.set('pergunta_nps', 'Pergunta de auto-teste?')
    tmpClosedCamp.set('modo_acesso', 'link_aberto')
    tmpClosedCamp.set('status', 'encerrada')
    tmpClosedCamp.set('justificativa_detrator', 'nenhuma')
    tmpClosedCamp.set('slug', 'selftest-encerrada-' + Date.now())
    $app.save(tmpClosedCamp)

    const resClosed = req('POST', '/api/collections/survey_responses/records', {
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

  // ---- Vigência expirada rejeita resposta ----
  let tmpExpiredCamp = null
  try {
    const campsCol = $app.findCollectionByNameOrId('campaigns')
    tmpExpiredCamp = new Record(campsCol)
    tmpExpiredCamp.set('nome', 'Selftest Expirada ' + Date.now())
    if (camp1) tmpExpiredCamp.set('area_id', camp1.getString('area_id'))
    tmpExpiredCamp.set('pergunta_nps', 'Pergunta de auto-teste?')
    tmpExpiredCamp.set('modo_acesso', 'link_aberto')
    tmpExpiredCamp.set('status', 'ativa')
    tmpExpiredCamp.set('justificativa_detrator', 'nenhuma')
    tmpExpiredCamp.set('slug', 'selftest-expirada-' + Date.now())
    tmpExpiredCamp.set('vigencia_fim', '2020-01-01 00:00:00.000Z')
    $app.save(tmpExpiredCamp)

    const resExpired = req(
      'POST',
      '/api/collections/survey_responses/creates' === 'x'
        ? '/x'
        : '/api/collections/survey_responses/records',
      {
        campaign_id: tmpExpiredCamp.id,
        nota: 5,
        classificacao: 'neutro',
      },
    )
    results.push({
      test: 'vigência expirada rejeita resposta',
      status: resExpired.status,
      pass: resExpired.status >= 400,
    })
  } catch (err) {
    results.push({
      test: 'vigência expirada rejeita resposta',
      status: 0,
      pass: false,
      error: err.message || String(err),
    })
  } finally {
    if (tmpExpiredCamp) {
      try {
        $app.delete($app.findRecordById('campaigns', tmpExpiredCamp.id))
      } catch (_) {}
    }
  }

  const failed = results.filter((r) => r.pass === false).length
  console.log(
    'SELFTEST-RESULTADO base=' +
      baseUrl +
      ' total=' +
      results.length +
      ' falhas=' +
      failed +
      ' :: ' +
      JSON.stringify(results),
  )
})
