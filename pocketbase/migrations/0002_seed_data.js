migrate(
  (app) => {
    // 1. Seed Usuário Admin
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    try {
      app.findAuthRecordByEmail('_pb_users_auth_', 'ti@fundatec.org.br')
    } catch (_) {
      const admin = new Record(users)
      admin.setEmail('ti@fundatec.org.br')
      admin.setPassword('Skip@Pass')
      admin.setVerified(true)
      admin.set('name', 'TI Fundatec')
      app.save(admin)
    }

    // 2. Seed Áreas de Negócio
    const areasCol = app.findCollectionByNameOrId('areas')
    let areaEnsino
    try {
      areaEnsino = app.findFirstRecordByData('areas', 'nome', 'Fundatec Ensino')
    } catch (_) {
      areaEnsino = new Record(areasCol)
      areaEnsino.set('nome', 'Fundatec Ensino')
      areaEnsino.set('ativa', true)
      app.save(areaEnsino)
    }

    let areaConcursos
    try {
      areaConcursos = app.findFirstRecordByData('areas', 'nome', 'Fundatec Concursos')
    } catch (_) {
      areaConcursos = new Record(areasCol)
      areaConcursos.set('nome', 'Fundatec Concursos')
      areaConcursos.set('ativa', true)
      app.save(areaConcursos)
    }

    let areaCorporativo
    try {
      areaCorporativo = app.findFirstRecordByData(
        'areas',
        'nome',
        'Projetos Corporativos e Consultoria',
      )
    } catch (_) {
      areaCorporativo = new Record(areasCol)
      areaCorporativo.set('nome', 'Projetos Corporativos e Consultoria')
      areaCorporativo.set('ativa', true)
      app.save(areaCorporativo)
    }

    // 3. Seed Campanha Ativa (Convites)
    const campaignsCol = app.findCollectionByNameOrId('campaigns')
    let camp1
    try {
      camp1 = app.findFirstRecordByData('campaigns', 'slug', 'nps-ensino-2025-1')
    } catch (_) {
      camp1 = new Record(campaignsCol)
      camp1.set('nome', 'Pesquisa de Satisfação Alunos 2025/1')
      camp1.set('area_id', areaEnsino.id)
      camp1.set(
        'pergunta_nps',
        'Em uma escala de 0 a 10, quanto você recomendaria a Fundatec Ensino para um amigo ou colega?',
      )
      camp1.set('modo_acesso', 'convites')
      camp1.set('status', 'ativa')
      camp1.set('justificativa_detrator', 'obrigatoria')
      camp1.set(
        'texto_geral',
        'Sua opinião é fundamental para aprimorarmos continuamente nossa infraestrutura, corpo docente e metodologia.',
      )
      camp1.set('slug', 'nps-ensino-2025-1')
      app.save(camp1)
    }

    // Seed Campanha Ativa (Link Aberto)
    let camp2
    try {
      camp2 = app.findFirstRecordByData('campaigns', 'slug', 'nps-candidatos-concursos-2025')
    } catch (_) {
      camp2 = new Record(campaignsCol)
      camp2.set('nome', 'Avaliação de Atendimento aos Candidatos de Concursos')
      camp2.set('area_id', areaConcursos.id)
      camp2.set(
        'pergunta_nps',
        'Em uma escala de 0 a 10, o quanto você recomendaria os processos seletivos e o atendimento da Fundatec Concursos?',
      )
      camp2.set('modo_acesso', 'link_aberto')
      camp2.set('status', 'ativa')
      camp2.set('justificativa_detrator', 'geral')
      camp2.set(
        'texto_geral',
        'Agradecemos sua participação. Queremos entender sua experiência com nossos editais e canais de suporte.',
      )
      camp2.set('slug', 'nps-candidatos-concursos-2025')
      app.save(camp2)
    }

    // 4. Seed Perguntas Adicionais para Campanha 1
    const questionsCol = app.findCollectionByNameOrId('questions')
    let q1
    try {
      q1 = app.findFirstRecordByData(
        'questions',
        'enunciado',
        'Como você avalia a clareza dos conteúdos e a didática dos professores?',
      )
    } catch (_) {
      q1 = new Record(questionsCol)
      q1.set('campaign_id', camp1.id)
      q1.set('enunciado', 'Como você avalia a clareza dos conteúdos e a didática dos professores?')
      q1.set('tipo', 'nota')
      q1.set('obrigatoria', true)
      q1.set('ordem', 1)
      app.save(q1)
    }

    let q2
    try {
      q2 = app.findFirstRecordByData(
        'questions',
        'enunciado',
        'Quais melhorias você sugere para o nosso ambiente e suporte acadêmico?',
      )
    } catch (_) {
      q2 = new Record(questionsCol)
      q2.set('campaign_id', camp1.id)
      q2.set('enunciado', 'Quais melhorias você sugere para o nosso ambiente e suporte acadêmico?')
      q2.set('tipo', 'texto')
      q2.set('obrigatoria', false)
      q2.set('ordem', 2)
      app.save(q2)
    }

    // 5. Seed Participantes para Campanha 1
    const participantsCol = app.findCollectionByNameOrId('participants')
    let p1
    try {
      p1 = app.findFirstRecordByData('participants', 'email', 'mariana.silva@exemplo.com')
    } catch (_) {
      p1 = new Record(participantsCol)
      p1.set('campaign_id', camp1.id)
      p1.set('nome', 'Mariana Silva')
      p1.set('email', 'mariana.silva@exemplo.com')
      p1.set('token', 'tok_mariana_2025_fundatec')
      p1.set('respondido', true)
      p1.set('respondido_em', '2025-02-15 14:30:00.000Z')
      app.save(p1)
    }

    let p2
    try {
      p2 = app.findFirstRecordByData('participants', 'email', 'carlos.eduardo@exemplo.com')
    } catch (_) {
      p2 = new Record(participantsCol)
      p2.set('campaign_id', camp1.id)
      p2.set('nome', 'Carlos Eduardo')
      p2.set('email', 'carlos.eduardo@exemplo.com')
      p2.set('token', 'tok_carlos_2025_fundatec')
      p2.set('respondido', true)
      p2.set('respondido_em', '2025-02-16 10:15:00.000Z')
      app.save(p2)
    }

    let p3
    try {
      p3 = app.findFirstRecordByData('participants', 'email', 'ana.paula@exemplo.com')
    } catch (_) {
      p3 = new Record(participantsCol)
      p3.set('campaign_id', camp1.id)
      p3.set('nome', 'Ana Paula Souza')
      p3.set('email', 'ana.paula@exemplo.com')
      p3.set('token', 'tok_anapaula_2025_fundatec')
      p3.set('respondido', true)
      p3.set('respondido_em', '2025-02-18 16:45:00.000Z')
      app.save(p3)
    }

    let p4
    try {
      p4 = app.findFirstRecordByData('participants', 'email', 'roberto.almeida@exemplo.com')
    } catch (_) {
      p4 = new Record(participantsCol)
      p4.set('campaign_id', camp1.id)
      p4.set('nome', 'Roberto Almeida')
      p4.set('email', 'roberto.almeida@exemplo.com')
      p4.set('token', 'tok_roberto_2025_fundatec')
      p4.set('respondido', false)
      app.save(p4)
    }

    let p5
    try {
      p5 = app.findFirstRecordByData('participants', 'email', 'fernanda.costa@exemplo.com')
    } catch (_) {
      p5 = new Record(participantsCol)
      p5.set('campaign_id', camp1.id)
      p5.set('nome', 'Fernanda Costa')
      p5.set('email', 'fernanda.costa@exemplo.com')
      p5.set('token', 'tok_fernanda_2025_fundatec')
      p5.set('respondido', false)
      app.save(p5)
    }

    // 6. Seed Respostas (Responses)
    const responsesCol = app.findCollectionByNameOrId('survey_responses')
    try {
      app.findFirstRecordByData('survey_responses', 'participant_id', p1.id)
    } catch (_) {
      const r1 = new Record(responsesCol)
      r1.set('campaign_id', camp1.id)
      r1.set('participant_id', p1.id)
      r1.set('nota', 10)
      r1.set('classificacao', 'promotor')
      r1.set('comentario', 'Excelente corpo docente e estrutura fantástica. Aprendi muito!')
      r1.set('anonimo', false)
      r1.set(
        'respostas_adicionais',
        JSON.stringify([
          {
            question_id: q1.id,
            enunciado: 'Como você avalia a clareza dos conteúdos e a didática dos professores?',
            valor: '10',
          },
          {
            question_id: q2.id,
            enunciado: 'Quais melhorias você sugere para o nosso ambiente e suporte acadêmico?',
            valor: 'Manter os laboratórios abertos aos sábados.',
          },
        ]),
      )
      app.save(r1)
    }

    try {
      app.findFirstRecordByData('survey_responses', 'participant_id', p2.id)
    } catch (_) {
      const r2 = new Record(responsesCol)
      r2.set('campaign_id', camp1.id)
      r2.set('participant_id', p2.id)
      r2.set('nota', 8)
      r2.set('classificacao', 'neutro')
      r2.set('comentario', 'O curso é bom, mas o portal do aluno poderia ser mais intuitivo.')
      r2.set('anonimo', false)
      r2.set(
        'respostas_adicionais',
        JSON.stringify([
          {
            question_id: q1.id,
            enunciado: 'Como você avalia a clareza dos conteúdos e a didática dos professores?',
            valor: '8',
          },
        ]),
      )
      app.save(r2)
    }

    try {
      app.findFirstRecordByData('survey_responses', 'participant_id', p3.id)
    } catch (_) {
      const r3 = new Record(responsesCol)
      r3.set('campaign_id', camp1.id)
      r3.set('participant_id', p3.id)
      r3.set('nota', 4)
      r3.set('classificacao', 'detrator')
      r3.set('comentario', 'Tive problemas com a coordenação para envio de certificado.')
      r3.set(
        'justificativa_detrator',
        'Demora de mais de 3 semanas no atendimento da secretaria e falta de retorno por e-mail.',
      )
      r3.set('anonimo', false)
      r3.set(
        'respostas_adicionais',
        JSON.stringify([
          {
            question_id: q1.id,
            enunciado: 'Como você avalia a clareza dos conteúdos e a didática dos professores?',
            valor: '6',
          },
        ]),
      )
      app.save(r3)
    }

    // 7. Seed Envios
    const dispatchesCol = app.findCollectionByNameOrId('dispatches')
    try {
      app.findFirstRecordByData('dispatches', 'destinatario', 'mariana.silva@exemplo.com')
    } catch (_) {
      const d1 = new Record(dispatchesCol)
      d1.set('campaign_id', camp1.id)
      d1.set('participant_id', p1.id)
      d1.set('tipo', 'inicial')
      d1.set('destinatario', 'mariana.silva@exemplo.com')
      d1.set('status', 'sucesso')
      d1.set('detalhe', 'Convite enviado via sistema com link personalizado.')
      app.save(d1)
    }

    try {
      app.findFirstRecordByData('dispatches', 'destinatario', 'roberto.almeida@exemplo.com')
    } catch (_) {
      const d2 = new Record(dispatchesCol)
      d2.set('campaign_id', camp1.id)
      d2.set('participant_id', p4.id)
      d2.set('tipo', 'inicial')
      d2.set('destinatario', 'roberto.almeida@exemplo.com')
      d2.set('status', 'sucesso')
      d2.set('detalhe', 'Convite enviado via sistema com link personalizado.')
      app.save(d2)
    }

    // 8. Seed Log Inicial
    const logsCol = app.findCollectionByNameOrId('system_logs')
    try {
      app.findFirstRecordByData('system_logs', 'acao', 'setup_inicial')
    } catch (_) {
      const log = new Record(logsCol)
      log.set('acao', 'setup_inicial')
      log.set(
        'detalhe',
        'Sistema de Avaliação NPS Fundatec inicializado com áreas e campanhas modelo.',
      )
      log.set('usuario', 'ti@fundatec.org.br')
      app.save(log)
    }
  },
  (app) => {
    // down migration
  },
)
