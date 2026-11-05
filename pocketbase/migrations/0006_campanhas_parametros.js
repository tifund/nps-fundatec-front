// 0006 - Campanhas: parâmetros completos da tela "Campanhas".
//   - novo valor de status: "rascunho" (rascunho -> ativa -> encerrada);
//   - vigencia_tipo ("continua" | "prazo") que torna explícito o modo de
//     vigência escolhido na tela (sem prazo / com data de encerramento);
//   - justificativa_geral (texto da justificativa geral da campanha sobre
//     detratores, exibida quando justificativa_detrator = "geral");
//   - texto_email_convite (editor rico com {{pnome}} e {{link}}) — o hook de
//     envio usa este texto como corpo do e-mail (template Fundatec quando
//     vazio).
// Regras de API: escrita de campanhas/perguntas liberada para ADMIN e GESTOR
// (LEITURA permanece somente leitura), como já feito para areas na 0005.

// Template padrão do e-mail de convite Fundatec (variáveis {{pnome}} e {{link}}).
const TEMPLATE_EMAIL_PADRAO =
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

migrate(
  (app) => {
    const campaigns = app.findCollectionByNameOrId('campaigns')

    if (!campaigns.fields.getByName('texto_email_convite')) {
      campaigns.fields.add(
        new EditorField({
          name: 'texto_email_convite',
          maxSize: 200000,
          convertURLs: true,
        }),
      )
    }
    if (!campaigns.fields.getByName('justificativa_geral')) {
      campaigns.fields.add(new TextField({ name: 'justificativa_geral', max: 2000 }))
    }
    if (!campaigns.fields.getByName('vigencia_tipo')) {
      campaigns.fields.add(
        new SelectField({
          name: 'vigencia_tipo',
          values: ['continua', 'prazo'],
          maxSelect: 1,
        }),
      )
    }

    // status: adicionar "rascunho" ao select mantendo os valores existentes
    const statusField = campaigns.fields.getByName('status')
    if (statusField && statusField.values.indexOf('rascunho') === -1) {
      statusField.values = ['rascunho'].concat(statusField.values)
    }

    campaigns.createRule = "(@request.auth.perfil = 'admin' || @request.auth.perfil = 'gestor')"
    campaigns.updateRule = "(@request.auth.perfil = 'admin' || @request.auth.perfil = 'gestor')"
    campaigns.deleteRule = "@request.auth.perfil = 'admin'"
    app.save(campaigns)

    const questions = app.findCollectionByNameOrId('questions')
    questions.createRule = "(@request.auth.perfil = 'admin' || @request.auth.perfil = 'gestor')"
    questions.updateRule = "(@request.auth.perfil = 'admin' || @request.auth.perfil = 'gestor')"
    questions.deleteRule = "(@request.auth.perfil = 'admin' || @request.auth.perfil = 'gestor')"
    app.save(questions)

    // Campanhas existentes: classificar vigência explícita e padronizar texto
    // de e-mail com o template padrão Fundatec (idempotente: só preenche se
    // estiver vazio).
    const todas = app.findRecordsByFilter('campaigns', "id != ''", 'created', 1000, 0)
    for (const c of todas) {
      if (c.getString('vigencia_tipo') === '') {
        c.set('vigencia_tipo', c.getString('vigencia_fim') === '' ? 'continua' : 'prazo')
      }
      if (c.getString('texto_email_convite') === '') {
        c.set('texto_email_convite', TEMPLATE_EMAIL_PADRAO)
      }
      app.save(c)
    }
  },
  (app) => {
    const campaigns = app.findCollectionByNameOrId('campaigns')
    campaigns.createRule = "@request.auth.id != ''"
    campaigns.updateRule = "@request.auth.id != ''"
    campaigns.deleteRule = "@request.auth.perfil = 'admin'"
    app.save(campaigns)
    const questions = app.findCollectionByNameOrId('questions')
    questions.createRule = "@request.auth.id != ''"
    questions.updateRule = "@request.auth.id != ''"
    questions.deleteRule = "@request.auth.id != ''"
    app.save(questions)
  },
)
