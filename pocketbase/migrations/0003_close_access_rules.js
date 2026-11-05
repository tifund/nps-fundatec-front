// 0003 - Fechamento total das regras de acesso (seguranca inegociavel).
// Nenhuma colecao fica com regra vazia: toda operacao anonima e bloqueada
// na API, com UMA excecao: o create de survey_responses (publico porque a
// pagina de avaliacao grava sem login). Essa excecao e guardada por uma
// regra restritiva e pelo hook onCreate em pocketbase/hooks/nps.pb.js.

migrate(
  (app) => {
    const authOnly = "@request.auth.id != ''"

    const users = app.findCollectionByNameOrId('users')
    users.listRule = authOnly
    users.viewRule = authOnly
    users.createRule = "id = ''"
    users.updateRule =
      "@request.auth.id != '' && id = @request.auth.id && @request.body.name:changed = false && @request.body.avatar:changed = false"
    users.deleteRule = "id = ''"
    app.save(users)

    const authOnlyNames = [
      'areas',
      'campaigns',
      'questions',
      'participants',
      'dispatches',
      'system_logs',
    ]
    for (const name of authOnlyNames) {
      const col = app.findCollectionByNameOrId(name)
      col.listRule = authOnly
      col.viewRule = authOnly
      col.createRule = authOnly
      col.updateRule = authOnly
      col.deleteRule = authOnly
      app.save(col)
    }

    const responses = app.findCollectionByNameOrId('survey_responses')
    responses.listRule = authOnly
    responses.viewRule = authOnly
    responses.createRule =
      "@request.body.nota >= 0 && @request.body.nota <= 10 && @request.body.classificacao != ''"
    responses.updateRule = authOnly
    responses.deleteRule = authOnly
    app.save(responses)
  },
  (app) => {},
)
