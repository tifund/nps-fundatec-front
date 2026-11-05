// 0008 - Seed de ACEITE (idempotente): dados de teste para conferência manual
// do NPS no painel, cobrindo o fluxo ponta a ponta:
//   - campanha de CONVITES (nps-ensino-2025-1): respostas identificadas e uma
//     ANÔNIMA, detrator COM justificativa (modo "obrigatoria");
//   - campanha de LINK ABERTO (nps-candidatos-concursos-2025): respostas sem
//     participante, detratores COM e SEM justificativa (modo "geral"),
//     neutro anônimo e promotores.
//
// Conferência manual esperada (todas as respostas caem no período padrão de
// 90 dias, pois são criadas agora):
//   Campanha convites  : 4 respostas — P=1 (10), N=1 (8), D=2 (4, 4)
//                        %P=25  %D=50  => NPS = -25
//   Campanha link aberto: 5 respostas — P=2 (10, 9), N=1 (7), D=2 (5, 2)
//                        %P=40  %D=40  => NPS = 0
//   GERAL: 9 respostas — P=3 (33,3%), N=2 (22,2%), D=4 (44,4%) => NPS = -11,1
// Não altera os participantes p4/p5 (seguem sem responder, para exercitar
// o reenvio apenas para não respondentes).

migrate(
  (app) => {
    // ----- Campanhas do seed original (0002) -----
    let camp1 = null
    let camp2 = null
    try {
      camp1 = app.findFirstRecordByData('campaigns', 'slug', 'nps-ensino-2025-1')
    } catch (_) {}
    try {
      camp2 = app.findFirstRecordByData('campaigns', 'slug', 'nps-candidatos-concursos-2025')
    } catch (_) {}
    if (!camp1 || !camp2) {
      // Seed base ausente: nada a fazer (migration permanece idempotente).
      return
    }

    const responsesCol = app.findCollectionByNameOrId('survey_responses')
    const participantsCol = app.findCollectionByNameOrId('participants')

    // ----- Campanha de convites: 1 resposta anônima (detrator c/ justificativa) -----
    let p6 = null
    try {
      p6 = app.findFirstRecordByData('participants', 'email', 'beatriz.lima@exemplo.com')
    } catch (_) {}
    if (!p6 && camp1) {
      p6 = new Record(participantsCol)
      p6.set('campaign_id', camp1.id)
      p6.set('nome', 'Beatriz Lima')
      p6.set('email', 'beatriz.lima@exemplo.com')
      p6.set('token', 'tok_beatriz_2025_fundatec')
      p6.set('respondido', true)
      p6.set('respondido_em', new Date().toISOString().replace('T', ' '))
      app.save(p6)
    }
    if (p6) {
      let r6 = null
      try {
        r6 = app.findFirstRecordByData('survey_responses', 'participant_id', p6.id)
      } catch (_) {}
      if (!r6) {
        r6 = new Record(responsesCol)
        r6.set('campaign_id', camp1.id)
        r6.set('participant_id', p6.id)
        r6.set('nota', 4)
        r6.set('classificacao', 'detrator')
        r6.set('comentario', 'Material didático desatualizado em duas disciplinas.')
        r6.set(
          'justificativa_detrator',
          'Conteúdo das aulas não corresponde ao programa divulgado.',
        )
        r6.set('anonimo', true)
        app.save(r6)
      }
    }

    // ----- Campanha de link aberto: 5 respostas sem participante -----
    function respostaAberta(chave, dados) {
      // chave única por comentário para manter a migração idempotente
      let existente = null
      try {
        existente = app.findFirstRecordByData('survey_responses', 'comentario', dados.comentario)
        // garante que o registro encontrado é desta campanha
        if (existente && existente.getString('campaign_id') !== camp2.id) existente = null
      } catch (_) {}
      if (existente) return
      const r = new Record(responsesCol)
      r.set('campaign_id', camp2.id)
      r.set('participant_id', '')
      r.set('nota', dados.nota)
      r.set('classificacao', dados.classificacao)
      r.set('comentario', dados.comentario)
      r.set('justificativa_detrator', dados.justificativa || '')
      r.set('anonimo', !!dados.anonimo)
      app.save(r)
    }

    respostaAberta('ra', {
      nota: 10,
      classificacao: 'promotor',
      comentario: 'Atendimento excelente no balcão de inscrições, tudo muito rápido.',
    })
    respostaAberta('rb', {
      nota: 5,
      classificacao: 'detrator',
      comentario: 'O edital saiu com erro e a correção demorou dias.',
      justificativa: 'Erro no edital publicado e demora na correção/divulgação do retificado.',
    })
    respostaAberta('rc', {
      nota: 7,
      classificacao: 'neutro',
      comentario: 'Atendimento ok, mas o site poderia ter mais informações.',
      anonimo: true,
    })
    respostaAberta('rd', {
      nota: 9,
      classificacao: 'promotor',
      comentario: 'Processo seletivo bem organizado do início ao fim.',
    })
    respostaAberta('re', {
      nota: 2,
      classificacao: 'detrator',
      // modo "geral": detrator PODE enviar nota sem justificativa — o painel
      // exibe o texto geral da campanha para este caso.
      comentario: 'Não consegui falar com ninguém pelo telefone.',
      justificativa: '',
    })
  },
  (app) => {
    // down: nada (dados de teste)
  },
)
