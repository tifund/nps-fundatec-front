migrate(
  (app) => {
    // 1. Áreas de Negócio
    const areas = new Collection({
      name: 'areas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'ativa', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_areas_nome ON areas (nome)'],
    })
    app.save(areas)

    // 2. Campanhas
    const campaigns = new Collection({
      name: 'campaigns',
      type: 'base',
      listRule: '', // leitura pública para carregar dados básicos da avaliação
      viewRule: '', // leitura pública para carregar avaliação
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'nome', type: 'text', required: true },
        {
          name: 'area_id',
          type: 'relation',
          required: true,
          collectionId: areas.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'pergunta_nps', type: 'text', required: true },
        {
          name: 'modo_acesso',
          type: 'select',
          required: true,
          values: ['convites', 'link_aberto'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['ativa', 'encerrada'],
          maxSelect: 1,
        },
        { name: 'vigencia_fim', type: 'date' },
        {
          name: 'justificativa_detrator',
          type: 'select',
          required: true,
          values: ['obrigatoria', 'geral', 'nenhuma'],
          maxSelect: 1,
        },
        { name: 'texto_geral', type: 'text' },
        { name: 'slug', type: 'text', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_campaigns_slug ON campaigns (slug)',
        'CREATE INDEX idx_campaigns_area ON campaigns (area_id)',
      ],
    })
    app.save(campaigns)

    // 3. Perguntas Adicionais
    const questions = new Collection({
      name: 'questions',
      type: 'base',
      listRule: '', // pública para carregar na tela de resposta
      viewRule: '',
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'campaign_id',
          type: 'relation',
          required: true,
          collectionId: campaigns.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'enunciado', type: 'text', required: true },
        { name: 'tipo', type: 'select', required: true, values: ['nota', 'texto'], maxSelect: 1 },
        { name: 'obrigatoria', type: 'bool' },
        { name: 'ordem', type: 'number', onlyInt: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_questions_campaign ON questions (campaign_id, ordem)'],
    })
    app.save(questions)

    // 4. Participantes
    const participants = new Collection({
      name: 'participants',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: '', // leitura pública por token de convite
      createRule: "@request.auth.id != ''",
      updateRule: '', // permite marcar respondido ao enviar resposta pública
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'campaign_id',
          type: 'relation',
          required: true,
          collectionId: campaigns.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'nome', type: 'text', required: true },
        { name: 'email', type: 'email', required: true },
        { name: 'token', type: 'text', required: true },
        { name: 'respondido', type: 'bool' },
        { name: 'respondido_em', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_participants_token ON participants (token)',
        'CREATE INDEX idx_participants_campaign ON participants (campaign_id)',
      ],
    })
    app.save(participants)

    // 5. Envios
    const dispatches = new Collection({
      name: 'dispatches',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'campaign_id',
          type: 'relation',
          required: true,
          collectionId: campaigns.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'participant_id',
          type: 'relation',
          collectionId: participants.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['inicial', 'reenvio', 'copia_link'],
          maxSelect: 1,
        },
        { name: 'destinatario', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['sucesso', 'falha', 'registrado'],
          maxSelect: 1,
        },
        { name: 'detalhe', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_dispatches_campaign ON dispatches (campaign_id, created DESC)'],
    })
    app.save(dispatches)

    // 6. Respostas (Answers / Survey Responses)
    const responses = new Collection({
      name: 'survey_responses',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: '', // público pode criar respostas
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'campaign_id',
          type: 'relation',
          required: true,
          collectionId: campaigns.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'participant_id',
          type: 'relation',
          collectionId: participants.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'nota', type: 'number', required: false, min: 0, max: 10, onlyInt: true },
        {
          name: 'classificacao',
          type: 'select',
          required: true,
          values: ['promotor', 'neutro', 'detrator'],
          maxSelect: 1,
        },
        { name: 'comentario', type: 'text' },
        { name: 'justificativa_detrator', type: 'text' },
        { name: 'anonimo', type: 'bool' },
        { name: 'respostas_adicionais', type: 'json' }, // array [{ question_id, enunciado, valor }]
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_responses_campaign ON survey_responses (campaign_id, created DESC)',
      ],
    })
    app.save(responses)

    // 7. Logs do Sistema
    const logs = new Collection({
      name: 'system_logs',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: '', // hooks ou app podem registrar
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'acao', type: 'text', required: true },
        { name: 'detalhe', type: 'text' },
        { name: 'usuario', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_system_logs_created ON system_logs (created DESC)'],
    })
    app.save(logs)
  },
  (app) => {
    const toDelete = [
      'system_logs',
      'survey_responses',
      'dispatches',
      'participants',
      'questions',
      'campaigns',
      'areas',
    ]
    for (const name of toDelete) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    }
  },
)
