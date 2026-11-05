import React, { useEffect, useState } from 'react'
import { getDispatches, sendInviteViaBackend } from '@/services/dispatches'
import { getCampaigns } from '@/services/campaigns'
import { getParticipants } from '@/services/participants'
import { Dispatch, Campaign, Participant } from '@/types/nps'
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
  Send,
  RotateCcw,
  CheckCircle2,
  XCircle,
  FileText,
  Loader2,
  Filter,
  MailCheck,
  ShieldAlert,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'

export default function DispatchesPage() {
  const [dispatches, setDispatches] = useState<Dispatch[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [isResendingAll, setIsResendingAll] = useState(false)

  const { toast } = useToast()
  const { canSendInvites, isLeitura } = usePermissions()

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [camps, dispList, parts] = await Promise.all([
        getCampaigns(),
        getDispatches(selectedCampaignId === 'all' ? undefined : selectedCampaignId),
        getParticipants(selectedCampaignId === 'all' ? undefined : selectedCampaignId),
      ])
      setCampaigns(camps)
      setDispatches(dispList)
      setParticipants(parts)
    } catch {
      toast({
        title: 'Erro ao carregar envios',
        description: 'Não foi possível buscar o histórico de envios e reenvios.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedCampaignId])

  // Reenviar convites para quem não respondeu na campanha selecionada
  const handleResendToPending = async () => {
    const pendentes = participants.filter((p) => !p.respondido)
    if (pendentes.length === 0) {
      toast({
        title: 'Nenhum pendente',
        description: 'Não há participantes com resposta pendente nesta lista.',
      })
      return
    }

    if (
      !window.confirm(
        `Deseja reenviar o convite por e-mail para ${pendentes.length} participante(s) pendente(s)?`,
      )
    ) {
      return
    }

    setIsResendingAll(true)
    let sucessos = 0
    let falhas = 0

    for (const p of pendentes) {
      try {
        const res = await sendInviteViaBackend(p.campaign_id, p.id, true)
        if (res.success) {
          sucessos++
        } else {
          falhas++
        }
      } catch {
        falhas++
      }
    }

    setIsResendingAll(false)
    toast({
      title: 'Disparo de reenvio concluído',
      description: `${sucessos} reenvio(s) realizados com sucesso. ${falhas > 0 ? `(${falhas} falhas)` : ''}`,
    })
    loadData()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Envios e Convites</h1>
          <p className="text-sm text-slate-500">
            Acompanhe o histórico de convites, reenvios e acione disparos para quem não respondeu.
          </p>
        </div>

        {canSendInvites ? (
          <Button
            onClick={handleResendToPending}
            disabled={isResendingAll || participants.filter((p) => !p.respondido).length === 0}
            className="bg-sky-600 hover:bg-sky-700 text-xs shrink-0"
          >
            {isResendingAll ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Reenviando...
              </>
            ) : (
              <>
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Reenviar a Pendentes ({participants.filter((p) => !p.respondido).length})
              </>
            )}
          </Button>
        ) : (
          <Badge
            variant="outline"
            className="bg-slate-50 text-slate-600 border-slate-200 text-xs gap-1.5 py-1.5 px-3 shrink-0"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
            Acesso de {isLeitura ? 'somente leitura' : 'consulta'} — sem ações de disparo
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600 shrink-0">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Total de Disparos</p>
              <p className="text-xl font-bold text-slate-800">{dispatches.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
              <MailCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Envios com Sucesso</p>
              <p className="text-xl font-bold text-slate-800">
                {dispatches.filter((d) => d.status === 'sucesso').length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Aguardando Resposta</p>
              <p className="text-xl font-bold text-slate-800">
                {participants.filter((p) => !p.respondido).length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-sky-600" />
              <CardTitle className="text-base font-semibold text-slate-800">
                Histórico de Disparos ({dispatches.length})
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500">
              Registros detalhados de convites enviados, reenvios e links distribuídos.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
              <SelectTrigger className="w-56 text-xs h-8">
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
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-sky-600 mb-2" />
              <p className="text-xs">Carregando histórico...</p>
            </div>
          ) : dispatches.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              Nenhum envio registrado no histórico até o momento.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold text-slate-600">Tipo</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">
                    Destinatário
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Campanha</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Detalhe</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 text-right">
                    Data / Hora
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dispatches.map((d) => {
                  const campNome = d.expand?.campaign_id?.nome || 'Campanha'

                  return (
                    <TableRow key={d.id} className="hover:bg-slate-50/70">
                      <TableCell>
                        {d.tipo === 'inicial' && (
                          <Badge
                            variant="outline"
                            className="text-[11px] bg-sky-50 text-sky-700 border-sky-200"
                          >
                            Inicial
                          </Badge>
                        )}
                        {d.tipo === 'reenvio' && (
                          <Badge
                            variant="outline"
                            className="text-[11px] bg-amber-50 text-amber-700 border-amber-200"
                          >
                            Reenvio
                          </Badge>
                        )}
                        {d.tipo === 'copia_link' && (
                          <Badge
                            variant="outline"
                            className="text-[11px] bg-slate-100 text-slate-600 border-slate-200"
                          >
                            Link Copiado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-slate-800 text-xs">
                        {d.destinatario}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">{campNome}</TableCell>
                      <TableCell>
                        {d.status === 'sucesso' && (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 text-xs gap-1 font-medium">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Sucesso
                          </Badge>
                        )}
                        {d.status === 'falha' && (
                          <Badge
                            variant="outline"
                            className="bg-rose-50 text-rose-700 border-rose-200 text-xs gap-1 font-medium"
                          >
                            <XCircle className="w-3 h-3 text-rose-600" />
                            Falha
                          </Badge>
                        )}
                        {d.status === 'registrado' && (
                          <Badge
                            variant="outline"
                            className="bg-slate-100 text-slate-600 border-slate-200 text-xs gap-1 font-medium"
                          >
                            Registrado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell
                        className="text-xs text-slate-500 max-w-xs truncate"
                        title={d.detalhe}
                      >
                        {d.detalhe || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 text-right">
                        {new Date(d.created).toLocaleString('pt-BR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
