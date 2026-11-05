/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook para envio de e-mails de convite e registro de ações
 * Rota customizada:
 * POST /backend/v1/nps/send-invite { campaignId, participantId, isResend, baseUrl }
 */

// Nota: a JSVM do PocketBase executa callbacks em pools separados — constantes
// top-level não são visíveis dentro dos handlers. O template padrão do e-mail
// de convite (variáveis {{pnome}} e {{link}}) fica inline nos hooks que o
// usam (criação de campanha e envio de convite).
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
  const campanhaId = (query.campanha_id || '').toString().trim()

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
    } else if (campanhaId) {
      // Link aberto no novo formato: /avaliacao?campanha={id_publico}
      const found = $app.findRecordsByFilter(
        'campaigns',
        'id = {:c} && modo_acesso = {:m}',
        '',
        1,
        0,
        {
          c: campanhaId,
          m: 'link_aberto',
        },
      )
      if (found.length === 0) {
        return e.json(404, { error: 'Campanha não encontrada ou link indisponível.' })
      }
      campaign = found[0]
    } else {
      return e.json(400, { error: 'Informe o token do convite ou o identificador da campanha.' })
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
        id_publico: campaign.id,
        nome: campaign.getString('nome'),
        pergunta_nps: campaign.getString('pergunta_nps'),
        texto_geral: campaign.getString('texto_geral'),
        justificativa_detrator: campaign.getString('justificativa_detrator'),
        justificativa_geral: campaign.getString('justificativa_geral'),
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

// ============================================================
// Campanhas — TRAVAS (server-side, valem para qualquer chamada de API)
//   - status "ativa" exige área vinculada e pergunta NPS preenchida;
//   - vigência "prazo" exige data de encerramento FUTURA;
//   - valores padrão na criação (vigencia_tipo, texto de e-mail);
//   - exclusão bloqueada quando há respostas (só encerrar).
// ============================================================
onRecordCreate((e) => {
  const c = e.record
  if ((c.getString('nome') || '').trim() === '') {
    throw new BadRequestError('Informe o nome da campanha.')
  }
  if ((c.getString('pergunta_nps') || '').trim() === '') {
    throw new BadRequestError('Informe a pergunta NPS da campanha.')
  }
  if (c.getString('area_id') === '') {
    throw new BadRequestError('Selecione a área de negócio da campanha.')
  }
  const slug = (c.getString('slug') || '').trim()
  if (slug === '') {
    throw new BadRequestError('Informe o identificador (slug) da campanha.')
  }
  const duplicado = $app.findRecordsByFilter('campaigns', 'slug = {:s}', '', 1, 0, { s: slug })
  if (duplicado.length > 0) {
    throw new BadRequestError('Já existe uma campanha com este identificador (slug).')
  }
  if (c.getString('status') === '') {
    c.set('status', 'rascunho')
  }
  if (c.getString('vigencia_tipo') === '') {
    c.set('vigencia_tipo', c.getString('vigencia_fim') === '' ? 'continua' : 'prazo')
  }
  if (c.getString('texto_email_convite') === '') {
    c.set(
      'texto_email_convite',
      '<p>Ol&aacute;, <strong>{{pnome}}</strong>,</p>' +
        '<p>Gostar&iacute;amos muito de saber como foi sua experi&ecirc;ncia com a Fundatec. ' +
        'Sua opini&atilde;o &eacute; fundamental para aprimorarmos continuamente nossos servi&ccedil;os.</p>' +
        '<p style="text-align:center; margin: 24px 0;">' +
        '<a href="{{link}}" style="background-color:#0284c7; color:#ffffff; padding:12px 28px; ' +
        'text-decoration:none; border-radius:6px; font-weight:bold; display:inline-block;">' +
        'Responder Avalia&ccedil;&atilde;o Agora</a></p>' +
        '<p style="font-size:12px; color:#64748b;">Se o bot&atilde;o n&atilde;o funcionar, copie e cole ' +
        'este link no navegador: <a href="{{link}}">{{link}}</a></p>' +
        '<p style="font-size:11px; color:#94a3b8; text-align:center;">' +
        'Fundatec &bull; Fundação Universidade Empresa de Tecnologia e Ciências</p>',
    )
  }
  if (c.getString('status') === 'ativa') {
    if (c.getString('area_id') === '' || (c.getString('pergunta_nps') || '').trim() === '') {
      throw new BadRequestError(
        'Só é possível ativar uma campanha com área de negócio vinculada e pergunta NPS preenchida.',
      )
    }
    const vf = c.getString('vigencia_fim')
    if (vf !== '' && vf < new Date().toISOString().replace('T', ' ')) {
      throw new BadRequestError('A data de encerramento da vigência deve ser uma data futura.')
    }
  }
  e.next()
}, 'campaigns')

onRecordUpdate((e) => {
  const c = e.record
  if (c.getString('status') === 'ativa') {
    if (c.getString('area_id') === '' || (c.getString('pergunta_nps') || '').trim() === '') {
      throw new BadRequestError(
        'Só é possível ativar uma campanha com área de negócio vinculada e pergunta NPS preenchida.',
      )
    }
    const vf = c.getString('vigencia_fim')
    if (vf !== '' && vf < new Date().toISOString().replace('T', ' ')) {
      throw new BadRequestError('A data de encerramento da vigência deve ser uma data futura.')
    }
  }
  e.next()
}, 'campaigns')

onRecordDelete((e) => {
  const respostas = $app.findRecordsByFilter(
    'survey_responses',
    "campaign_id = '" + e.record.id + "'",
    '',
    1,
    1,
  )
  if (respostas.length > 0) {
    throw new BadRequestError(
      'Esta campanha possui respostas registradas e não pode ser excluída. ' +
        'Campanhas com respostas podem apenas ser ENCERRADAS.',
    )
  }
  e.next()
}, 'campaigns')

// Participantes: campanhas de link aberto NÃO têm lista de participantes —
// importar/cadastrar é bloqueado server-side também.
onRecordCreate((e) => {
  const p = e.record
  let campaign = null
  try {
    campaign = $app.findRecordById('campaigns', p.getString('campaign_id'))
  } catch (_) {
    throw new BadRequestError('Campanha do participante inválida.')
  }
  if (campaign.getString('modo_acesso') === 'link_aberto') {
    throw new BadRequestError(
      'Campanhas em modo "link aberto" não utilizam participantes individuais.',
    )
  }
  const token = (p.getString('token') || '').trim()
  if (token !== '') {
    const duplicado = $app.findRecordsByFilter('participants', 'token = {:t}', '', 1, 0, {
      t: token,
    })
    if (duplicado.length > 0) {
      throw new BadRequestError('Token de convite duplicado. Gere um novo token.')
    }
  }
  e.next()
}, 'participants')

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

    // TRAVA: campanha encerrada (manualmente ou por vigência vencida)
    // não aceita envios nem reenvios de convite.
    if (campaign.getString('status') !== 'ativa') {
      return e.json(400, {
        error: 'Esta campanha está encerrada e não aceita novos envios de convite.',
      })
    }
    const vigenciaFim = campaign.getString('vigencia_fim')
    if (vigenciaFim !== '' && vigenciaFim < new Date().toISOString().replace('T', ' ')) {
      return e.json(400, {
        error: 'A vigência desta campanha expirou e novos envios não são permitidos.',
      })
    }

    // TRAVA: participante que JÁ RESPONDEU nunca recebe reenvio.
    if (isResend && participant.getBool('respondido')) {
      return e.json(400, {
        error: 'Este participante já respondeu a avaliação e não recebe reenvio.',
      })
    }

    const inviteLink = `${baseUrl}/avaliar/${participant.getString('token')}`

    const emailSubject = isResend
      ? `[Lembrete] Pesquisa de Satisfação NPS - ${campaign.getString('nome')}`
      : `Convite: Pesquisa de Satisfação NPS - ${campaign.getString('nome')}`

    // Corpo do e-mail: texto configurado na campanha (editor rico, com as
    // variáveis {{pnome}} e {{link}}); quando vazio, usa o template Fundatec.
    const pnome =
      participant.getString('nome').trim().split(/\s+/)[0] || participant.getString('nome')
    let corpo = campaign.getString('texto_email_convite')
    if ((corpo || '').trim() === '') {
      corpo =
        '<p>Ol&aacute;, <strong>{{pnome}}</strong>,</p>' +
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
    }
    corpo = corpo.split('{{pnome}}').join(pnome).split('{{link}}').join(inviteLink)

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #0284c7; margin-bottom: 8px;">Fundatec NPS</h2>
          <p style="color: #64748b; font-size: 14px;">Pesquisa de Satisfação e Qualidade</p>
        </div>
        ${corpo}
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center;">
          Fundatec - Fundação Universidade Empresa de Tecnologia e Ciências
        </p>
      </div>
    `

    // Dispara envio de e-mail via Resend (RESEND_API_KEY no backend do Skip)
    let statusEnvio = 'sucesso'
    let detalhe = isResend
      ? 'Reenvio de convite por e-mail realizado.'
      : 'Convite inicial enviado por e-mail com link pessoal.'

    const apiKey = $os.getenv('RESEND_API_KEY') || ''
    const fromEmail = $os.getenv('RESEND_FROM_EMAIL') || 'nao_responder@sistemas.fundatec.org.br'
    const fromName = 'Fundatec NPS'

    if (apiKey === '') {
      statusEnvio = 'falha'
      detalhe = 'Erro ao disparar e-mail: RESEND_API_KEY não configurada no backend.'
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
            to: [participant.getString('email')],
            subject: emailSubject,
            html: htmlBody,
          }),
        })
        const st = res.status_code !== undefined ? res.status_code : res.statusCode || 0
        if (!(st >= 200 && st < 300)) {
          statusEnvio = 'falha'
          let msg = 'HTTP ' + st
          try {
            const parsed = JSON.parse(
              typeof res.body === 'string' ? res.body : JSON.stringify(res.body),
            )
            if (parsed && parsed.message) msg = msg + ': ' + parsed.message
          } catch (_) {}
          detalhe = `Erro ao disparar e-mail: ${msg}`
        }
      } catch (err) {
        statusEnvio = 'falha'
        detalhe = `Erro ao disparar e-mail: ${err.message || String(err)}`
      }
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
    // LGPD: log do sistema sem dados pessoais — o destinatário fica registrado
    // apenas em dispatches (finalidade da campanha).
    log.set(
      'detalhe',
      `Convite ${isResend ? 'reenviado' : 'enviado'} para o participante ${participant.id} na campanha "${campaign.getString('nome')}". Status: ${statusEnvio}`,
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
  // O hook também roda em salvamentos INTERNOS (seeds/migrações via app.save),
  // onde não existe requisição HTTP — e.requestInfo() não está disponível.
  let token = ''
  let viaHttp = true
  try {
    const body = e.requestInfo().body || {}
    token = (body.token || '').toString().trim()
  } catch (_) {
    viaHttp = false
  }

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

  // Nota válida e classificação coerente com a nota (server-side, imune a
  // envio direto à API com classificação falsa que distorceria o NPS).
  const nota = record.getInt('nota')
  if (nota < 0 || nota > 10) {
    throw new BadRequestError('A nota deve estar entre 0 e 10.')
  }
  const classifEsperada = nota >= 9 ? 'promotor' : nota <= 6 ? 'detrator' : 'neutro'
  if (record.getString('classificacao') !== classifEsperada) {
    record.set('classificacao', classifEsperada)
  }

  // Justificativa do detrator: modo "obrigatoria" bloqueia nota 0-6 sem texto
  // TAMBÉM no backend (a página pública já bloqueia no formulário).
  if (
    campaign.getString('justificativa_detrator') === 'obrigatoria' &&
    nota <= 6 &&
    (record.getString('justificativa_detrator') || '').trim() === ''
  ) {
    throw new BadRequestError('A justificativa é obrigatória para notas de 0 a 6.')
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
  } else if (viaHttp) {
    // Via HTTP sem token: apenas campanha ativa de link aberto. O participant_id
    // informado no corpo é descartado (um anônimo não pode marcar convite como
    // respondido nem forjar vínculo).
    record.set('participant_id', '')
    if (campaign.getString('modo_acesso') !== 'link_aberto') {
      throw new BadRequestError(
        'Esta campanha só aceita respostas através do convite individual recebido.',
      )
    }
  } else {
    // Salvamento interno (seed/migração): usa o vínculo já gravado no registro,
    // validando que o participante pertence à campanha.
    const pid = record.getString('participant_id')
    if (pid !== '') {
      try {
        const p = $app.findRecordById('participants', pid)
        if (p.getString('campaign_id') === campaign.id) participant = p
      } catch (_) {}
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
    // LGPD: o log do sistema NÃO registra dados pessoais (nome/e-mail do
    // participante) — quem respondeu fica visível apenas no painel da campanha.
    log.set(
      'detalhe',
      'Avaliação NPS registrada com nota ' +
        record.getInt('nota') +
        ' (' +
        record.getString('classificacao') +
        ') na campanha "' +
        campaign.getString('nome') +
        '".' +
        (participant ? ' Via convite individual.' : ' Via link aberto.'),
    )
    log.set('usuario', participant ? 'convite individual' : 'Visitante (link aberto)')
    $app.save(log)
  } catch (err) {
    console.log('Falha ao registrar log de resposta: ' + (err.message || String(err)))
  }
}, 'survey_responses')

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
