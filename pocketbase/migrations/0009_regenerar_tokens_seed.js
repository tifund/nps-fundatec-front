// 0009 - Regeneração de tokens previsíveis de participantes de seed
//
// Substitui tokens previsíveis (ex.: tok_mariana_2025_fundatec, tok_beatriz_2025_fundatec
// ou qualquer outro no formato tok_<nome>_<ano>_fundatec) por tokens aleatórios fortes
// no formato tok_xxxxxxxx_yyyyyyyy (8 chars aleatórios + timestamp base36),
// idêntico ao gerador padrão usado no runtime da aplicação.
//
// Idempotente: seleciona apenas participantes cujo token contém '_fundatec'
// e gera um novo token único. No-op em banco vazio ou já saneado.

migrate((app) => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'

  function gerarTokenAleatorio() {
    let rand = ''
    for (let i = 0; i < 8; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    const ts = Date.now().toString(36)
    return 'tok_' + rand + '_' + ts
  }

  // Busca todos os participantes e filtra os que têm token previsível
  const participants = app.findRecordsByFilter('participants', "token ~ 'fundatec'", '', 500, 0)

  for (const p of participants) {
    const atual = p.getString('token') || ''
    if (atual.indexOf('fundatec') === -1) continue

    // Gera token novo garantindo que não colida com nenhum existente
    let novoToken = ''
    for (let tentativa = 0; tentativa < 10; tentativa++) {
      const candidato = gerarTokenAleatorio()
      const colidiu = app.findRecordsByFilter('participants', 'token = {:t}', '', 1, 0, {
        t: candidato,
      })
      if (colidiu.length === 0) {
        novoToken = candidato
        break
      }
    }

    if (novoToken !== '') {
      p.set('token', novoToken)
      app.save(p)
    }
  }
})
