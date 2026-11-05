import React, { useEffect, useState } from 'react'
import {
  getCampaigns,
  createCampaign,
  updateCampaign,
  closeCampaign,
  getCampaignQuestions,
  createQuestion,
  deleteQuestion,
} from '@/services/campaigns'
import { getAreas } from '@/services/areas'
import { Campaign, Area, Question } from '@/types/nps'
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
  Plus,
  Edit2,
  Megaphone,
  Loader2,
  Copy,
  ExternalLink,
  HelpCircle,
  Trash2,
  Lock,
  Calendar,
  ShieldAlert,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Modal Campanha
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)

  // Formulário Campanha
  const [nome, setNome] = useState('')
  const [areaId, setAreaId] = useState('')
  const [perguntaNps, setPerguntaNps] = useState(
    'Em uma escala de 0 a 10, o quanto você recomendaria a Fundatec para um amigo ou colega?',
  )
  const [modoAcesso, setModoAcesso] = useState<'convites' | 'link_aberto'>('convites')
  const [status, setStatus] = useState<'ativa' | 'encerrada'>('ativa')
  const [vigenciaFim, setVigenciaFim] = useState('')
  const [justificativaDetrator, setJustificativaDetrator] = useState<
    'obrigatoria' | 'geral' | 'nenhuma'
  >('obrigatoria')
  const [textoGeral, setTextoGeral] = useState('')
  const [slug, setSlug] = useState('')

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

  const { toast } = useToast()
  const { canManageCampaigns, isLeitura } = usePermissions()

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [camps, allAreas] = await Promise.all([getCampaigns(), getAreas()])
      setCampaigns(camps)
      setAreas(allAreas)
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
  }, [])

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
  }

  const handleOpenCreate = () => {
    setEditingCampaign(null)
    setNome('')
    setAreaId(areas.find((a) => a.ativa)?.id || '')
    setPerguntaNps(
      'Em uma escala de 0 a 10, o quanto você recomendaria a Fundatec para um amigo ou colega?',
    )
    setModoAcesso('convites')
    setStatus('ativa')
    setVigenciaFim('')
    setJustificativaDetrator('obrigatoria')
    setTextoGeral('')
    setSlug('')
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (c: Campaign) => {
    setEditingCampaign(c)
    setNome(c.nome)
    setAreaId(c.area_id)
    setPerguntaNps(c.pergunta_nps)
    setModoAcesso(c.modo_acesso)
    setStatus(c.status)
    setVigenciaFim(c.vigencia_fim ? c.vigencia_fim.split('T')[0] : '')
    setJustificativaDetrator(c.justificativa_detrator)
    setTextoGeral(c.texto_geral || '')
    setSlug(c.slug)
    setIsDialogOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim() || !areaId || !perguntaNps.trim()) {
      toast({
        title: 'Campos incompletos',
        description: 'Por favor preencha nome, área e pergunta NPS.',
        variant: 'destructive',
      })
      return
    }

    const finalSlug = slug.trim() ? generateSlug(slug) : generateSlug(nome)

    setIsSubmitting(true)
    try {
      const payload = {
        nome: nome.trim(),
        area_id: areaId,
        pergunta_nps: perguntaNps.trim(),
        modo_acesso: modoAcesso,
        status,
        vigencia_fim: vigenciaFim ? `${vigenciaFim} 23:59:59.000Z` : undefined,
        justificativa_detrator: justificativaDetrator,
        texto_geral: textoGeral.trim() || undefined,
        slug: finalSlug,
      }

      if (editingCampaign) {
        await updateCampaign(editingCampaign.id, payload)
        toast({
          title: 'Campanha atualizada',
          description: 'Alterações salvas com sucesso.',
        })
      } else {
        await createCampaign(payload)
        toast({
          title: 'Campanha criada',
          description: 'Nova campanha de NPS cadastrada com sucesso.',
        })
      }

      setIsDialogOpen(false)
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

  const handleCloseCampaign = async (c: Campaign) => {
    if (!window.confirm(`Deseja realmente encerrar a campanha "${c.nome}"?`)) return
    try {
      await closeCampaign(c.id)
      toast({
        title: 'Campanha encerrada',
        description: `A campanha "${c.nome}" foi encerrada para novas respostas.`,
      })
      loadData()
    } catch {
      toast({
        title: 'Erro ao encerrar',
        description: 'Não foi possível encerrar a campanha.',
        variant: 'destructive',
      })
    }
  }

  // Gerenciamento de Perguntas Adicionais
  const handleOpenQuestions = async (c: Campaign) => {
    setSelectedCampaignForQuestions(c)
    setIsQuestionDialogOpen(true)
    setIsLoadingQuestions(true)
    try {
      const qList = await getCampaignQuestions(c.id)
      setQuestions(qList)
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
      setQuestions(qList)
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
        setQuestions(qList)
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

  const copyOpenLink = (camp: Campaign) => {
    const url = `${window.location.origin}/avaliar/aberto/${camp.slug}`
    navigator.clipboard.writeText(url)
    toast({
      title: 'Link copiado!',
      description: 'O link aberto da campanha foi copiado para a área de transferência.',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Campanhas de NPS</h1>
          <p className="text-sm text-slate-500">
            Crie, configure regras de justificativa e gerencie as pesquisas da Fundatec.
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
              Campanhas Registradas ({campaigns.length})
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-500">
            Campanhas com modo convite requerem participantes cadastrados; link aberto gera link
            único.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-sky-600 mb-2" />
              <p className="text-xs">Carregando campanhas...</p>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              Nenhuma campanha encontrada. Clique em &quot;Nova Campanha&quot; para começar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold text-slate-600">Campanha</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Área</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Modo</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Situação</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Vigência</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 text-right">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((camp) => {
                  const areaNome = camp.expand?.area_id?.nome || 'Área não identificada'
                  const isExpirada = camp.vigencia_fim && new Date(camp.vigencia_fim) < new Date()
                  const statusFinal = isExpirada ? 'encerrada' : camp.status

                  return (
                    <TableRow key={camp.id} className="hover:bg-slate-50/70">
                      <TableCell>
                        <div className="font-semibold text-slate-800 text-sm">{camp.nome}</div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">
                          slug: {camp.slug}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-700">
                        {areaNome}
                      </TableCell>
                      <TableCell>
                        {camp.modo_acesso === 'convites' ? (
                          <Badge
                            variant="outline"
                            className="text-[11px] bg-slate-50 border-slate-200 text-slate-600"
                          >
                            Convites Individuais
                          </Badge>
                        ) : (
                          <Badge className="text-[11px] bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-50">
                            Link Aberto
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {statusFinal === 'ativa' ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 text-xs font-medium">
                            Ativa
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-rose-50 text-rose-700 border-rose-200 text-xs font-medium"
                          >
                            Encerrada
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {camp.vigencia_fim ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {new Date(camp.vigencia_fim).toLocaleDateString('pt-BR')}
                          </div>
                        ) : (
                          <span className="text-slate-400">Sem prazo</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {camp.modo_acesso === 'link_aberto' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs text-sky-700 border-sky-200 hover:bg-sky-50"
                            onClick={() => copyOpenLink(camp)}
                            title="Copiar Link Aberto"
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Copiar Link
                          </Button>
                        )}
                        {canManageCampaigns && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs text-slate-600 hover:text-slate-900"
                              onClick={() => handleOpenQuestions(camp)}
                              title="Perguntas Adicionais"
                            >
                              <HelpCircle className="w-3.5 h-3.5 mr-1" />
                              Perguntas
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-slate-600 hover:text-sky-600"
                              onClick={() => handleOpenEdit(camp)}
                              title="Editar Campanha"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            {statusFinal === 'ativa' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-rose-600"
                                onClick={() => handleCloseCampaign(camp)}
                                title="Encerrar Campanha Manualmente"
                              >
                                <Lock className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </>
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

      {/* Modal Criar / Editar Campanha */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-800">
                {editingCampaign ? 'Editar Campanha' : 'Criar Nova Campanha de NPS'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Configure os parâmetros de pesquisa, texto para detratores e modo de distribuição.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="camp-nome" className="text-xs font-medium text-slate-700">
                  Nome da Campanha *
                </Label>
                <Input
                  id="camp-nome"
                  placeholder="Ex: Satisfação Alunos 2025/1"
                  value={nome}
                  onChange={(e) => {
                    setNome(e.target.value)
                    if (!editingCampaign) {
                      setSlug(generateSlug(e.target.value))
                    }
                  }}
                  required
                  className="text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="camp-area" className="text-xs font-medium text-slate-700">
                    Área de Negócio *
                  </Label>
                  <Select value={areaId} onValueChange={setAreaId}>
                    <SelectTrigger id="camp-area" className="text-sm">
                      <SelectValue placeholder="Selecione a área" />
                    </SelectTrigger>
                    <SelectContent>
                      {areas
                        .filter((a) => a.ativa || a.id === areaId)
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.nome} {!a.ativa && '(Inativa)'}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="camp-modo" className="text-xs font-medium text-slate-700">
                    Modo de Acesso *
                  </Label>
                  <Select
                    value={modoAcesso}
                    onValueChange={(val: 'convites' | 'link_aberto') => setModoAcesso(val)}
                  >
                    <SelectTrigger id="camp-modo" className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="convites">Convites Individuais por E-mail</SelectItem>
                      <SelectItem value="link_aberto">Link Aberto (URL Única)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="camp-pergunta" className="text-xs font-medium text-slate-700">
                  Pergunta Principal do NPS (0 a 10) *
                </Label>
                <Textarea
                  id="camp-pergunta"
                  rows={2}
                  value={perguntaNps}
                  onChange={(e) => setPerguntaNps(e.target.value)}
                  required
                  className="text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="camp-detrator" className="text-xs font-medium text-slate-700">
                    Justificativa de Detrator (nota 0–6)
                  </Label>
                  <Select
                    value={justificativaDetrator}
                    onValueChange={(val: 'obrigatoria' | 'geral' | 'nenhuma') =>
                      setJustificativaDetrator(val)
                    }
                  >
                    <SelectTrigger id="camp-detrator" className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="obrigatoria">Obrigatória para notas 0 a 6</SelectItem>
                      <SelectItem value="geral">Opcional / Texto Geral</SelectItem>
                      <SelectItem value="nenhuma">Não solicitar justificativa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="camp-vigencia" className="text-xs font-medium text-slate-700">
                    Data Limite de Vigência (opcional)
                  </Label>
                  <Input
                    id="camp-vigencia"
                    type="date"
                    value={vigenciaFim}
                    onChange={(e) => setVigenciaFim(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="camp-texto" className="text-xs font-medium text-slate-700">
                  Texto Introdutório / Contexto da Avaliação
                </Label>
                <Textarea
                  id="camp-texto"
                  rows={2}
                  placeholder="Mensagem de boas-vindas exibida no topo da página de resposta..."
                  value={textoGeral}
                  onChange={(e) => setTextoGeral(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="camp-slug" className="text-xs font-medium text-slate-700">
                  Identificador / Slug da URL *
                </Label>
                <Input
                  id="camp-slug"
                  placeholder="ex: nps-alunos-2025"
                  value={slug}
                  onChange={(e) => setSlug(generateSlug(e.target.value))}
                  required
                  className="text-sm font-mono"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" className="bg-sky-600 hover:bg-sky-700" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Campanha'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Perguntas Adicionais */}
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
    </div>
  )
}
