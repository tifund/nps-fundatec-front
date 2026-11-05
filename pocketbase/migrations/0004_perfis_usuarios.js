// 0004 - Perfis de acesso (ADMIN / GESTOR / LEITURA) e troca obrigatoria de senha.
// - Adiciona aos users os campos "perfil" (select) e "precisa_trocar_senha" (bool).
// - Marca o usuario seed ti@fundatec.org.br como admin.
// - Cria o ADMIN inicial admin@fundatec.org.br com senha provisoria FORTE e
//   precisa_trocar_senha = true (o sistema exige a troca no primeiro acesso).
// - Cria ainda um usuario de exemplo em cada perfil (gestor@ / leitura@),
//   tambem com senha provisoria e troca obrigatoria.
// - Reescreve as regras de API de TODAS as colecoes considerando o perfil:
//   ADMIN faz tudo; GESTOR cria/edita campanhas, perguntas, participantes e
//   disparos (sem excluir); LEITURA apenas list/view em tudo. O bloqueio e
//   no backend, nao so no frontend.
// - Reduz a validade do token de autenticacao (sessao expira automaticamente).

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    // ---------- 1. Campos novos ----------
    const fields = users.fields
    let hasPerfil = false
    let hasTroca = false
    for (const f of fields) {
      if (f.name === 'perfil') hasPerfil = true
      if (f.name === 'precisa_trocar_senha') hasTroca = true
    }
    if (!hasPerfil) {
      users.fields.add(
        new SelectField({
          name: 'perfil',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['admin', 'gestor', 'leitura'],
        }),
      )
    }
    if (!hasTroca) {
      users.fields.add(new BoolField({ name: 'precisa_trocar_senha' }))
    }

    // Sessao expira automaticamente: token de autenticacao vale 12 horas.
    users.authToken.duration = 43200

    // ---------- 2. Regras de API por perfil ----------
    const authOnly = "@request.auth.id != ''"
    const isAdmin = "@request.auth.perfil = 'admin'"
    const isStaff = '(' + isAdmin + " || @request.auth.perfil = 'gestor')"

    // users: so ADMIN lista/cria/edita/exclui usuarios; cada um ve/edita a si
    // mesmo (senha), sem poder alterar o proprio perfil, nome, e-mail ou avatar.
    users.listRule = isAdmin
    users.viewRule = isAdmin + ' || id = @request.auth.id'
    users.createRule = isAdmin
    users.updateRule =
      isAdmin +
      ' || (id = @request.auth.id && @request.body.perfil:changed = false && @request.body.name:changed = false && @request.body.avatar:changed = false && @request.body.email:changed = false && @request.body.verified:changed = false)'
    users.deleteRule = isAdmin
    app.save(users)

    // areas: leitura para todos; escrita somente ADMIN
    const areas = app.findCollectionByNameOrId('areas')
    areas.listRule = authOnly
    areas.viewRule = authOnly
    areas.createRule = isAdmin
    areas.updateRule = isAdmin
    areas.deleteRule = isAdmin
    app.save(areas)

    // Campanhas, perguntas, participantes e disparos: GESTOR e ADMIN criam/editam;
    // exclusao somente ADMIN; LEITURA apenas le.
    const staffWritable = ['campaigns', 'questions', 'participants', 'dispatches']
    for (const name of staffWritable) {
      const col = app.findCollectionByNameOrId(name)
      col.listRule = authOnly
      col.viewRule = authOnly
      col.createRule = isStaff
      col.updateRule = isStaff
      col.deleteRule = isAdmin
      app.save(col)
    }

    // survey_responses: create publico mantido APENAS para anonimo (a pagina
    // de avaliacao, com validacao server-side no hook); LEITURA bloqueada;
    // GESTOR/ADMIN podem editar/excluir (gestao de detratores).
    const responses = app.findCollectionByNameOrId('survey_responses')
    responses.listRule = authOnly
    responses.viewRule = authOnly
    responses.createRule =
      "@request.auth.id = '' && @request.body.nota >= 0 && @request.body.nota <= 10 && @request.body.classificacao != '' || " +
      isStaff
    responses.updateRule = isStaff
    responses.deleteRule = isStaff
    app.save(responses)

    // system_logs: leitura para todos; escrita somente via hooks (ADMIN na API)
    const logs = app.findCollectionByNameOrId('system_logs')
    logs.listRule = authOnly
    logs.viewRule = authOnly
    logs.createRule = isAdmin
    logs.updateRule = isAdmin
    logs.deleteRule = isAdmin
    app.save(logs)

    // ---------- 3. Usuarios iniciais ----------
    function ensureUser(email, name, perfil, password, precisaTrocar) {
      let rec = null
      try {
        rec = app.findAuthRecordByEmail('users', email)
      } catch (_) {}
      if (rec) {
        // Idempotente: apenas garante perfil e o indicador de troca.
        if (rec.getString('perfil') !== perfil) {
          rec.set('perfil', perfil)
        }
        if (precisaTrocar && !rec.getBool('precisa_trocar_senha')) {
          rec.set('precisa_trocar_senha', true)
        }
        app.save(rec)
        return rec
      }
      const novo = new Record(users)
      novo.setEmail(email)
      novo.setPassword(password)
      novo.setVerified(true)
      novo.set('name', name)
      novo.set('perfil', perfil)
      novo.set('precisa_trocar_senha', precisaTrocar)
      app.save(novo)
      return novo
    }

    // Usuario seed existente vira ADMIN (sem troca obrigatoria: senha ja conhecida)
    ensureUser('ti@fundatec.org.br', 'TI Fundatec', 'admin', 'Skip@Pass', false)
    // ADMIN inicial com senha provisoria FORTE - troca obrigatoria no 1o acesso
    ensureUser(
      'admin@fundatec.org.br',
      'Administrador Fundatec',
      'admin',
      'Vf8#qW2n$Lx5!Zt9m',
      true,
    )
    // Usuarios de exemplo dos outros perfis - troca obrigatoria no 1o acesso
    ensureUser('gestor@fundatec.org.br', 'Gestor Fundatec', 'gestor', 'Gq4$mRt8#Wn2!Kz6p', true)
    ensureUser('leitura@fundatec.org.br', 'Leitura Fundatec', 'leitura', 'Ld7!pSx3#Vb9@Mf2n', true)
  },
  (app) => {
    // Down: remove apenas os usuarios criados aqui (nao derruba os campos,
    // porque outros dados podem depender deles em restauracoes parciais).
    for (const email of [
      'admin@fundatec.org.br',
      'gestor@fundatec.org.br',
      'leitura@fundatec.org.br',
    ]) {
      try {
        const rec = app.findAuthRecordByEmail('users', email)
        app.delete(rec)
      } catch (_) {}
    }
  },
)
