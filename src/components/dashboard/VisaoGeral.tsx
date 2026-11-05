// Visão Geral do Dashboard NPS — todas as campanhas, com filtro por área e por
// intervalo de datas (padrão: últimos 90 dias). O filtro afeta TODOS os números.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Megaphone, MessageSquare, Loader2, ArrowRight, Filter } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FiltroPeriodoArea } from '@/components/dashboard/FiltroPeriodoArea'
import {
  carregarAreas,
  carregarCampanhas,
  carregarRespostas,
  filtrarCampanhas,
  periodoPadrao,
  npsTexto,
  type PeriodoFiltro,
} from '@/services/dashboard'
import { calcularNps, formulaNps } from '@/lib/nps/calculos'
import { useToast } from '@/hooks/use-toast'
import type { Area, Campaign, SurveyResponse } from '@/types/nps'

function corNps(nps: number | null): string {
  if (nps === null) return 'text-slate-400'
  if (nps >= 50) return 'text-emerald-600'
  if (nps >= 0) return 'text-amber-600'
  return 'text-rose-600'
}

export function VisaoGeral() {
  const [areas, setAreas] = useState<Area[]>([])
  const [campanhas, setCampanhas] = useState<Campaign[]>([])
  const [respostas, setRespostas] = useState<SurveyResponse[]>([])
  const [carregando, setCarregando] = useState(true)
  const [periodo, setPeriodo] = useState<PeriodoFiltro>(periodoPadrao())
  const [areaId, setAreaId] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    Promise.all([carregarCampanhas(), carregarRespostas(), carregarAreas()])
      .then(([cs, rs, as]) => {
        if (!ativo) return
        setCampanhas(cs)
        setRespostas(rs)
        setAreas(as)
      })
      .catch(() => {
        if (ativo)
          toast({
            title: 'Erro ao carregar o dashboard',
            description: 'Não foi possível carregar os indicadores de NPS.',
            variant: 'destructive',
          })
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [])

  const noPeriodo = useMemo(
    () =>
      respostas.filter(
        (r) =>
          r.created >= `${periodo.de}T00:00:00.000Z` && r.created <= `${periodo.ate}T23:59:59.999Z`,
      ),
    [respostas, periodo],
  )

  const campanhasFiltradas = useMemo(() => filtrarCampanhas(campanhas, areaId), [campanhas, areaId])

  const respostasFiltradas = useMemo(
    () =>
      areaId
        ? noPeriodo.filter((r) => campanhasFiltradas.some((c) => c.id === r.campaign_id))
        : noPeriodo,
    [noPeriodo, areaId, campanhasFiltradas],
  )

  const npsGeral = useMemo(() => calcularNps(respostasFiltradas), [respostasFiltradas])

  const linhas = useMemo(
    () =>
      campanhasFiltradas.map((c) => {
        const rs = respostasFiltradas.filter((r) => r.campaign_id === c.id)
        const d = calcularNps(rs)
        return { campaign: c, respostas: rs.length, nps: d.nps, total: d.total }
      }),
    [campanhasFiltradas, respostasFiltradas],
  )

  const ativas = campanhasFiltradas.filter((c) => c.status === 'ativa').length

  if (carregando) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-sky-600 mb-3" />
        <p className="text-sm">Calculando indicadores do período…</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Filtros: área + intervalo de datas (padrão últimos 90 dias) */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3 text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Filtros — afetam todos os números abaixo
            </span>
          </div>
          <FiltroPeriodoArea
            periodo={periodo}
            onPeriodo={setPeriodo}
            areas={areas}
            areaId={areaId}
            onArea={setAreaId}
          />
        </CardContent>
      </Card>

      {/* Cards do período */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-700 shrink-0">
              <Megaphone className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Campanhas ativas</p>
              <p className="text-2xl font-bold text-slate-800">{ativas}</p>
              <p className="text-[11px] text-slate-400">de {campanhasFiltradas.length} no filtro</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Respostas no período</p>
              <p className="text-2xl font-bold text-slate-800">{npsGeral.total}</p>
              <p className="text-[11px] text-slate-400">
                {periodo.de} a {periodo.ate}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader className="pb-0 px-5">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              NPS geral do período
            </CardDescription>
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-extrabold tracking-tight ${corNps(npsGeral.nps)}`}>
                {npsTexto(npsGeral.nps) === '—'
                  ? '—'
                  : npsGeral.nps! > 0
                    ? `+${npsGeral.nps}`
                    : String(npsGeral.nps)}
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-1 px-5">
            <p className="text-[11px] text-slate-400">{formulaNps(npsGeral)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de campanhas com o NPS de cada uma */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-sky-600" />
            <CardTitle className="text-base font-semibold text-slate-800">
              NPS por campanha
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-500">
            Nota de 0 a 10; NPS = %promotores (9–10) − %detratores (0–6), no período filtrado.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {linhas.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">
              Nenhuma campanha no filtro selecionado.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold text-slate-600">Campanha</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 text-right">
                    Respostas no período
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 text-right">
                    NPS do período
                  </TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l) => (
                  <TableRow key={l.campaign.id} className="hover:bg-sky-50/40">
                    <TableCell className="text-xs font-medium text-slate-800">
                      {l.campaign.nome}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          l.campaign.status === 'ativa'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : l.campaign.status === 'rascunho'
                              ? 'bg-slate-100 text-slate-600 border-slate-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {l.campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 text-right">
                      {l.respostas}
                    </TableCell>
                    <TableCell className={`text-sm font-bold text-right ${corNps(l.nps)}`}>
                      {npsTexto(l.nps) === '—' ? '—' : l.nps! > 0 ? `+${l.nps}` : String(l.nps)}
                    </TableCell>
                    <TableCell>
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px] text-sky-700"
                      >
                        <Link to={`/admin/dashboard/${l.campaign.id}`}>
                          Detalhes <ArrowRight className="w-3 h-3 ml-1" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
