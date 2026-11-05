// Aba "Gestão de Detratores" da campanha: respostas 0–6 no período filtrado,
// com justificativa, comentário e contato SOMENTE de quem se identificou
// (anônimas aparecem como "Anônimo"). Marcar como tratado é ADMIN/GESTOR.
import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, Loader2, StickyNote } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'
import { contatoDaResposta } from '@/lib/nps/calculos'
import { exportarDetratoresCsv, fmtDataHora } from '@/lib/nps/exportacao'
import { desmarcarTratado } from '@/services/tratativa'
import type { SurveyResponse } from '@/types/nps'

export function GestaoDetratores({
  respostas,
  onTratado,
}: {
  respostas: SurveyResponse[]
  onTratado?: (id: string, notaInterna: string) => Promise<void> | void
}) {
  const { canTratarDetrator } = usePermissions()
  const { toast } = useToast()
  const [alvo, setAlvo] = useState<SurveyResponse | null>(null)
  const [notaInterna, setNotaInterna] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [desfazendo, setDesfazendo] = useState<string | null>(null)

  const detratores = useMemo(() => respostas.filter((r) => r.nota <= 6), [respostas])
  const tratados = useMemo(() => detratores.filter((r) => r.tratado).length, [detratores])

  const abrirTratativa = (r: SurveyResponse) => {
    setAlvo(r)
    setNotaInterna(r.nota_interna || '')
  }

  const salvarTratativa = async () => {
    if (!alvo) return
    setSalvando(true)
    try {
      if (onTratado) await onTratado(alvo.id, notaInterna.trim())
      toast({ title: 'Detrator marcado como tratado' })
      setAlvo(null)
    } catch {
      toast({
        title: 'Erro ao registrar a tratativa',
        description: 'Tente novamente em instantes.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const desmarcar = async (r: SurveyResponse) => {
    setDesfazendo(r.id)
    try {
      await desmarcarTratado(r.id)
      toast({ title: 'Tratativa desfeita' })
    } catch {
      toast({
        title: 'Erro ao desfazer a tratativa',
        variant: 'destructive',
      })
    } finally {
      setDesfazendo(null)
    }
  }

  return (
    <Card className="border-slate-200 shadow-sm bg-white">
      <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <CardTitle className="text-base font-semibold text-slate-800">
              Detratores do período ({detratores.length})
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-500">
            Notas de 0 a 6 no intervalo filtrado — {tratados} tratado
            {tratados === 1 ? '' : 's'}. Anônimas nunca exibem nome ou e-mail.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs text-slate-700 hover:text-sky-700 border-slate-200"
          disabled={detratores.length === 0}
          onClick={() => exportarDetratoresCsv(detratores)}
        >
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Exportar lista
        </Button>
      </CardHeader>

      <CardContent className="p-0">
        {detratores.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-400">
            Nenhum detrator registrado no período. Excelente!
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold text-slate-600 w-16">Nota</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Data</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">
                    Respondente
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">
                    Justificativa
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Comentário</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Tratativa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detratores.map((r) => {
                  const contato = contatoDaResposta(r) // null quando anônima
                  return (
                    <TableRow key={r.id} className="hover:bg-rose-50/30">
                      <TableCell>
                        <Badge className="bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-100 font-bold text-xs">
                          {r.nota}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        {fmtDataHora(r.created)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {contato ? (
                          <div>
                            <p className="font-medium text-slate-800">{contato.nome}</p>
                            <p className="text-[11px] text-slate-500">{contato.email}</p>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Anônimo</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700 max-w-56">
                        <p className="font-medium text-rose-900">
                          {r.justificativa_detrator || '—'}
                        </p>
                        {r.comentario ? (
                          <p className="text-slate-500 italic mt-0.5">“{r.comentario}”</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 max-w-48">
                        {r.comentario ? r.comentario : '—'}
                      </TableCell>
                      <TableCell>
                        {r.tratado ? (
                          <div className="flex flex-col gap-1 items-start">
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Tratado
                            </Badge>
                            {r.nota_interna ? (
                              <span className="text-[10px] text-slate-500 whitespace-pre-wrap max-w-48">
                                <StickyNote className="w-3 h-3 inline mr-1 -mt-0.5" />
                                {r.nota_interna}
                              </span>
                            ) : null}
                            {canTratarDetrator ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-[10px] text-slate-400 hover:text-rose-600"
                                disabled={desfazendo === r.id}
                                onClick={() => void desmarcar(r)}
                              >
                                {desfazendo === r.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  'desfazer'
                                )}
                              </Button>
                            ) : null}
                          </div>
                        ) : canTratarDetrator ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[11px] text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                            onClick={() => abrirTratativa(r)}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Marcar tratado
                          </Button>
                        ) : (
                          <span className="text-[10px] text-slate-400">pendente</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Dialog de tratativa */}
      <Dialog open={alvo !== null} onOpenChange={(open) => !open && setAlvo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Marcar detrator como tratado</DialogTitle>
            <DialogDescription className="text-xs">
              Registro interno para o controle da área responsável. O respondente não recebe contato
              por aqui.
            </DialogDescription>
          </DialogHeader>
          {alvo ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-xs text-slate-600 space-y-1">
                <p>
                  <span className="font-semibold">Nota:</span> {alvo.nota} ·{' '}
                  <span className="font-semibold">Data:</span> {fmtDataHora(alvo.created)}
                </p>
                <p>
                  <span className="font-semibold">Respondente:</span>{' '}
                  {contatoDaResposta(alvo)?.nome || 'Anônimo'}
                </p>
                {alvo.justificativa_detrator ? (
                  <p>
                    <span className="font-semibold">Justificativa:</span>{' '}
                    {alvo.justificativa_detrator}
                  </p>
                ) : null}
                {alvo.comentario ? (
                  <p>
                    <span className="font-semibold">Comentário:</span> {alvo.comentario}
                  </p>
                ) : null}
              </div>
              <Textarea
                value={notaInterna}
                onChange={(e) => setNotaInterna(e.target.value)}
                rows={3}
                placeholder="Nota interna (opcional) — plano de ação, responsável, encaminhamentos…"
                className="resize-none text-sm"
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setAlvo(null)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={salvando}
              onClick={() => void salvarTratativa()}
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar tratativa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
