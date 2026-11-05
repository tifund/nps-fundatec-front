import React, { useEffect, useMemo, useState } from 'react'
import {
  getAreas,
  createArea,
  updateArea,
  toggleAreaStatus,
  deleteArea,
  areaNameInUse,
  countCampaignsByArea,
} from '@/services/areas'
import { Area } from '@/types/nps'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Plus,
  Edit2,
  Trash2,
  Layers,
  Loader2,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Lock,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'

export default function AreasPage() {
  const [areas, setAreas] = useState<Area[]>([])
  const [campanhasPorArea, setCampanhasPorArea] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editingArea, setEditingArea] = useState<Area | null>(null)
  const [nome, setNome] = useState('')
  const [ativa, setAtiva] = useState(true)
  const [erroNome, setErroNome] = useState('')
  const [areaParaExcluir, setAreaParaExcluir] = useState<Area | null>(null)

  const { toast } = useToast()
  const { canManageAreas, isLeitura } = usePermissions()

  const loadAreas = async () => {
    setIsLoading(true)
    try {
      const [data, contagem] = await Promise.all([getAreas(), countCampaignsByArea()])
      setAreas(data)
      setCampanhasPorArea(contagem)
    } catch {
      toast({
        title: 'Erro ao carregar áreas',
        description: 'Não foi possível buscar as áreas de negócio cadastradas.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }
  useEffect(() => {
    loadAreas()
  }, [])

  const totalVinculadas = useMemo(
    () => Object.values(campanhasPorArea).reduce((acc, n) => acc + n, 0),
    [campanhasPorArea],
  )

  const campanhasDaArea = (areaId: string) => campanhasPorArea[areaId] || 0

  const handleOpenCreate = () => {
    setEditingArea(null)
    setNome('')
    setAtiva(true)
    setErroNome('')
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (area: Area) => {
    setEditingArea(area)
    setNome(area.nome)
    setAtiva(area.ativa)
    setErroNome('')
    setIsDialogOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const nomeTrim = nome.trim()
    if (!nomeTrim) {
      setErroNome('Informe o nome da área de negócio.')
      return
    }
    if (areaNameInUse(areas, nomeTrim, editingArea?.id)) {
      setErroNome('Já existe uma área de negócio com este nome.')
      return
    }

    setIsSubmitting(true)
    try {
      if (editingArea) {
        await updateArea(editingArea.id, { nome: nomeTrim, ativa })
        toast({
          title: 'Área atualizada',
          description: 'A área de negócio foi modificada com sucesso.',
        })
      } else {
        await createArea({ nome: nomeTrim, ativa })
        toast({
          title: 'Área cadastrada',
          description: 'Nova área de negócio inserida com sucesso.',
        })
      }
      setIsDialogOpen(false)
      loadAreas()
    } catch (err: unknown) {
      const message = (err as Error)?.message || ''
      if (/nome/i.test(message) && /único|unique|já existe|existe uma área/i.test(message)) {
        setErroNome('Já existe uma área de negócio com este nome.')
      } else {
        toast({
          title: 'Erro ao salvar',
          description: message || 'Ocorreu um erro ao salvar os dados.',
          variant: 'destructive',
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggle = async (area: Area) => {
    try {
      await toggleAreaStatus(area.id, area.ativa)
      toast({
        title: 'Situação alterada',
        description: `Área "${area.nome}" agora está ${area.ativa ? 'Inativa' : 'Ativa'}.`,
      })
      loadAreas()
    } catch {
      toast({
        title: 'Erro ao alternar',
        description: 'Não foi possível atualizar a situação da área.',
        variant: 'destructive',
      })
    }
  }

  const confirmarExclusao = async () => {
    if (!areaParaExcluir) return
    setIsDeleting(true)
    try {
      await deleteArea(areaParaExcluir.id)
      toast({
        title: 'Área excluída',
        description: `A área "${areaParaExcluir.nome}" foi removida com sucesso.`,
      })
      setAreaParaExcluir(null)
      loadAreas()
    } catch (err: unknown) {
      const message = (err as Error)?.message || ''
      toast({
        title: 'Não foi possível excluir',
        description: /campanhas/i.test(message)
          ? 'Esta área possui campanhas vinculadas e não pode ser excluída. Apenas desative-a para impedir novas campanhas.'
          : message || 'Ocorreu um erro ao excluir a área.',
        variant: 'destructive',
      })
      setAreaParaExcluir(null)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Áreas de Negócio</h1>
          <p className="text-sm text-slate-500">
            Cadastre e gerencie as áreas da Fundatec que realizam pesquisas de satisfação.
          </p>
        </div>
        {canManageAreas ? (
          <Button onClick={handleOpenCreate} className="bg-sky-600 hover:bg-sky-700 shrink-0">
            <Plus className="w-4 h-4 mr-2" />
            Nova Área
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
            <Layers className="w-5 h-5 text-sky-600" />
            <CardTitle className="text-base font-semibold text-slate-800">
              Áreas Cadastradas ({areas.length})
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-500">
            Campanhas de NPS devem ser vinculadas a uma destas áreas. Áreas com campanhas vinculadas
            não podem ser excluídas — apenas desativadas.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-sky-600 mb-2" />
              <p className="text-xs">Carregando áreas...</p>
            </div>
          ) : areas.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              Nenhuma área de negócio encontrada. Clique em &quot;Nova Área&quot; para cadastrar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold text-slate-600">
                    Nome da Área
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 w-32">
                    Situação
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 w-44">
                    Campanhas Vinculadas
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 w-36">
                    Cadastrada em
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 text-right w-44">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {areas.map((area) => {
                  const qtdCampanhas = campanhasDaArea(area.id)
                  const podeExcluir = qtdCampanhas === 0
                  return (
                    <TableRow key={area.id} className="hover:bg-slate-50/70">
                      <TableCell className="font-medium text-slate-800 text-sm">
                        {area.nome}
                      </TableCell>
                      <TableCell>
                        {area.ativa ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 text-xs gap-1 font-medium">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Ativa
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-slate-100 text-slate-500 border-slate-200 text-xs gap-1 font-medium"
                          >
                            <XCircle className="w-3 h-3 text-slate-400" />
                            Inativa
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {qtdCampanhas > 0 ? (
                          <Badge
                            variant="outline"
                            className="bg-sky-50 text-sky-700 border-sky-200 text-xs gap-1 font-medium"
                          >
                            <Layers className="w-3 h-3" />
                            {qtdCampanhas} {qtdCampanhas === 1 ? 'campanha' : 'campanhas'}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">Nenhuma</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {new Date(area.created).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        {canManageAreas ? (
                          <span className="inline-flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggle(area)}
                              title={area.ativa ? 'Desativar área' : 'Ativar área'}
                              className="text-xs h-8 text-slate-600 hover:text-slate-900"
                            >
                              {area.ativa ? 'Desativar' : 'Ativar'}
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-slate-600 hover:text-sky-600"
                              onClick={() => handleOpenEdit(area)}
                              title="Editar área"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            {podeExcluir ? (
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setAreaParaExcluir(area)}
                                title="Excluir área (sem campanhas vinculadas)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            ) : (
                              <span
                                title="Esta área possui campanhas vinculadas e não pode ser excluída — apenas desativada."
                                className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-input bg-transparent text-slate-300"
                              >
                                <Lock className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
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

      {/* Modal de Criação / Edição */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-800">
                {editingArea ? 'Editar Área de Negócio' : 'Cadastrar Área de Negócio'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Informe o nome e defina se a área estará ativa para novas campanhas.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="nome-area" className="text-xs font-medium text-slate-700">
                  Nome da Área *
                </Label>
                <Input
                  id="nome-area"
                  placeholder="Ex: Fundatec Concursos, Estágios..."
                  value={nome}
                  onChange={(e) => {
                    setNome(e.target.value)
                    if (erroNome) setErroNome('')
                  }}
                  required
                  className="text-sm"
                />
                {erroNome && (
                  <p className="text-xs text-red-600 font-medium" role="alert">
                    {erroNome}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                <div className="space-y-0.5">
                  <Label htmlFor="ativa-area" className="text-xs font-medium text-slate-800">
                    Área Ativa
                  </Label>
                  <p className="text-[11px] text-slate-500">
                    Áreas inativas não podem receber novas pesquisas de NPS. As campanhas já
                    vinculadas continuam funcionando normalmente.
                  </p>
                </div>
                <Switch id="ativa-area" checked={ativa} onCheckedChange={setAtiva} />
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
              <Button
                type="submit"
                className="bg-sky-600 hover:bg-sky-700"
                disabled={isSubmitting || !nome.trim()}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Área'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão (somente áreas sem campanhas vinculadas) */}
      <AlertDialog
        open={!!areaParaExcluir}
        onOpenChange={(open) => {
          if (!open) setAreaParaExcluir(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-slate-800">
              Excluir área de negócio?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-600">
              A área &quot;{areaParaExcluir?.nome}&quot; não possui campanhas vinculadas e pode ser
              excluída permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmarExclusao()
              }}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir Área'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
