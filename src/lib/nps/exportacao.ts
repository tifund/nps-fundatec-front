// Exportações do dashboard: CSV nativo (sem dependências) e relatório em
// HTML imprimível — o usuário salva como PDF pelo próprio navegador
// ("Imprimir > Salvar como PDF"), sem pacote extra.
// Regra inegociável: respostas anônimas NUNCA mostram nome/e-mail em nenhuma exportação.
import {
  calcularNps,
  formulaNps,
  rotuloContato,
  contatoDaResposta,
  faixaDaNota,
  corFaixa,
} from './calculos'
import type { Campaign, SurveyResponse } from '@/types/nps'

// ---------- CSV ----------

function esc(valor: string | number | boolean): string {
  const s = String(valor ?? '')
  // Aspas duplas, separador e quebras de linha são escapados.
  return `"${s.replace(/"/g, '""')}"`
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function baixar(nome: string, conteudo: BlobPart, tipo: string): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function baixarCsv(
  nome: string,
  cabecalho: string[],
  linhas: (string | number | boolean)[][],
): void {
  const corpo = [cabecalho, ...linhas].map((l) => l.map(esc).join(';')).join('\r\n')
  // BOM para o Excel abrir acentuação correta
  baixar(nome, '\uFEFF' + corpo, 'text/csv;charset=utf-8')
}

export function fmtDataHora(iso: string): string {
  if (!iso) return ''
  return iso.slice(0, 16).replace('T', ' ')
}

// ---------- Relatório da campanha (CSV) ----------

export function exportarRelatorioCsv(
  campanha: Campaign,
  respostas: SurveyResponse[],
  periodo: { de: string; ate: string },
): void {
  const d = calcularNps(respostas)
  const tratados = respostas.filter((r) => r.nota <= 6 && r.tratado).length
  const linhas: (string | number | boolean)[][] = []

  linhas.push(['Relatório NPS — Fundatec'])
  linhas.push(['Campanha', campanha.nome])
  linhas.push(['Área', campanha.area_nome || campanha.expand?.area_id?.nome || ''])
  linhas.push(['Pergunta NPS', campanha.pergunta_nps])
  linhas.push(['Período', `${periodo.de} a ${periodo.ate}`])
  linhas.push(['Gerado em', fmtDataHora(new Date().toISOString())])
  linhas.push([])

  linhas.push(['KPIs do período'])
  linhas.push(['Respostas no período', d.total])
  linhas.push(['Promotores (9–10)', d.promotores])
  linhas.push(['Neutros (7–8)', d.neutros])
  linhas.push(['Detratores (0–6)', d.detratores])
  linhas.push(['% Promotores', d.pctPromotores])
  linhas.push(['% Neutros', d.pctNeutros])
  linhas.push(['% Detratores', d.pctDetratores])
  linhas.push(['NPS do período', d.nps ?? '—'])
  linhas.push(['Fórmula', formulaNps(d)])
  linhas.push(['Detratores tratados', tratados])
  linhas.push([])

  linhas.push(['Distribuição de notas'])
  linhas.push(['Nota', 'Respostas', '%'])
  d.counts.forEach((c, nota) => linhas.push([nota, c, d.pct[nota]]))
  linhas.push([])

  linhas.push(['Respostas do período'])
  linhas.push(['Data', 'Respondente', 'Nota', 'Classificação', 'Comentário'])
  for (const r of respostas) {
    linhas.push([
      fmtDataHora(r.created),
      rotuloContato(r), // 'Anônimo' quando anônima — sem nome/e-mail
      r.nota,
      r.classificacao,
      r.comentario || '',
    ])
  }
  linhas.push([])

  linhas.push(['Detratores (0–6) e tratativa'])
  linhas.push([
    'Data',
    'Respondente',
    'Nota',
    'Justificativa',
    'Comentário',
    'Tratado',
    'Nota interna',
  ])
  for (const r of respostas.filter((x) => x.nota <= 6)) {
    linhas.push([
      fmtDataHora(r.created),
      rotuloContato(r),
      r.nota,
      r.justificativa_detrator || '',
      r.comentario || '',
      r.tratado ? 'Sim' : 'Não',
      r.nota_interna || '',
    ])
  }

  const slug = campanha.slug || 'campanha'
  baixarCsv(`relatorio-nps-${slug}-${periodo.de}-${periodo.ate}.csv`, [], linhas)
}

// ---------- Lista de detratores (CSV, aba Gestão de Detratores) ----------

export function exportarDetratoresCsv(respostas: SurveyResponse[]): void {
  const cabecalho = [
    'Data',
    'Respondente',
    'E-mail',
    'Nota',
    'Justificativa',
    'Comentário',
    'Tratado',
    'Nota interna',
  ]
  const linhas = respostas.map((r) => {
    // contato é null quando anônima — e-mail e nome ficam vazios
    const contato = contatoDaResposta(r)
    return [
      fmtDataHora(r.created),
      contato ? contato.nome : 'Anônimo',
      contato ? contato.email : '',
      r.nota,
      r.justificativa_detrator || '',
      r.comentario || '',
      r.tratado ? 'Sim' : 'Não',
      r.nota_interna || '',
    ]
  })
  baixarCsv(`detratores-nps-${new Date().toISOString().slice(0, 10)}.csv`, cabecalho, linhas)
}

// ---------- Relatório da campanha (imprimível → PDF pelo navegador) ----------

export async function exportarRelatorioPdf(
  campanha: Campaign,
  respostas: SurveyResponse[],
  periodo: { de: string; ate: string },
): Promise<void> {
  const d = calcularNps(respostas)
  const tratados = respostas.filter((r) => r.nota <= 6 && r.tratado).length
  const html = relatorioHtml(campanha, respostas, periodo, d, tratados)
  const janela = window.open('', '_blank', 'width=920,height=1100')
  if (janela) {
    janela.document.open()
    janela.document.write(html)
    janela.document.close()
    janela.focus()
    // pequena espera para o navegador montar o documento antes do diálogo
    await new Promise((r) => setTimeout(r, 350))
    janela.print()
    return
  }
  // popup bloqueado: imprime por iframe oculto (mesmo resultado)
  imprimirViaIframe(html)
}

function imprimirViaIframe(html: string): void {
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)
  const janela = iframe.contentWindow
  if (!janela) {
    document.body.removeChild(iframe)
    throw new Error('Não foi possível abrir a janela de impressão.')
  }
  janela.document.open()
  janela.document.write(html)
  janela.document.close()
  janela.focus()
  janela.print()
  setTimeout(() => iframe.remove(), 60_000)
}

