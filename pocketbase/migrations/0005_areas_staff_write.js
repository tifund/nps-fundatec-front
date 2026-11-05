// 0005 - Áreas de negócio: escrita liberada para GESTOR (além do ADMIN),
// conforme fluxo pedido na tela "Áreas de Negócio" (ADMIN e GESTOR criam,
// editam, ativam/desativam e excluem; LEITURA apenas visualiza). A exclusão
// de área com campanhas vinculadas é bloqueada pelo hook server-side em
// pocketbase/hooks/nps.pb.js — aqui apenas ajustamos as regras de API.

migrate(
  (app) => {
    const isStaff = "(@request.auth.perfil = 'admin' || @request.auth.perfil = 'gestor')"

    const areas = app.findCollectionByNameOrId('areas')
    areas.createRule = isStaff
    areas.updateRule = isStaff
    areas.deleteRule = isStaff
    app.save(areas)
  },
  (app) => {
    const areas = app.findCollectionByNameOrId('areas')
    areas.createRule = "@request.auth.perfil = 'admin'"
    areas.updateRule = "@request.auth.perfil = 'admin'"
    areas.deleteRule = "@request.auth.perfil = 'admin'"
    app.save(areas)
  },
)
