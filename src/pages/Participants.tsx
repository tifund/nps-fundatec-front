import React, { useEffect, useState } from 'react'
import {
  getParticipants,
  createParticipant,
  importParticipantsBatch,
} from '@/services/participants'
import { getCampaigns } from '@/services/campaigns'
import { sendInviteViaBackend } from '@/services/dispatches'
import { Participant, Campaign } from '@/types/nps'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Users,
  UserPlus,
  Upload,
  Copy,
  Send,
  Loader2,
  CheckCircle2,
  Clock,
  Filter,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function ParticipantsPage() {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)

  // Modal Cadastro Individual
  const [isSingleDialogOpen, setIsSingleDialogOpen] = useState(false)
  const [singleNome, setSingleNome] = useState('')
  const [singleEmail, setSingleEmail] = useState('')
  const [singleCampaignId, setSingleCampaignId] = useState('')
  const [isSubmittingSingle, setIsSubmittingSingle] = useState(false)

  // Modal Importação em Lote
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false)
  const [batchText, setBatchText] = useState('')
  const [batchCampaignId, setBatchCampaignId] = useState('')
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false)

  // Status de envio
  const [sendingId, setSendingId] = useState<string | null>(null)

  const { toast } = useToast()

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [camps, parts] = await Promise.all([
        getCampaigns(),
        getParticipants(selectedCampaignId === 'all' ? undefined : selectedCampaignId),
      ])
      setCampaigns(camps)
      setParticipants(parts)
    } catch {
      toast({
        title: 'Erro ao carregar participantes',
        description: 'Não foi possível carregar os registros de participantes.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedCampaignId])

  const handleOpenSingle = () => {
    setSingleNome('')
    setSingleEmail('')
    setSingleCampaignId(selectedCampaignId !== 'all' ? selectedCampaignId : campaigns[0]?.id || '')
    setIsSingleDialogOpen(true)
  }

  const handleOpenBatch = () => {
    setBatchText('')
    setBatchCampaignId(selectedCampaignId !== 'all' ? selectedCampaignId : campaigns[0]?.id || '')
    setIsBatchDialogOpen(true)
  }

  const handleSaveSingle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!singleNome.trim() || !singleEmail.trim() || !singleCampaignId) return

    setIsSubmittingSingle(true)
    try {
      await createParticipant({
        campaign_id: singleCampaignId,
        nome: singleNome.trim(),
        email: singleEmail.trim().toLowerCase(),
      })
      toast({
        title: 'Participante cadastrado',
        description: 'O participante foi incluído na campanha com sucesso.',
      })
      setIsSingleDialogOpen(false)
      loadData()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao cadastrar',
        description: (err as Error)?.message || 'Ocorreu um erro ao salvar o participante.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmittingSingle(false)
    }
  }

  const handleImportBatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!batchText.trim() || !batchCampaignId) return

    setIsSubmittingBatch(true)
    try {
      // Processa linhas no formato: Nome, email OU Nome; email OU Nome <email>
      const lines = batchText.split('\n')
      const parsedList: { nome: string; email: string }[] = []

      for (const line of lines) {
        const clean = line.trim()
        if (!clean) continue

        let nome = ''
        let email = ''

        if (clean.includes(',')) {
          const parts = clean.split(',')
          nome = parts[0]?.trim()
          email = parts[1]?.trim()
        } else if (clean.includes(';')) {
          const parts = clean.split(';')
          nome = parts[0]?.trim()
          email = parts[1]?.trim()
        } else if (clean.includes('\t')) {
          const parts = clean.split('\t')
          nome = parts[0]?.trim()
          email = parts[1]?.trim()
        } else if (clean.includes('<') && clean.includes('>')) {
          const match = clean.match(/^(.*)<(.*)>$/)
          if (match) {
            nome = match[1]?.trim()
            email = match[2]?.trim()
          }
        }

        if (nome && email && email.includes('@')) {
          parsedList.push({ nome, email })
        }
      }

      if (parsedList.length === 0) {
        toast({
          title: 'Formato inválido',
          description: 'Não foram encontrados registros válidos de nome e e-mail.',
          variant: 'destructive',
        })
        setIsSubmittingBatch(false)
        return
      }

      const result = await importParticipantsBatch(batchCampaignId, parsedList)
      toast({
        title: 'Importação concluída',
        description: `${result.added} participante(s) importado(s) com sucesso. ${
          result.errors > 0 ? `(${result.errors} erros)` : ''
        }`,
      })

      setIsBatchDialogOpen(false)
      loadData()
    } catch (err: unknown) {
      toast({
        title: 'Erro na importação',
        description: (err as Error)?.message || 'Falha ao importar os dados.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmittingBatch(false)
    }
  }

  const handleCopyPersonalLink = (p: Participant) => {
    const url = `${window.location.origin}/avaliar/${p.token}`
    navigator.clipboard.writeText(url)
    toast({
      title: 'Link pessoal copiado!',
      description: `Link do participante ${p.nome} copiado para a área de transferência.`,
    })
  }

  const handleSendInvite = async (p: Participant, isResend: boolean = false) => {
    setSendingId(p.id)
    try {
      const res = await sendInviteViaBackend(p.campaign_id, p.id, isResend)
      if (res.success) {
        toast({
          title: isResend ? 'Reenvio disparado' : 'Convite enviado',
          description: `E-mail de pesquisa encaminhado para ${p.email}.`,
        })
      } else {
        toast({
          title: 'Tentativa registrada',
          description: res.detalhe || 'Envio registrado no histórico do sistema.',
        })
      }
    } catch {
      toast({
        title: 'Erro no envio',
        description: 'Não foi possível disparar o convite por e-mail.',
        variant: 'destructive',
      })
    } finally {
      setSendingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Participantes</h1>
          <p className="text-sm text-slate-500">
            Gerencie o público-alvo das pesquisas, importe listas e copie links pessoais.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" onClick={handleOpenBatch} className="text-xs">
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Importar em Lote
          </Button>
          <Button onClick={handleOpenSingle} className="bg-sky-600 hover:bg-sky-700 text-xs">
            <UserPlus className="w-3.5 h-3.5 mr-1.5" />
            Novo Participante
          </Button>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-sky-600" />
              <CardTitle className="text-base font-semibold text-slate-800">
                Lista de Participantes ({participants.length})
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500">
              Cada participante possui um token e link exclusivo para resposta individual.
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
              <p className="text-xs">Carregando participantes...</p>
            </div>
          ) : participants.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              Nenhum participante encontrado. Clique em &quot;Novo Participante&quot; ou
              &quot;Importar em Lote&quot;.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold text-slate-600">
                    Participante
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Campanha</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Situação</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">
                    Data de Resposta
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 text-right">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participants.map((p) => {
                  const campNome = p.expand?.campaign_id?.nome || 'Campanha'
                  const isSending = sendingId === p.id

                  return (
                    <TableRow key={p.id} className="hover:bg-slate-50/70">
                      <TableCell>
                        <div className="font-semibold text-slate-800 text-sm">{p.nome}</div>
                        <div className="text-xs text-slate-500">{p.email}</div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-700 font-medium">
                        {campNome}
                      </TableCell>
                      <TableCell>
                        {p.respondido ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 text-xs gap-1 font-medium">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Respondido
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-700 border-amber-200 text-xs gap-1 font-medium"
                          >
                            <Clock className="w-3 h-3 text-amber-600" />
                            Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {p.respondido_em
                          ? new Date(p.respondido_em).toLocaleString('pt-BR', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs text-slate-700 hover:text-sky-700"
                          onClick={() => handleCopyPersonalLink(p)}
                          title="Copiar link exclusivo de avaliação"
                        >
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          Copiar Link
                        </Button>

                        {!p.respondido ? (
                          <Button
                            variant="default"
                            size="sm"
                            className="h-8 text-xs bg-sky-600 hover:bg-sky-700"
                            disabled={isSending}
                            onClick={() => handleSendInvite(p, false)}
                            title="Disparar convite por e-mail"
                          >
                            {isSending ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                            ) : (
                              <Send className="w-3.5 h-3.5 mr-1" />
                            )}
                            Enviar Convite
                          </Button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic px-2">Finalizado</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal Cadastro Individual */}
      <Dialog open={isSingleDialogOpen} onOpenChange={setIsSingleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveSingle}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-800">
                Cadastrar Participante
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Informe os dados do participante para gerar o link individual de resposta.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="single-camp" className="text-xs font-medium text-slate-700">
                  Campanha de Destino *
                </Label>
                <Select value={singleCampaignId} onValueChange={setSingleCampaignId}>
                  <SelectTrigger id="single-camp" className="text-sm">
                    <SelectValue placeholder="Selecione a campanha" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="single-nome" className="text-xs font-medium text-slate-700">
                  Nome Completo *
                </Label>
                <Input
                  id="single-nome"
                  placeholder="Ex: Gabriel Martins"
                  value={singleNome}
                  onChange={(e) => setSingleNome(e.target.value)}
                  required
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="single-email" className="text-xs font-medium text-slate-700">
                  E-mail do Participante *
                </Label>
                <Input
                  id="single-email"
                  type="email"
                  placeholder="gabriel.martins@exemplo.com"
                  value={singleEmail}
                  onChange={(e) => setSingleEmail(e.target.value)}
                  required
                  className="text-sm"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSingleDialogOpen(false)}
                disabled={isSubmittingSingle}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-sky-600 hover:bg-sky-700"
                disabled={isSubmittingSingle}
              >
                {isSubmittingSingle ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Participante'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Importação em Lote */}
      <Dialog open={isBatchDialogOpen} onOpenChange={setIsBatchDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleImportBatch}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-800">
                Importar Participantes em Lote
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Cole uma lista com nome e e-mail separados por vírgula, ponto e vírgula ou tabulação
                (um por linha).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="batch-camp" className="text-xs font-medium text-slate-700">
                  Campanha de Destino *
                </Label>
                <Select value={batchCampaignId} onValueChange={setBatchCampaignId}>
                  <SelectTrigger id="batch-camp" className="text-sm">
                    <SelectValue placeholder="Selecione a campanha" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="batch-text" className="text-xs font-medium text-slate-700">
                  Lista de Participantes (Nome, E-mail) *
                </Label>
                <Textarea
                  id="batch-text"
                  rows={8}
                  placeholder={`Mariana Silva, mariana@exemplo.com\nCarlos Eduardo, carlos@exemplo.com\nJuliana Ramos; juliana@exemplo.com`}
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  required
                  className="text-xs font-mono"
                />
                <p className="text-[11px] text-slate-400">
                  Formatos aceitos: <code>Nome, email@dominio.com</code> ou{' '}
                  <code>Nome; email@dominio.com</code>.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsBatchDialogOpen(false)}
                disabled={isSubmittingBatch}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-sky-600 hover:bg-sky-700"
                disabled={isSubmittingBatch || !batchText.trim()}
              >
                {isSubmittingBatch ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  'Processar Importação'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
