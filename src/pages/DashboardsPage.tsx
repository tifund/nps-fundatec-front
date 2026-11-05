// Roteador de dashboards: sem campanha selecionada mostra a Visão Geral;
// com :id mostra o painel da campanha (KPIs, gráficos, detratores, relatório).
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { VisaoGeral } from '@/components/dashboard/VisaoGeral'
import { PainelCampanha } from '@/components/dashboard/PainelCampanha'
import { getParticipants } from '@/services/participants'
import { getSurveyResponses } from '@/services/responses'
import { marcarTratado } from '@/services/tratativa'
import { periodoPadrao, carregarCampanhas, type PeriodoFiltro } from '@/services/dashboard'
import { useToast } from '@/hooks/use-toast'
import type { Campaign, Participant, SurveyResponse } from '@/types/nps'

export function DashboardsPage() {
  const { id } = useParams<{ id?: string }>()
  const [periodo, setPeriodo] = useState<PeriodoFiltro>(periodoPadrao())
  const [campanha, setCampanha] = useState<Campaign | null>(null)
  const [respostas, setRespostas] = useState<SurveyResponse[]>([])
  const [participantes, setParticipantes] = useState(0)
  const [carregando, setCarregando] = useState(false)
  const { toast } = useToast()

  const carregarCampanha = useCallback(async (campaignId: string) => {
    setCarregando(true)
    try {
      const [cs, rs, ps] = await Promise.all([
        carregarCampanhas(),
        getSurveyResponses(campaignId),
        getParticipants(campaignId).catch(() => [] as Participant[]),
      ])
      const c = cs.find((x) => x.id === campaignId) || null
      setCampanha(c)
      setRespostas(rs)
      setParticipantes(ps.length)
      if (!c) {
        toast({
          title: 'Campanha não encontrada',
          description: 'Volte à visão geral e selecione outra campanha.',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Erro ao carregar a campanha',
        description: 'Não foi possível carregar os indicadores.',
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (id) void carregarCampanha(id)
  }, [id, carregarCampanha])

  const atualizarTratativa = async (rid: string, notaInterna: string) => {
    await marcarTratado(rid, notaInterna)
    setRespostas((rs) =>
      rs.map((r) =>
        r.id === rid
          ? { ...r, tratado: true, nota_interna: notaInterna, tratado_em: new Date().toISOString() }
          : r,
      ),
    )
  }

  if (id && carregando) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-sky-600 mb-3" />
        <p className="text-sm">Carregando painel da campanha…</p>
      </div>
    )
  }

  if (id && !campanha) {
    return (
      <div className="py-16 text-center text-sm text-slate-500">
        Campanha não encontrada. Volte à{' '}
        <a href="/admin/dashboard" className="text-sky-700 underline">
          visão geral
        </a>
        .
      </div>
    )
  }

  if (id && campanha) {
    return (
      <PainelCampanha
        campanha={campanha}
        participantes={participantes}
        respostas={respostas}
        periodo={periodo}
        onPeriodo={setPeriodo}
      />
    )
  }

  return <VisaoGeral />
}