function barraDistribuicao(d: ReturnType<typeof calcularNps>): string {
  const max = Math.max(1, ...d.counts)
  const celulas = d.counts
    .map((qtd, nota) => {
      const altura = Math.round((qtd / max) * 60)
      const cor = corFaixa[faixaDaNota(nota)]
      return `<td class="col">
        <div class="barra-wrap">
          <div class="barra" style="height:${Math.max(altura, qtd > 0 ? 2 : 0)}px;background:${cor}"></div>
        </div>
        <div class="nota">${nota}</div>
        <div class="qtd">${qtd}</div>
      </td>`
    })
    .join('')
  return `<table class="barras"><tr>${celulas}</tr></table>
    <p class="legenda">
      <span class="dot" style="background:${corFaixa.detrator}"></span> Detrator (0–6)
      <span class="dot" style="background:${corFaixa.neutro}"></span> Neutro (7–8)
      <span class="dot" style="background:${corFaixa.promotor}"></span> Promotor (9–10)
    </p>`
}

function relatorioHtml(
  campanha: Campaign,
  respostas: SurveyResponse[],
  periodo: { de: string; ate: string },
  d: ReturnType<typeof calcularNps>,
  tratados: number,
): string {
  const linhaResposta = (r: SurveyResponse): string => `
    <tr>
      <td>${escHtml(fmtDataHora(r.created))}</td>
      <td>${escHtml(rotuloContato(r))}</td>
      <td class="b">${r.nota}</td>
      <td>${escHtml(r.classificacao)}</td>
      <td>${escHtml(r.comentario || '—')}</td>
    </tr>`

  const linhaDetrator = (r: SurveyResponse): string => `
    <tr>
      <td>${escHtml(fmtDataHora(r.created))}</td>
      <td>${escHtml(rotuloContato(r))}</td>
      <td class="b">${r.nota}</td>
      <td>${escHtml(r.justificativa_detrator || '—')}</td>
      <td>${escHtml(r.comentario || '—')}</td>
      <td>${r.tratado ? 'Sim' : 'Não'}</td>
      <td>${escHtml(r.nota_interna || '—')}</td>
    </tr>`

  const det = respostas.filter((r) => r.nota <= 6)

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Relatório NPS — ${escHtml(campanha.nome)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 32px; font-size: 12px; }
  .cabecalho { background: #075985; color: #fff; padding: 18px 24px; border-radius: 8px; margin-bottom: 24px; }
  .cabecalho h1 { margin: 0; font-size: 20px; }
  .cabecalho p { margin: 4px 0 0; font-size: 11px; opacity: .85; }
  h2 { font-size: 14px; margin: 22px 0 8px; color: #0f172a; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 8px; }
  th, td { border: 1px solid #e2e8f0; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; font-size: 10px; text-transform: uppercase; letter-spacing: .03em; }
  td.b { font-weight: bold; }
  .kpis td { border: none; padding: 2px 14px 2px 0; }
  .kpis .rotulo { color: #64748b; font-size: 10px; text-transform: uppercase; }
  .kpis .valor { font-size: 15px; font-weight: bold; }
  .barras { width: auto; border: none; margin: 12px 0 4px; }
  .barras td { border: none; padding: 0 7px; text-align: center; }
  .barra-wrap { height: 62px; display: flex; align-items: flex-end; justify-content: center; }
  .barra { width: 26px; border-radius: 3px 3px 0 0; }
  .nota { font-size: 10px; color: #64748b; margin-top: 3px; }
  .qtd { font-size: 10px; font-weight: bold; color: #334155; }
  .legenda { font-size: 10px; color: #64748b; margin: 6px 0 0; }
  .dot { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin: 0 4px 0 10px; vertical-align: middle; }
  .rodape { margin-top: 28px; font-size: 9px; color: #94a3b8; }
  .vazio { color: #94a3b8; font-style: italic; }
  @media print {
    body { margin: 12mm; }
    .cabecalho { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .barra { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="cabecalho">
    <h1>Fundatec — Relatório NPS</h1>
    <p>Pesquisa de Satisfação</p>
  </div>

  <p><strong>Campanha:</strong> ${escHtml(campanha.nome)}<br />
  <strong>Área:</strong> ${escHtml(campanha.area_nome || campanha.expand?.area_id?.nome || '—')} &nbsp;·&nbsp;
  <strong>Período:</strong> ${periodo.de} a ${periodo.ate}<br />
  <strong>Pergunta NPS:</strong> ${escHtml(campanha.pergunta_nps)}</p>

  <h2>KPIs do período</h2>
  <table class="kpis">
    <tr>
      <td><div class="rotulo">Respostas</div><div class="valor">${d.total}</div></td>
      <td><div class="rotulo">Promotores (9–10)</div><div class="valor">${d.promotores} (${d.pctPromotores}%)</div></td>
      <td><div class="rotulo">Neutros (7–8)</div><div class="valor">${d.neutros} (${d.pctNeutros}%)</div></td>
      <td><div class="rotulo">Detratores (0–6)</div><div class="valor">${d.detratores} (${d.pctDetratores}%)</div></td>
      <td><div class="rotulo">NPS</div><div class="valor">${d.nps === null ? '—' : d.nps}</div></td>
      <td><div class="rotulo">Tratados</div><div class="valor">${tratados}</div></td>
    </tr>
  </table>
  <p class="legenda">${escHtml(formulaNps(d))}</p>

  <h2>Distribuição de notas (0–10)</h2>
  ${d.total === 0 ? '<p class="vazio">Sem respostas no período.</p>' : barraDistribuicao(d)}

  <h2>Respostas do período</h2>
  ${
    respostas.length === 0
      ? '<p class="vazio">Sem respostas no período.</p>'
      : `<table><thead><tr><th>Data</th><th>Respondente</th><th>Nota</th><th>Classificação</th><th>Comentário</th></tr></thead>
         <tbody>${respostas.map(linhaResposta).join('')}</tbody></table>`
  }

  <h2>Detratores (0–6) e tratativa</h2>
  ${
    det.length === 0
      ? '<p class="vazio">Sem detratores no período.</p>'
      : `<table><thead><tr><th>Data</th><th>Respondente</th><th>Nota</th><th>Justificativa</th><th>Comentário</th><th>Tratado</th><th>Nota interna</th></tr></thead>
         <tbody>${det.map(linhaDetrator).join('')}</tbody></table>`
  }

  <p class="rodape">Gerado pelo painel NPS Fundatec em ${escHtml(
    fmtDataHora(new Date().toISOString()),
  )} — respostas anônimas não expõem nome nem e-mail.</p>
</body>
</html>`
}
