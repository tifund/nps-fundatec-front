import { useEffect, useMemo, useState } from 'react'
import { getCampaigns, getCampaignById } from '@/services/campaigns'
import { getDispatches } from '@/services/dispatches'
import { Campaign, Dispatch } from '@/types/nps'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Send, Loader2, Search, Filter, RefreshCw, ChevronLeft, Mail } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'
import { fmtData, fmtDataCurta } from '@/lib/importacao/formato'
import { cn } from '@/lib/utils'

const TIPO_LABEL: Record<string, string> = {
  inicial: 'Envio inicial',
  reenvio: 'Reenvio',
  copia_link: 'Cópia de link',
}

const STATUS_LABEL: Record<string, string> = {
  sucesso: 'Enviado',
  falha: 'Erro',
  registrado: 'Registrado',
}

function statusBadge(status: string) {
  if (status === 'sucesso')
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 text-xs font-medium gap-1">
        <Mail className="w-3 h-3" /> {STATUS_LABEL[status]}
      </Badge>
    )
  if (status === 'falha')
    return (
      <Badge
        variant="outline"
        className="bg-rose-50 text-rose-700 border-rose-200 text-xs font-medium"
      >
        {STATUS_LABEL[status]}
      </Badge>
    )
  return (
    <Badge
      variant="outline"
      className="bg-slate-50 text-slate-600 border-slate-200 text-xs font-medium"
    >
      {STATUS_LABEL[status] || status}
    </Badge>
  )
}

function tipoBadge(tipo: string) {
  const map: Record<string, string> = {
    inicial: 'bg-sky-50 text-sky-700 border-sky-200',
    reenvio: 'bg-amber-50 text-amber-700 border-amber-200',
    copia_link: 'bg-slate-50 text-slate-600 border-slate-200',
  }
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', map[tipo] || '')}>
      {TIPO_LABEL[tipo] || tipo}
    </Badge>
  )
}

/**
 * Tela "Envios": log completo de disparos (nada é apagado), com filtro por
 * tipo (inicial/reenvio/cópia de link) e busca por e-mail do destinatário.
 */
export default function DispatchesPage() {
  const [dispatches, setDispatches] = useState<Dispatch[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [filtroTipo, setFiltroTipo] = useState<string>('all')
  const [filtroStatus, setFiltroStatus] = useState<string>('all')
  const [filtroCampanha, setFiltroCampanha] = useState<string>('all')
  const [busca, setBusca] = useState('')
  const [detalheAberto, setDetalheAberto] = useState<string | null>(null)

  const { toast } = useToast()
  const { canManageCampaigns } = usePermissions()

  const load = async (silencioso: boolean = false) => {
    if (!silencioso) setIsLoading(true)
    setIsRefreshing(true)
    try {
      const [d, c] = await Promise.all([getDispatches(), getCampaigns()])
      setDispatches(d)
      setCampaigns(c)
    } catch {
      if (!silencioso) {
        toast({
          title: 'Erro ao carregar envios',
          description: 'Não foi possível carregar o log de envios.',
          variant: 'destructive',
        })
      }
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtrados = useMemo(() => {
    let lista = dispatches
    if (filtroTipo !== 'all') lista = lista.filter((d) => d.tipo === filtroTipo)
    if (filtroStatus !== 'all') lista = lista.filter((d) => d.status === filtroStatus)
    if (filtroCampanha !== 'all') lista = lista.filter((d) => d.campaign_id === filtroCampanha)
    if (busca.trim()) {
      const termo = busca.trim().toLowerCase()
      lista = lista.filter(
        (d) =>
          (d.destinatario || '').toLowerCase().includes(termo) ||
          (d.expand?.participant_id?.nome || '').toLowerCase().includes(termo),
      )
    }
    return lista
  }, [dispatches, filtroTipo, filtroStatus, filtroCampanha, busca])

  const resumo = useMemo(() => {
    const enviados = dispatches.filter((d) => d.status === 'sucesso').length
    const erros = dispatches.filter((d) => d.status === 'falha').length
    return { enviados, erros, total: dispatches.length }
  }, [dispatches])

  const nomeCampanha = (id: string) => campaigns.find((c) => c.id === id)?.nome || '—'

  if (isLoading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-sky-600 mb-2" />
        <p className="text-xs">Carregando log de envios...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Envios</h1>
          <p className="text-sm text-slate-500">
            Log completo de convites disparados — nada é removido deste histórico.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 text-xs shrink-0"
          onClick={() => load(true)}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', isRefreshing && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      {/* Resumo geral */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-slate-800">{resumo.total}</p>
            <p className="text-xs text-slate-500">Registros no log</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 shadow-sm">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-emerald-700">{resumo.enviados}</p>
            <p className="text-xs text-emerald-600">E-mails enviados</p>
          </CardContent>
        </Card>
        <Card className="border-rose-200 shadow-sm">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-rose-700">{resumo.erros}</p>
            <p className="text-xs text-rose-600">Erros de envio</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-sky-600" />
            <CardTitle className="text-base font-semibold text-slate-800">
              Log de disparos ({filtrados.length})
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-500">
            Cada linha registra data/hora, destinatário, tipo e status do disparo.
          </CardDescription>
          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <Input
                placeholder="Buscar por e-mail ou nome do participante..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-8 text-xs pl-8 bg-white"
              />
            </div>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-full sm:w-[170px] h-8 text-xs bg-white">
                <Filter className="w-3 h-3 mr-1 text-slate-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="inicial">Envio inicial</SelectItem>
                <SelectItem value="reenvio">Reenvio</SelectItem>
                <SelectItem value="copia_link">Cópia de link</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-full sm:w-[150px] h-8 text-xs bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="sucesso">Enviado</SelectItem>
                <SelectItem value="falha">Erro</SelectItem>
                <SelectItem value="registrado">Registrado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroCampanha} onValueChange={setFiltroCampanha}>
              <SelectTrigger className="w-full sm:w-[200px] h-8 text-xs bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as campanhas</SelectItem>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtrados.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              Nenhum envio registrado com os filtros atuais.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold text-slate-600">Data/hora</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">
                    Destinatário
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Campanha</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Tipo</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Detalhe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((d) => (
                  <TableRow key={d.id} className="hover:bg-slate-50/70">
                    <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                      {d.created ? new Date(d.created).toLocaleString('pt-BR') : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-slate-700">
                      {d.expand?.participant_id?.nome ? (
                        <>
                          <div className="font-medium">{d.expand.participant_id.nome}</div>
                          <div className="text-slate-400">{d.destinatario}</div>
                        </>
                      ) : (
                        d.destinatario
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 max-w-[180px] truncate">
                      {nomeCampanha(d.campaign_id)}
                    </TableCell>
                    <TableCell>{tipoBadge(d.tipo)}</TableCell>
                    <TableCell>{statusBadge(d.status)}</TableCell>
                    <TableCell className="text-xs text-slate-500 max-w-[240px]">
                      {d.detalhe ? (
                        <span
                          className="cursor-pointer hover:text-slate-800 truncate block"
                          title="Clique para ver o detalhe completo"
                          onClick={() => setDetalheAberto(detalheAberto === d.id ? null : d.id)}
                        >
                          {detalheAberto === d.id ? d.detalhe : d.detalhe}
                        </span>
                      ) : (
                        '—'
                      )}
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
