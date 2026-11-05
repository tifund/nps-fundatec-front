import React, { useEffect, useState } from 'react'
import { getAreas, createArea, updateArea, toggleAreaStatus } from '@/services/areas'
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
import { Plus, Edit2, Layers, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function AreasPage() {
  const [areas, setAreas] = useState<Area[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingArea, setEditingArea] = useState<Area | null>(null)
  const [nome, setNome] = useState('')
  const [ativa, setAtiva] = useState(true)

  const { toast } = useToast()

  const loadAreas = async () => {
    setIsLoading(true)
    try {
      const data = await getAreas()
      setAreas(data)
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

  const handleOpenCreate = () => {
    setEditingArea(null)
    setNome('')
    setAtiva(true)
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (area: Area) => {
    setEditingArea(area)
    setNome(area.nome)
    setAtiva(area.ativa)
    setIsDialogOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) return

    setIsSubmitting(true)
    try {
      if (editingArea) {
        await updateArea(editingArea.id, { nome: nome.trim(), ativa })
        toast({
          title: 'Área atualizada',
          description: 'A área de negócio foi modificada com sucesso.',
        })
      } else {
        await createArea({ nome: nome.trim(), ativa })
        toast({
          title: 'Área cadastrada',
          description: 'Nova área de negócio inserida com sucesso.',
        })
      }
      setIsDialogOpen(false)
      loadAreas()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao salvar',
        description: (err as Error)?.message || 'Ocorreu um erro ao salvar os dados.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggle = async (area: Area) => {
    try {
      await toggleAreaStatus(area.id, area.ativa)
      toast({
        title: 'Situação alterada',
        description: `Área "${area.nome}" agora está ${!area.ativa ? 'Ativa' : 'Inativa'}.`,
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Áreas de Negócio</h1>
          <p className="text-sm text-slate-500">
            Cadastre e gerencie as áreas da Fundatec que realizam pesquisas de satisfação.
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="bg-sky-600 hover:bg-sky-700 shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          Nova Área
        </Button>
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
            Campanhas de NPS devem ser vinculadas a uma destas áreas.
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
                  <TableHead className="text-xs font-semibold text-slate-600 w-40">
                    Cadastrada em
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 text-right w-28">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {areas.map((area) => (
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
                    <TableCell className="text-xs text-slate-500">
                      {new Date(area.created).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
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
                        title="Editar nome"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
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
                  onChange={(e) => setNome(e.target.value)}
                  required
                  className="text-sm"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                <div className="space-y-0.5">
                  <Label htmlFor="ativa-area" className="text-xs font-medium text-slate-800">
                    Área Ativa
                  </Label>
                  <p className="text-[11px] text-slate-500">
                    Áreas inativas não podem receber novas pesquisas de NPS.
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
    </div>
  )
}
