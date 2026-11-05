import React, { useEffect, useMemo, useState } from 'react'
import {
  getCampaigns,
  getCampaignQuestions,
  getCampaignStats,
  createCampaign,
  updateCampaign,
  createQuestion,
  deleteQuestion,
  closeCampaign,
  deleteCampaign,
} from '@/services/campaigns'
import { getAreas } from '@/services/areas'
import { Campaign, Area, CampaignStats, Question } from '@/types/nps'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Plus,
  Megaphone,
  Loader2,
  Copy,
  Trash2,
  Lock,
  Calendar,
  ShieldAlert,
  Filter,
  Search,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'
import CampaignFormDialog, { toPayload } from '@/components/CampaignFormDialog'
import CampaignList from '@/components/CampaignList'
import { CreateCampaignPayload } from '@/types/nps'

const COLLECTION = 'campaigns'
const QUESTIONS_COLLECTION = 'questions'

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [stats, setStats] = useState<Record<string, CampaignStats>>({})
  const [isLoading, setIsLoading] = useState(true)

  // Filtros
  const [filtroArea, setFiltroArea] = useState<string>('all')
  const [filtroStatus, setFiltroStatus] = useState<string>('all')
  const [busca, setBusca] = useState('')

  // Modal Campanha
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)

  // Modal Perguntas Adicionais
  const [selectedCampaignForQuestions, setSelectedCampaignForQuestions] = useState<Campaign | null>(
    null,
  )
  const [questions, setQuestions] = useState<Question[]>([])
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false)
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false)
  const [novoEnunciado, setNovoEnunciado] = useState('')
  const [novoTipo, setNovoTipo] = useState<'nota' | 'texto'>('nota')
  const [novaObrigatoria, setNovaObrigatoria] = useState(false)

  // Modal de confirmação (excluir/encerrar)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    tipo: 'excluir' | 'encerrar'
    campaign: Campaign | null
  }>({ open: false, tipo: 'excluir', campaign: null })
  const [isProcessing, setIsProcessing] = useState(false)

  const { toast } = useToast()
  const { canManageCampaigns, isLeitura } = usePermissions()

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [camps, allAreas] = await Promise.all([getCampaigns(), getAreas()])
      setCampaigns(camps)
      setAreas(allAreas)
      try {
        const s = await getCampaignStats(camps.map((c) => c.id))
        setStats(s.stats)
      } catch {
        // estatísticas são informativas — não bloqueiam a tela
        setStats({})
      }
    } catch {
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar as campanhas e áreas.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const campaignsFiltradas = useMemo(() => {
    let lista = campaigns
    if (filtroArea !== 'all') lista = lista.filter((c) => c.area_id === filtroArea)
    if (filtroStatus !== 'all') {
      lista = lista.filter((c) => {
        if (filtroStatus === 'expirada') {
          return (
            c.vigencia_tipo === 'prazo' && c.vigencia_fim && new Date(c.vigencia_fim) < new Date()
          )
        }
        return c.status === filtroStatus
      })
    }
    if (busca.trim()) {
      const termo = busca.trim().toLowerCase()
      lista = lista.filter(
        (c) => c.nome.toLowerCase().includes(termo) || c.slug.toLowerCase().includes(termo),
      )
    }
    return lista
  }, [campaigns, filtroArea, filtroStatus, busca])

  const handleOpenCreate = () => {
    setEditingCampaign(null)
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (c: Campaign) => {
    setEditingCampaign(c)
    setIsDialogOpen(true)
  }

  const handleSave = async (
    valores: Parameters<typeof toPayload>[0],
    perguntas: { enunciado: string; tipo: 'nota' | 'texto'; obrigatoria: boolean; ordem: number }[],
  ) => {
    setIsSubmitting(true)
    try {
      const payload: CreateCampaignPayload = toPayload(valores)
      if (editingCampaign) {
        await updateCampaignById(editingCampaign.id, payload, perguntas)
        toast({
          title: 'Campanha atualizada',
          description: 'Alterações salvas com sucesso.',
        })
      } else {
        await createCampaignById(payload, perguntas)
        toast({
          title: 'Campanha criada',
          description: 'Nova campanha de NPS cadastrada com sucesso.',
        })
      }
      setIsDialogOpen(false)
      setEditingCampaign(null)
      loadData()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao salvar campanha',
        description: (err as Error)?.message || 'Ocorreu um erro ao salvar os dados.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // create/update delegam para os serviços
  const createCampaignById = async (
    payload: CreateCampaignPayload,
    perguntas: { enunciado: string; tipo: 'nota' | 'texto'; obrigatoria: boolean; ordem: number }[],
  ) => createCampaign(payload, perguntas)

  const updateCampaignById = async (
    id: string,
    payload: CreateCampaignPayload,
    perguntas: { enunciado: string; tipo: 'nota' | 'texto'; obrigatoria: boolean; ordem: number }[],
  ) => updateCampaign(id, payload, perguntas)

  const copyOpenLink = (camp: Campaign) => {
    const url = `${window.location.origin}/avaliar/aberto/${camp.slug}`
    navigator.clipboard.writeText(url)
    toast({
      title: 'Link copiado!',
      description: 'O link aberto da campanha foi copiado para a área de transferência.',
    })
  }

  const confirmClose = async () => {
    if (!confirmDialog.campaign) return
    setIsProcessing(true)
    try {
      await closeCampaign(confirmDialog.campaign.id)
      toast({
        title: 'Campanha encerrada',
        description: `A campanha "${confirmDialog.campaign.nome}" foi encerrada para novas respostas.`,
      })
      setConfirmDialog({ open: false, tipo: 'excluir', campaign: null })
      loadData()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao encerrar',
        description: (err as Error)?.message || 'Não foi possível encerrar a campanha.',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const confirmDelete = async () => {
    if (!confirmDialog.campaign) return
    setIsProcessing(true)
    try {
      await deleteCampaign(confirmDialog.campaign.id)
      toast({
        title: 'Campanha excluída',
        description: `A campanha "${confirmDialog.campaign.nome}" foi removida.`,
      })
      setConfirmDialog({ open: false, tipo: 'excluir', campaign: null })
      loadData()
    } catch (err: unknown) {
      toast({
        title: 'Não foi possível excluir',
        description:
          (err as Error)?.message ||
          'Campanhas com respostas registradas não podem ser excluídas — apenas encerradas.',
        variant: 'destructive',
      })
      setConfirmDialog({ open: false, tipo: 'excluir', campaign: null })
      loadData()
    } finally {
      setIsProcessing(false)
    }
  }

  // Gerenciamento de Perguntas Adicionais
  const handleOpenQuestions = async (c: Campaign) => {
    setSelectedCampaignForQuestions(c)
    setIsQuestionDialogOpen(true)
    setIsLoadingQuestions(true)
    try {
      const qList = await getCampaignQuestions(c.id)
      setQuestions(
        qList.map((q) => ({
          id: q.id,
          campaign_id: q.campaign_id,
          enunciado: q.enunciado,
          tipo: q.tipo,
          obrigatoria: q.obrigatoria,
          ordem: q.ordem,
          created: '',
          updated: '',
        })),
      )
    } catch {
      toast({
        title: 'Erro ao carregar perguntas',
        description: 'Não foi possível buscar as perguntas adicionais da campanha.',
        variant: 'destructive',
      })
    } finally {
      setIsLoadingQuestions(false)
    }
  }

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCampaignForQuestions || !novoEnunciado.trim()) return

    try {
      await createQuestion({
        campaign_id: selectedCampaignForQuestions.id,
        enunciado: novoEnunciado.trim(),
        tipo: novoTipo,
        obrigatoria: novaObrigatoria,
        ordem: questions.length + 1,
      })
      setNovoEnunciado('')
      setNovaObrigatoria(false)
      const qList = await getCampaignQuestions(selectedCampaignForQuestions.id)
      setQuestions(qList.map((q) => ({ ...q, created: '', updated: '' })) as Question[])
      toast({
        title: 'Pergunta adicionada',
        description: 'Pergunta complementar vinculada com sucesso.',
      })
    } catch {
      toast({
        title: 'Erro ao adicionar pergunta',
        description: 'Não foi possível salvar a pergunta complementar.',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteQuestion = async (qId: string) => {
    try {
      await deleteQuestion(qId)
      if (selectedCampaignForQuestions) {
        const qList = await getCampaignQuestions(selectedCampaignForQuestions.id)
        setQuestions(qList.map((q) => ({ ...q, created: '', updated: '' })) as Question[])
      }
      toast({
        title: 'Pergunta removida',
        description: 'A pergunta foi desvinculada da campanha.',
      })
    } catch {
      toast({
        title: 'Erro ao excluir pergunta',
        description: 'Não foi possível remover a pergunta.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Campanhas de NPS</h1>
          <p className="text-sm text-slate-500">
            Crie, configure e gerencie as pesquisas de satisfação da Fundatec.
          </p>
        </div>
        {canManageCampaigns ? (
          <Button onClick={handleOpenCreate} className="bg-sky-600 hover:bg-sky-700 shrink-0">
            <Plus className="w-4 h-4 mr-2" />
            Nova Campanha
          </Button>
        ) : (
          <Badge
            variant="outline"
            className="bg-slate-50 text-slate-600 border-slate-200 text-xs shrink-0 gap-1.5 py-1.5 px-3"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
            Acesso de {isLeitura ? 'somente leitura' : 'consulta'} — sem ações de escrita
          </Badge>
        )}
      </div>

      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-sky-600" />
            <CardTitle className="text-base font-semibold text-slate-800">
              Campanhas Registradas ({campaignsFiltradas.length})
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-500">
            Campanhas com modo convite requerem participantes cadastrados; link aberto gera link
            único.
          </CardDescription>
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <Input
                placeholder="Buscar por nome ou slug..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-8 text-xs pl-8 bg-white"
              />
            </div>
            <Select value={filtroArea} onValueChange={setFiltroArea}>
              <SelectTrigger className="w-full sm:w-[200px] h-8 text-xs bg-white">
                <Filter className="w-3 h-3 mr-1 text-slate-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as áreas</SelectItem>
                {areas.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-full sm:w-[160px] h-8 text-xs bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="ativa">Ativa</SelectItem>
                <SelectItem value="encerrada">Encerrada</SelectItem>
                <SelectItem value="expirada">Expirada (vigência)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-sky-600 mb-2" />
              <p className="text-xs">Carregando campanhas...</p>
            </div>
          ) : campaignsFiltradas.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              Nenhuma campanha encontrada. Clique em &quot;Nova Campanha&quot; para começar.
            </div>
          ) : (
            <CampaignList
              campaigns={campaignsFiltradas}
              areas={areas}
              stats={stats}
              canManage={canManageCampaigns}
              onEdit={handleOpenEdit}
              onClose={(c) => setConfirmDialog({ open: true, tipo: 'encerrar', campaign: c })}
              onDelete={(c) => setConfirmDialog({ open: true, tipo: 'excluir', campaign: c })}
              onCopyLink={copyOpenLink}
              onViewQuestions={handleOpenQuestions}
            />
          )}
        </CardContent>
      </Card>

      {/* Modal Criar / Editar Campanha */}
      <CampaignFormDialog
        open={isDialogOpen}
        onOpenChange={(o) => {
          setIsDialogOpen(o)
          if (!o) setEditingCampaign(null)
        }}
        areas={areas}
        editing={editingCampaign}
        submitting={isSubmitting}
        onSave={handleSave}
      />

      {/* Modal de Perguntas Adicionais (gestão pós-criação) */}
      <Dialog open={isQuestionDialogOpen} onOpenChange={setIsQuestionDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800">
              Perguntas Adicionais: {selectedCampaignForQuestions?.nome}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Adicione perguntas extras de nota (0 a 10) ou texto livre para esta campanha.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-4">
            {/* Lista de Perguntas */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">
                Perguntas Cadastradas ({questions.length})
              </Label>
              {isLoadingQuestions ? (
                <div className="py-6 flex justify-center text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : questions.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center border border-dashed rounded-lg">
                  Nenhuma pergunta complementar adicionada ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {questions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-start justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-800">
                          {idx + 1}. {q.enunciado}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-slate-500">
                          <span className="font-medium text-slate-600">
                            Tipo: {q.tipo === 'nota' ? 'Nota 0–10' : 'Texto Livre'}
                          </span>
                          {q.obrigatoria && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] py-0 px-1.5 bg-rose-100 text-rose-700"
                            >
                              Obrigatória
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-rose-600"
                        onClick={() => handleDeleteQuestion(q.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Formulário de Nova Pergunta */}
            <form
              onSubmit={handleAddQuestion}
              className="p-3 bg-sky-50/60 border border-sky-100 rounded-lg space-y-3"
            >
              <div className="text-xs font-semibold text-sky-900">Adicionar Nova Pergunta</div>

              <div className="space-y-1">
                <Label htmlFor="q-enunciado" className="text-xs text-slate-700">
                  Enunciado da pergunta *
                </Label>
                <Input
                  id="q-enunciado"
                  placeholder="Ex: Como você avalia a agilidade do atendimento?"
                  value={novoEnunciado}
                  onChange={(e) => setNovoEnunciado(e.target.value)}
                  required
                  className="text-xs bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="q-tipo" className="text-xs text-slate-700">
                    Tipo de Resposta
                  </Label>
                  <Select
                    value={novoTipo}
                    onValueChange={(val: 'nota' | 'texto') => setNovoTipo(val)}
                  >
                    <SelectTrigger id="q-tipo" className="text-xs bg-white h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nota">Nota de 0 a 10</SelectItem>
                      <SelectItem value="texto">Texto Livre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="q-obrig"
                    checked={novaObrigatoria}
                    onChange={(e) => setNovaObrigatoria(e.target.checked)}
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 h-4 w-4"
                  />
                  <Label htmlFor="q-obrig" className="text-xs text-slate-700 cursor-pointer">
                    Resposta Obrigatória
                  </Label>
                </div>
              </div>

              <Button
                type="submit"
                size="sm"
                className="w-full bg-sky-600 hover:bg-sky-700 text-xs h-8"
              >
                <Plus className="w-3 h-3 mr-1" />
                Inserir Pergunta
              </Button>
            </form>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuestionDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação: Encerrar / Excluir */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(o) => setConfirmDialog((prev) => ({ ...prev, open: o }))}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              {confirmDialog.tipo === 'excluir' ? (
                <>
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  Excluir Campanha
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-amber-600" />
                  Encerrar Campanha
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 pt-1">
              {confirmDialog.tipo === 'excluir' ? (
                <>
                  Tem certeza que deseja excluir a campanha{' '}
                  <strong>&quot;{confirmDialog.campaign?.nome}&quot;</strong>? Esta ação não pode
                  ser desfeita. Campanhas com respostas registradas não podem ser excluídas — apenas
                  encerradas.
                </>
              ) : (
                <>
                  Deseja realmente encerrar a campanha{' '}
                  <strong>&quot;{confirmDialog.campaign?.nome}&quot;</strong>? Ela deixará de
                  aceitar respostas e reenvios.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {confirmDialog.tipo === 'encerrar' && confirmDialog.campaign && (
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {confirmDialog.campaign.vigencia_tipo === 'prazo' &&
              confirmDialog.campaign.vigencia_fim
                ? `Vigência atual: até ${new Date(confirmDialog.campaign.vigencia_fim).toLocaleDateString('pt-BR')}`
                : 'Vigência atual: contínua (sem data de fim)'}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
              disabled={isProcessing}
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmDialog.tipo === 'excluir' ? confirmDelete : confirmClose}
              disabled={isProcessing}
              className={
                confirmDialog.tipo === 'excluir'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : confirmDialog.tipo === 'excluir' ? (
                'Excluir definitivamente'
              ) : (
                'Encerrar campanha'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
