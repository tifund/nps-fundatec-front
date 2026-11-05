// Adiciona à collection survey_responses os campos de tratativa de detratores
// (marcar como tratado pelo painel). Idempotente: só adiciona o campo se não existir.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('survey_responses')

    if (!col.fields.getByName('tratado')) {
      col.fields.add(new BoolField({ name: 'tratado' }))
    }
    if (!col.fields.getByName('nota_interna')) {
      col.fields.add(new TextField({ name: 'nota_interna', max: 2000 }))
    }
    if (!col.fields.getByName('tratado_em')) {
      col.fields.add(new DateField({ name: 'tratado_em' }))
    }
    if (!col.fields.getByName('tratado_por')) {
      col.fields.add(new TextField({ name: 'tratado_por', max: 255 }))
    }

    // Índice da lista de detratores (nota + período)
    col.addIndex('idx_responses_tratado', false, 'tratado', '')

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('survey_responses')
    for (const f of ['tratado', 'nota_interna', 'tratado_em', 'tratado_por']) {
      try {
        const field = col.fields.getByName(f)
        if (field) col.fields.removeByName(f)
      } catch (_) {}
    }
    col.removeIndex('idx_responses_tratado')
    app.save(col)
  },
)
