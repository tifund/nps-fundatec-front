import React, { useEffect, useMemo, useState } from 'react'
import { Campaign, Participant } from '@/types/nps'
import { sendInvitesBatch, ModoDisparo, ResultadoDisparo } from '@/services/dispatches'
import { assuntoConvite, previewParaParticipante } from '@/lib/convite/template'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Mail, Loader2, CheckCircle2, XCircle, Eye, Info } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaign: Campaign | null
  participants: Participant[]
  onDone: () => void
}

type Etapa = 'previa' | 'enviando' | 'resumo'

/**
 * Dialog "Enviar convites": PRÉVIA do e-mail antes de disparar, envio em lote
 * pelo backend (Resend) com progresso e resumo final (X enviados, Y erros).
 * Também oferece "reenviar para todos" (dispara para todos os convocados).
 */
export default function SendInvitesDialog({
  open,
  onOpenChange,
  campaign,
  participants,
  onDone,
}: Props) {
  const { toast } = useToast()
  const [etapa, setEtapa] = useState<Etapa>('previa')
  const [modo, setModo] = useState<ModoDisparo>('inicial')
  const [reenviarTodos, setReenviarTodos] = useState(false)
  const [resultados, setResultados] = useState<ResultadoDisparo[]>([])
  const [resumo, setResumo] = useState<{
    enviados: number
    erros: number
    ignorados: number
  } | null>(null)
  const [erroBackend, setErroBackend] = useState('')

  const baseUrl = window.location.origin

  useEffect(() => {
    if (open) {
      setEtapa('previa')
      setReenviarTodos(false)
      setResultados([])
      setResumo(null)
      setErroBackend('')
    }
  }, [open])

  const stats = useMemo(() => {
    const respondidos = participants.filter((p) => p.respondido).length
    return { respondidos, pendentes: participants.length - respondidos }
  }, [participants])

  if (!campaign) return null

  // Prévia: usa o primeiro participante pendente como exemplo
  const exemplo = participants.find((p) => !p.respondido) || participants[0] || null
  const previa = previewParaParticipante(campaign, exemplo, baseUrl)

  const disparar = async () => {
    const modoEscolhido: ModoDisparo = reenviarTodos ? 'reenvio_todos' : 'inicial'
    setModo(modoEscolhido)
    setEtapa('enviando')
    try {
      const res = await sendInvitesBatch(campaign.id, modoEscolhido)
      setResultados(res.resultados || [])
      setResumo({ enviados: res.enviados, erros: res.erros, ignorados: res.ignorados })
      setEtapa('resumo')
      onDone()
    } catch (err: unknown) {
      setErroBackend((err as Error)?.message || 'Falha ao disparar os convites.')
      setEtapa('resumo')
    }
  }

  const titulo =
    modo === 'reenvio_todos' ? 'Reenvio para todos concluído' : 'Disparo de convites concluído'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Mail className="w-4 h-4 text-sky-600" />
            Enviar convites — {campaign.nome}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Prévia do e-mail antes do disparo. O envio é feito pelo backend via Resend e cada
            destinatário fica registrado no log de envios.
          </DialogDescription>
        </DialogHeader>

        {etapa === 'previa' && (
          <div className="space-y-4">
            {/* Resumo de públicos */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <p className="text-lg font-bold text-slate-800">{participants.length}</p>
                <p className="text-[11px] text-slate-500">Convocados</p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                <p className="text-lg font-bold text-emerald-700">{stats.respondidos}</p>
                <p className="text-[11px] text-emerald-600">Já responderam</p>
              </div>
              <div className="rounded-lg border border-sky-200 bg-sky-50 p-2">
                <p className="text-lg font-bold text-sky-700">{stats.pendentes}</p>
                <p className="text-[11px] text-sky-600">Pendentes</p>
              </div>
            </div>

            {/* Prévia do e-mail */}
            <Tabs defaultValue="email" className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-9">
                <TabsTrigger value="email" className="text-xs gap-1.5">
                  <Eye className="w-3.5 h-3.5" /> Prévia do e-mail
                </TabsTrigger>
                <TabsTrigger value="info" className="text-xs gap-1.5">
                  <Info className="w-3.5 h-3.5" /> Regras do disparo
                </TabsTrigger>
              </TabsList>
              <TabsContent value="email" className="mt-3">
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 text-xs">
                    <p className="text-slate-500">
                      <span className="font-semibold text-slate-700">De:</span> Fundatec NPS &lt;
                      nao_responder@sistemas.fundatec.org.br&gt;
                    </p>
                    <p className="text-slate-500">
                      <span className="font-semibold text-slate-700">Assunto:</span>{' '}
                      {previa.assunto}
                    </p>
                    <p className="text-slate-400 mt-0.5">
                      Exibindo com os dados de exemplo de {exemplo ? exemplo.nome : 'participante'}{' '}
                      — cada destinatário recebe seu próprio nome e link.
                    </p>
                  </div>
                  <div
                    className="bg-white p-4 text-xs text-slate-700"
                    dangerouslySetInnerHTML={{ __html: previa.html }}
                  />
                </div>
              </TabsContent>
              <TabsContent value="info" className="mt-3">
                <ul className="text-xs text-slate-600 space-y-2 list-disc pl-4">
                  <li>
                    O disparo padrão envia <strong>somente para quem ainda não recebeu</strong> o
                    convite nesta campanha.
                  </li>
                  <li>
                    Com &quot;reenviar para todos&quot; marcado, o e-mail vai para{' '}
                    <strong>todos os convocados</strong> (tipo reenvio no log).
                  </li>
                  <li>
                    Quem <strong>já respondeu</strong> nunca recebe e-mail, em nenhum modo.
                  </li>
                  <li>
                    Campanha encerrada ou com vigência expirada não dispara nada (validado no
                    backend).
                  </li>
                  <li>
                    Erros de envio não interrompem o lote — ao final, o resumo mostra X enviados e Y
                    erros.
                  </li>
                </ul>
              </TabsContent>
            </Tabs>

            {/* Opção reenviar para todos */}
            <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 cursor-pointer">
              <Checkbox
                checked={reenviarTodos}
                onCheckedChange={(v) => setReenviarTodos(v === true)}
                className="mt-0.5"
              />
              <span className="text-xs text-amber-800">
                <strong>Reenviar para todos</strong> — dispara o convite novamente para todos os
                convocados desta campanha (e não apenas para quem ainda não recebeu).
              </span>
            </label>
          </div>
        )}

        {etapa === 'enviando' && (
          <div className="py-10 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-sky-600 mb-3" />
            <p className="text-sm font-medium">Disparando convites pelo backend...</p>
            <p className="text-xs text-slate-400 mt-1">
              Não feche esta janela — o progresso é acompanhado em tempo real.
            </p>
          </div>
        )}

        {etapa === 'resumo' && (
          <div className="space-y-4">
            {erroBackend ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                {erroBackend}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-2xl font-bold text-emerald-700">{resumo?.enviados ?? 0}</p>
                    <p className="text-[11px] text-emerald-600">Enviados</p>
                  </div>
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                    <p className="text-2xl font-bold text-rose-700">{resumo?.erros ?? 0}</p>
                    <p className="text-[11px] text-rose-600">Erros</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-2xl font-bold text-slate-600">{resumo?.ignorados ?? 0}</p>
                    <p className="text-[11px] text-slate-500">Ignorados</p>
                  </div>
                </div>

                {resultados.length > 0 && (
                  <div className="rounded-lg border border-slate-200 max-h-56 overflow-y-auto">
                    <table className="w-full text-xs">
                      <tbody>
                        {resultados.map((r, i) => (
                          <tr
                            key={i}
                            className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                          >
                            <td className="px-3 py-1.5 text-slate-700">{r.participante}</td>
                            <td className="px-3 py-1.5 text-slate-500">{r.email}</td>
                            <td className="px-3 py-1.5 w-24">
                              {r.status === 'sucesso' ? (
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Enviado
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="bg-rose-50 text-rose-700 border-rose-200 gap-1"
                                >
                                  <XCircle className="w-3 h-3" /> Erro
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter>
          {etapa === 'previa' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={disparar} className="bg-sky-600 hover:bg-sky-700">
                <Mail className="w-4 h-4 mr-1.5" />
                {reenviarTodos ? 'Disparar para todos' : 'Confirmar envio'}
              </Button>
            </>
          )}
          {etapa === 'enviando' && (
            <Button disabled className="bg-sky-600">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Enviando...
            </Button>
          )}
          {etapa === 'resumo' && (
            <Button
              onClick={() => {
                if (resumo && resumo.erros > 0) {
                  toast({
                    title: titulo,
                    description: `${resumo.enviados} enviado(s), ${resumo.erros} erro(s). Veja o log na tela Envios.`,
                  })
                }
                onOpenChange(false)
              }}
              className="bg-sky-600 hover:bg-sky-700"
            >
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
