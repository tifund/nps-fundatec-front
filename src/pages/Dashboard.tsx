import React, { useEffect, useState } from 'react'
import { getSurveyResponses, getSystemLogs } from '@/services/responses'
import { getCampaigns } from '@/services/campaigns'
import { SurveyResponse, Campaign, SystemLog } from '@/types/nps'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  BarChart3,
  TrendingUp,
  Smile,
  Meh,
  Frown,
  MessageSquare,
  AlertTriangle,
  History,
  Filter,
  Loader2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'
import { Download } from 'lucide-react'

export default function DashboardPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all')
  const [responses, setResponses] = useState<SurveyResponse[]>([])
  const [logs, setLogs] = useState<SystemLog[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const { toast } = useToast()
  const { canExport } = usePermissions()

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [camps, resps, sysLogs] = await Promise.all([
        getCampaigns(),
        getSurveyResponses(selectedCampaignId === 'all' ? undefined : selectedCampaignId),
        getSystemLogs(20),
      ])
      setCampaigns(camps)
      setResponses(resps)
      setLogs(sysLogs)
    } catch {
      toast({
        title: 'Erro ao carregar dashboard',
        description: 'Não foi possível carregar os indicadores de NPS.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedCampaignId])

  // Cálculos de NPS
  const total = responses.length
  const promotores = responses.filter((r) => r.nota >= 9).length
  const neutros = responses.filter((r) => r.nota >= 7 && r.nota <= 8).length
  const detratores = responses.filter((r) => r.nota <= 6).length

  const pctPromotores = total > 0 ? (promotores / total) * 100 : 0
  const pctNeutros = total > 0 ? (neutros / total) * 100 : 0
  const pctDetratores = total > 0 ? (detratores / total) * 100 : 0

  // NPS = % Promotores - % Detratores (-100 a +100)
  const npsScore = Math.round(pctPromotores - pctDetratores)

  // Lista de Detratores para Acompanhamento
  const listaDetratores = responses.filter((r) => r.classificacao === 'detrator')

  // Lista de comentários recebidos
  const comentarios = responses.filter((r) => r.comentario && r.comentario.trim().length > 0)

  // Exportação CSV das respostas filtradas (disponível a todos os perfis, inclusive LEITURA)
  const exportCsv = () => {
    const header = [
      'id',
      'campanha',
      'participante',
      'nota',
      'classificacao',
      'justificativa_detrator',
      'comentario',
      'anonimo',
      'data',
    ]
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v)
      return `"${s.replace(/"/g, '""')}"`
    }
    const linhas = responses.map((r) =>
      [
        r.id,
        r.expand?.campaign_id?.nome || '',
        r.anonimo ? 'Anônimo' : r.expand?.participant_id?.nome || '',
        r.nota,
        r.classificacao,
        r.justificativa_detrator || '',
        r.comentario || '',
        r.anonimo ? 'sim' : 'não',
        new Date(r.created).toLocaleString('pt-BR'),
      ]
        .map(escape)
        .join(';'),
    )
    const csv = [header.join(';'), ...linhas].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio-nps-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getNpsColor = (score: number) => {
    if (score >= 50) return 'text-emerald-600 bg-emerald-50 border-emerald-200'
    if (score >= 0) return 'text-amber-600 bg-amber-50 border-amber-200'
    return 'text-rose-600 bg-rose-50 border-rose-200'
  }

  const getNpsZona = (score: number) => {
    if (score >= 75) return 'Zona de Excelência'
    if (score >= 50) return 'Zona de Qualidade'
    if (score >= 0) return 'Zona de Aperfeiçoamento'
    return 'Zona Crítica'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Dashboard de NPS</h1>
          <p className="text-sm text-slate-500">
            Acompanhe o Net Promoter Score, distribuição de promotores/detratores e justificativas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canExport && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs text-slate-700 hover:text-sky-700 border-slate-200"
              onClick={exportCsv}
              disabled={responses.length === 0}
              title="Exportar relatório CSV das respostas filtradas"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Exportar CSV
            </Button>
          )}
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
            <SelectTrigger className="w-64 text-xs h-9 bg-white">
              <SelectValue placeholder="Filtrar por campanha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Campanhas</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-sky-600 mb-3" />
          <p className="text-sm">Calculando indicadores da pesquisa...</p>
        </div>
      ) : (
        <>
          {/* Cartão de Destaque NPS e Métricas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-slate-200 shadow-sm bg-white md:col-span-1">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Pontuação NPS
                </CardDescription>
                <div className="flex items-baseline gap-2 mt-1">
                  <span
                    className={`text-4xl font-extrabold tracking-tight ${
                      npsScore >= 50
                        ? 'text-emerald-600'
                        : npsScore >= 0
                          ? 'text-amber-600'
                          : 'text-rose-600'
                    }`}
                  >
                    {total > 0 ? (npsScore > 0 ? `+${npsScore}` : npsScore) : '—'}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">/ 100</span>
                </div>
              </CardHeader>
              <CardContent className="pt-0 pb-4">
                <div
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${getNpsColor(
                    npsScore,
                  )}`}
                >
                  {total > 0 ? getNpsZona(npsScore) : 'Sem avaliações'}
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Total de {total} resposta{total !== 1 ? 's' : ''} contabilizada
                  {total !== 1 ? 's' : ''}.
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm bg-white">
              <CardContent className="p-5 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                  <Smile className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Promotores (Nota 9–10)</p>
                  <p className="text-2xl font-bold text-slate-800">{promotores}</p>
                  <p className="text-[11px] text-emerald-600 font-semibold">
                    {pctPromotores.toFixed(1)}% do total
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm bg-white">
              <CardContent className="p-5 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                  <Meh className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Neutros (Nota 7–8)</p>
                  <p className="text-2xl font-bold text-slate-800">{neutros}</p>
                  <p className="text-[11px] text-amber-600 font-semibold">
                    {pctNeutros.toFixed(1)}% do total
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm bg-white">
              <CardContent className="p-5 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                  <Frown className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Detratores (Nota 0–6)</p>
                  <p className="text-2xl font-bold text-slate-800">{detratores}</p>
                  <p className="text-[11px] text-rose-600 font-semibold">
                    {pctDetratores.toFixed(1)}% do total
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Barra Visual de Distribuição */}
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-800">
                Distribuição Percentual de Satisfação
              </CardTitle>
            </CardHeader>
            <CardContent>
              {total === 0 ? (
                <p className="text-xs text-slate-400">
                  Nenhuma avaliação respondida nesta seleção.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="h-4 w-full rounded-full overflow-hidden flex bg-slate-100">
                    <div
                      style={{ width: `${pctPromotores}%` }}
                      className="bg-emerald-500 transition-all"
                      title={`Promotores: ${pctPromotores.toFixed(1)}%`}
                    />
                    <div
                      style={{ width: `${pctNeutros}%` }}
                      className="bg-amber-400 transition-all"
                      title={`Neutros: ${pctNeutros.toFixed(1)}%`}
                    />
                    <div
                      style={{ width: `${pctDetratores}%` }}
                      className="bg-rose-500 transition-all"
                      title={`Detratores: ${pctDetratores.toFixed(1)}%`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                      <span>Promotores ({pctPromotores.toFixed(1)}%)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                      <span>Neutros ({pctNeutros.toFixed(1)}%)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                      <span>Detratores ({pctDetratores.toFixed(1)}%)</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gestão de Detratores */}
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-500" />
                  <CardTitle className="text-base font-semibold text-slate-800">
                    Gestão de Detratores ({listaDetratores.length})
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-slate-500">
                  Avaliações com nota menor ou igual a 6 e suas justificativas registradas para
                  plano de ação.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {listaDetratores.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  Excelente! Nenhum detrator registrado nesta seleção de pesquisa.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-semibold text-slate-600 w-16">
                        Nota
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600">
                        Participante
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600">
                        Campanha
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600">
                        Justificativa do Detrator
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 text-right w-32">
                        Data
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listaDetratores.map((r) => {
                      const partNome = r.anonimo
                        ? 'Participante Anônimo'
                        : r.expand?.participant_id?.nome || 'Não identificado'
                      const campNome = r.expand?.campaign_id?.nome || 'Campanha'

                      return (
                        <TableRow key={r.id} className="hover:bg-rose-50/40">
                          <TableCell>
                            <Badge className="bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-100 font-bold text-xs">
                              {r.nota}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-medium text-slate-800">
                            {partNome}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">{campNome}</TableCell>
                          <TableCell className="text-xs text-slate-700">
                            <div className="font-semibold text-rose-900 mb-0.5">
                              {r.justificativa_detrator ||
                                'Sem justificativa obrigatória informada.'}
                            </div>
                            {r.comentario && (
                              <p className="text-slate-500 italic mt-0.5">
                                Comentário: &quot;{r.comentario}&quot;
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500 text-right">
                            {new Date(r.created).toLocaleDateString('pt-BR')}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Comentários Abertos Recentes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-sky-600" />
                  <CardTitle className="text-sm font-semibold text-slate-800">
                    Comentários e Feedbacks ({comentarios.length})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3 max-h-80 overflow-y-auto">
                {comentarios.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    Nenhum comentário registrado.
                  </p>
                ) : (
                  comentarios.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">
                          {c.anonimo ? 'Anônimo' : c.expand?.participant_id?.nome || 'Participante'}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            c.nota >= 9
                              ? 'text-emerald-700 border-emerald-200 bg-emerald-50'
                              : c.nota >= 7
                                ? 'text-amber-700 border-amber-200 bg-amber-50'
                                : 'text-rose-700 border-rose-200 bg-rose-50'
                          }`}
                        >
                          Nota {c.nota}
                        </Badge>
                      </div>
                      <p className="text-slate-600 italic">&quot;{c.comentario}&quot;</p>
                      <p className="text-[10px] text-slate-400 text-right">
                        {new Date(c.created).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-600" />
                  <CardTitle className="text-sm font-semibold text-slate-800">
                    Logs Recentes de Ações do Sistema
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-2.5 max-h-80 overflow-y-auto">
                {logs.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">Nenhum log registrado.</p>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded border border-slate-100 bg-slate-50 text-xs flex items-start justify-between gap-2"
                    >
                      <div>
                        <div className="font-semibold text-slate-800 capitalize">
                          {log.acao.replace('_', ' ')}
                        </div>
                        <div className="text-slate-500 text-[11px]">{log.detalhe}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Por: {log.usuario}</div>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {new Date(log.created).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
