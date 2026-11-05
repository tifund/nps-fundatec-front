// Dashboard da campanha individual: KPIs, distribuição 0–10 com faixas,
// fórmula do NPS junto ao número, evolução por semana/mês, detratores e relatório.
// O filtro de período afeta TODOS os números, listas e o relatório exportado.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Users,
  MessageSquare,
  Percent,
  Gauge,
  Download,
  FileSpreadsheet,
  Loader2,
  CalendarRange,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FiltroPeriodoArea } from '@/components/dashboard/FiltroPeriodoArea'
import { GraficoEvolucao } from '@/components/dashboard/GraficoEvolucao'
import { GraficoDistribuicao } from '@/components/dashboard/GraficoDistribuicao'
import { GestaoDetratores } from '@/components/dashboard/GestaoDetratores'
import { marcarTratado } from '@/services/tratativa'
import { calcularNps, formulaNps, rotuloContato, evolucaoNps } from '@/lib/nps/calculos'
import { exportarRelatorioCsv, exportarRelatorioPdf } from '@/lib/nps/exportacao'
import { usePermissions } from '@/hooks/use-permissions'
import type { Campaign, SurveyResponse } from '@/types/nps'
import type { PeriodoFiltro } from '@/services/dashboard'

export function PainelCampanha({
  campanha,
  participantes,
  respostas,
  periodo,
  onPeriodo,
  recarregando,
}: {
  campanha: Campaign
  participantes: number
  respostas: SurveyResponse[] // todas da campanha (sem filtro)
  periodo: PeriodoFiltro
  onPeriodo: (p: PeriodoFiltro) => void
  recarregando?: boolean
}) {
  const { canExport, canTratarDetrator } = usePermissions()
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const [respostasLocal, setRespostasLocal] = useState(respostas)
  useEffect(() => {
    setRespostasLocal(respostas)
  }, [respostas])

  const doPeriodo = useMemo(
    () =>
      respostasLocal.filter(
        (r) =>
          r.created >= `${periodo.de}T00:00:00.000Z` && r.created <= `${periodo.ate}T23:59:59.999Z`,
      ),
    [respostasLocal, periodo],
  )

  const d = useMemo(() => calcularNps(doPeriodo), [doPeriodo])
  const pontosEvolucao = useMemo(() => evolucaoNps(doPeriodo, 'mes'), [doPeriodo])

  const convocadosVisiveis = campanha.modo_acesso === 'convites'
  const taxaResposta =
    convocadosVisiveis && participantes > 0
      ? Math.round((doPeriodo.length / participantes) * 1000) / 10
      : null

  const exportarCsv = () => {
    exportarRelatorioCsv(campanha, doPeriodo, periodo)
  }

  const exportarPdf = async () => {
    setGerandoPdf(true)
    try {
      await exportarRelatorioPdf(campanha, doPeriodo, periodo)
    } finally {
      setGerandoPdf(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho + filtros + exportação */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-slate-500 mb-1 -ml-2"
          >
            <Link to="/admin/dashboard">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Voltar à visão geral
            </Link>
          </Button>
          <h2 className="text-xl font-bold tracking-tight text-slate-800">{campanha.nome}</h2>
          <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
            <Badge
              variant="outline"
              className={`text-[10px] ${
                campanha.status === 'ativa'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
            >
              {campanha.status}
            </Badge>
            <span>{campanha.pergunta_nps}</span>
          </p>
        </div>
        <div className="flex flex-col items-start lg:items-end gap-2">
          <FiltroPeriodoArea
            periodo={periodo}
            onPeriodo={onPeriodo}
            areas={[]}
            areaId=""
            onArea={() => {}}
            mostrarArea={false}
          />
          {canExport ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={exportarCsv}
                disabled={doPeriodo.length === 0}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" /> Planilha (CSV)
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs bg-sky-700 hover:bg-sky-800"
                onClick={() => void exportarPdf()}
                disabled={gerandoPdf || doPeriodo.length === 0}
              >
                {gerandoPdf ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                )}
                Exportar relatório (PDF)
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <Tabs defaultValue="resultados">
        <TabsList>
          <TabsTrigger value="resultados" className="text-xs">
            Resultados
          </TabsTrigger>
          <TabsTrigger value="detratores" className="text-xs">
            Detratores
            {d.detratores > 0 ? (
              <Badge
                variant="outline"
                className="ml-1.5 text-[10px] bg-rose-50 text-rose-700 border-rose-200"
              >
                {d.detratores}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        {/* ---------- Aba Resultados ---------- */}
        <TabsContent value="resultados" className="space-y-4 mt-4">
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardContent className="p-5 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-700 shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">
                    {convocadosVisiveis ? 'Convocados' : 'Distribuições estimadas'}
                  </p>
                  <p className="text-2xl font-bold text-slate-800">
                    {convocadosVisiveis ? participantes : '—'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {convocadosVisiveis ? 'convites individuais' : 'modo link aberto'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm bg-white">
              <CardContent className="p-5 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Respondidos no período</p>
                  <p className="text-2xl font-bold text-slate-800">{d.total}</p>
                  <p className="text-[11px] text-slate-400">
                    {periodo.de} a {periodo.ate}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm bg-white">
              <CardContent className="p-5 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600 shrink-0">
                  <Percent className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Taxa de resposta</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {taxaResposta === null ? '—' : `${taxaResposta}%`}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {convocadosVisiveis
                      ? 'respondidos ÷ convocados'
                      : 'indisponível no link aberto'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="pb-0 px-5">
                <CardDescription className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5" /> NPS do período
                </CardDescription>
                <div className="flex items-baseline gap-2 mt-1">
                  <span
                    className={`text-4xl font-extrabold tracking-tight ${
                      d.nps === null
                        ? 'text-slate-400'
                        : d.nps >= 50
                          ? 'text-emerald-600'
                          : d.nps >= 0
                            ? 'text-amber-600'
                            : 'text-rose-600'
                    }`}
                  >
                    {d.nps === null ? '—' : d.nps > 0 ? `+${d.nps}` : String(d.nps)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-1 px-5">
                {/* Fórmula aplicada junto ao número — transparência do cálculo */}
                <p className="text-[11px] text-slate-500 font-medium">{formulaNps(d)}</p>
                <p className="text-[10px] text-slate-400">
                  NPS = %promotores − %detratores, sobre {d.total} resposta(s) do período.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Distribuição 0–10 */}
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm font-semibold text-slate-800">
                Distribuição de notas (0–10)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Faixas destacadas: <span className="text-rose-600 font-medium">detratores 0–6</span>
                , <span className="text-amber-600 font-medium">neutros 7–8</span>,{' '}
                <span className="text-emerald-600 font-medium">promotores 9–10</span>.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              {d.total === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">
                  Sem respostas no período selecionado.
                </p>
              ) : (
                <GraficoDistribuicao counts={d.counts} />
              )}
            </CardContent>
          </Card>

          {/* Evolução */}
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <CalendarRange className="w-4 h-4 text-sky-600" /> Evolução do NPS por mês
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                NPS recalculado dentro de cada mês do período (exibido quando há dados suficientes).
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              {pontosEvolucao.length < 2 ? (
                <p className="text-xs text-slate-400 py-8 text-center">
                  Ainda não há dados suficientes para a curva — ela aparece a partir de dois
                  períodos com respostas.
                </p>
              ) : (
                <GraficoEvolucao pontos={pontosEvolucao} />
              )}
            </CardContent>
          </Card>

          {/* Respostas do período */}
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-semibold text-slate-800">
                Respostas do período ({doPeriodo.length})
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Respostas anônimas nunca exibem nome ou e-mail — aparecem como “Anônimo”.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {doPeriodo.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">
                  Nenhuma resposta no período filtrado.
                </p>
              ) : (
                <div className="overflow-x-auto max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs font-semibold text-slate-600">Data</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600">
                          Respondente
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600">Nota</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600">
                          Classificação
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600">
                          Comentário
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {doPeriodo.map((r) => {
                        const rotulo = rotuloContato(r)
                        return (
                          <TableRow key={r.id} className="hover:bg-slate-50/60">
                            <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                              {new Date(r.created).toLocaleString('pt-BR', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </TableCell>
                            <TableCell className="text-xs text-slate-700">
                              {rotulo === 'Anônimo' ? (
                                <span className="italic text-slate-400">Anônimo</span>
                              ) : (
                                rotulo
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="text-[10px] font-bold"
                                style={{ color: corNota(r.nota), borderColor: corNota(r.nota) }}
                              >
                                {r.nota}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs capitalize text-slate-600">
                              {r.classificacao}
                            </TableCell>
                            <TableCell className="text-xs text-slate-600 max-w-72 truncate">
                              {r.comentario || '—'}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- Aba Detratores ---------- */}
        <TabsContent value="detratores" className="mt-4">
          <GestaoDetratores
            respostas={doPeriodo}
            onTratado={async (rid, nota) => {
              await marcarTratado(rid, nota)
              setRespostasLocal((rs) =>
                rs.map((r) =>
                  r.id === rid
                    ? {
                        ...r,
                        tratado: true,
                        nota_interna: nota,
                        tratado_em: new Date().toISOString(),
                      }
                    : r,
                ),
              )
            }}
          />
          {!canTratarDetrator ? (
            <p className="text-[11px] text-slate-400 mt-2">
              Somente ADMIN/GESTOR podem marcar detratores como tratados — seu perfil visualiza a
              lista e exporta.
            </p>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  )
}
