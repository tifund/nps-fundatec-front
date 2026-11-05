import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getParticipantByToken } from '@/services/participants'
import { getCampaignBySlug, getCampaignQuestions } from '@/services/campaigns'
import { submitSurveyResponse } from '@/services/responses'
import { Campaign, Participant, Question } from '@/types/nps'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Send,
  HeartHandshake,
  CalendarX,
} from 'lucide-react'

export default function SurveyPage() {
  const { token, slug } = useParams<{ token?: string; slug?: string }>()

  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [alreadyAnswered, setAlreadyAnswered] = useState(false)
  const [campaignClosed, setCampaignClosed] = useState(false)

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])

  // Formulário de Resposta
  const [selectedNota, setSelectedNota] = useState<number | null>(null)
  const [comentario, setComentario] = useState('')
  const [justificativaDetrator, setJustificativaDetrator] = useState('')
  const [anonimo, setAnonimo] = useState(false)
  const [additionalAnswers, setAdditionalAnswers] = useState<Record<string, string | number>>({})

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  useEffect(() => {
    async function loadSurvey() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        let loadedCampaign: Campaign | null = null
        let loadedParticipant: Participant | null = null

        if (token) {
          // Acesso via token individual de convite
          try {
            loadedParticipant = await getParticipantByToken(token)
            setParticipant(loadedParticipant)

            if (loadedParticipant.respondido) {
              setAlreadyAnswered(true)
              setIsLoading(false)
              return
            }

            if (loadedParticipant.expand?.campaign_id) {
              loadedCampaign = loadedParticipant.expand.campaign_id
            }
          } catch {
            setErrorMessage('Convite não encontrado ou link de avaliação inválido.')
            setIsLoading(false)
            return
          }
        } else if (slug) {
          // Acesso via link aberto da campanha
          try {
            loadedCampaign = await getCampaignBySlug(slug)
          } catch {
            setErrorMessage('Campanha não encontrada ou link indisponível.')
            setIsLoading(false)
            return
          }
        }

        if (!loadedCampaign) {
          setErrorMessage('Não foi possível identificar a campanha de avaliação.')
          setIsLoading(false)
          return
        }

        // Verifica encerramento ou vigência
        const isExpirada =
          loadedCampaign.vigencia_fim && new Date(loadedCampaign.vigencia_fim) < new Date()
        if (loadedCampaign.status === 'encerrada' || isExpirada) {
          setCampaignClosed(true)
          setCampaign(loadedCampaign)
          setIsLoading(false)
          return
        }

        setCampaign(loadedCampaign)

        // Busca perguntas adicionais da campanha
        const qList = await getCampaignQuestions(loadedCampaign.id)
        setQuestions(qList)
      } catch (err: unknown) {
        setErrorMessage((err as Error)?.message || 'Ocorreu um erro ao carregar a pesquisa.')
      } finally {
        setIsLoading(false)
      }
    }

    loadSurvey()
  }, [token, slug])

  const isDetrator = selectedNota !== null && selectedNota <= 6
  const requiresDetractorReason = campaign?.justificativa_detrator === 'obrigatoria' && isDetrator

  const handleScoreSelect = (nota: number) => {
    setSelectedNota(nota)
  }

  const handleAdditionalChange = (questionId: string, value: string | number) => {
    setAdditionalAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedNota === null || !campaign) return

    // Validação de justificativa obrigatória de detrator
    if (requiresDetractorReason && !justificativaDetrator.trim()) {
      alert('Por favor, informe a justificativa para que possamos aprimorar nossos serviços.')
      return
    }

    // Validação de perguntas adicionais obrigatórias
    for (const q of questions) {
      if (q.obrigatoria) {
        const val = additionalAnswers[q.id]
        if (val === undefined || val === '') {
          alert(`Por favor, responda a pergunta obrigatória: "${q.enunciado}"`)
          return
        }
      }
    }

    setIsSubmitting(true)
    try {
      const formattedAnswers = questions.map((q) => ({
        question_id: q.id,
        enunciado: q.enunciado,
        valor: additionalAnswers[q.id] ?? '',
      }))

      await submitSurveyResponse({
        campaign_id: campaign.id,
        participant_id: participant?.id,
        nota: selectedNota,
        comentario: comentario.trim() || undefined,
        justificativa_detrator: justificativaDetrator.trim() || undefined,
        anonimo: anonimo,
        respostas_adicionais: formattedAnswers,
      })

      setIsSubmitted(true)
    } catch (err: unknown) {
      alert('Erro ao enviar avaliação: ' + ((err as Error)?.message || 'Tente novamente.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Carregando pesquisa de satisfação...</p>
        </div>
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-slate-200 shadow-sm text-center p-6">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800">Atenção</h2>
          <p className="text-sm text-slate-600 mt-2">{errorMessage}</p>
          <div className="mt-6">
            <Link to="/login">
              <Button variant="outline" size="sm">
                Ir para o Painel
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  if (alreadyAnswered) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-slate-200 shadow-sm text-center p-8 bg-white">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-100">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Avaliação Já Respondida</h2>
          <p className="text-sm text-slate-600 mt-2">
            Identificamos que este link de convite já foi utilizado para envio de avaliação.
            Agradecemos sua colaboração!
          </p>
          <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-400">
            Fundatec &bull; Gestão da Qualidade e Relacionamento
          </div>
        </Card>
      </div>
    )
  }

  if (campaignClosed) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-slate-200 shadow-sm text-center p-8 bg-white">
          <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-100">
            <CalendarX className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Campanha Encerrada</h2>
          <p className="text-sm text-slate-600 mt-2">
            O período de recebimento de respostas para a campanha &quot;{campaign?.nome}&quot; foi
            encerrado.
          </p>
          <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-400">
            Fundatec &bull; Gestão da Qualidade e Relacionamento
          </div>
        </Card>
      </div>
    )
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full border-slate-200 shadow-sm text-center p-8 bg-white">
          <div className="w-16 h-16 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center mx-auto mb-4 border border-sky-100">
            <HeartHandshake className="w-8 h-8" />
          </div>
          <Badge className="mb-2 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 text-xs font-semibold">
            Resposta Gravada com Sucesso
          </Badge>
          <h2 className="text-2xl font-bold text-slate-800">Obrigado pela sua avaliação!</h2>
          <p className="text-sm text-slate-600 mt-3 leading-relaxed">
            Sua opinião é de extrema importância para a Fundatec. Nossas equipes analisam cada
            feedback com carinho para aprimorar continuamente nossos serviços, cursos e processos.
          </p>
          <div className="mt-8 pt-4 border-t border-slate-100 text-xs text-slate-400">
            Fundatec &copy; {new Date().getFullYear()} &bull; Compromisso com a Excelência
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 lg:px-8 flex justify-center">
      <div className="w-full max-w-2xl">
        {/* Cabeçalho da Marca */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-sky-600 text-white font-black text-xl shadow-md mb-2">
            F
          </div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Fundatec NPS</h1>
          <p className="text-xs text-slate-500">Pesquisa Institucional de Satisfação</p>
        </div>

        <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
          <div className="h-2 bg-sky-600 w-full" />
          <CardHeader className="space-y-2 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-100">
                {campaign?.expand?.area_id?.nome || 'Fundatec'}
              </span>
              {participant && (
                <span className="text-xs text-slate-500">
                  Olá, <strong className="text-slate-700">{participant.nome}</strong>
                </span>
              )}
            </div>

            <CardTitle className="text-lg font-bold text-slate-800 leading-snug">
              {campaign?.nome}
            </CardTitle>

            {campaign?.texto_geral && (
              <CardDescription className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                {campaign.texto_geral}
              </CardDescription>
            )}
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6 pt-2">
              {/* Pergunta Principal NPS */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-50/70 border border-slate-200">
                <Label className="text-sm font-semibold text-slate-800 block leading-snug">
                  {campaign?.pergunta_nps} *
                </Label>
                <p className="text-xs text-slate-500">
                  Selecione uma nota de <strong>0 (pouco provável)</strong> a{' '}
                  <strong>10 (extremamente provável)</strong>:
                </p>

                {/* Escala de Notas 0 a 10 */}
                <div className="grid grid-cols-11 gap-1 sm:gap-1.5 pt-2">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                    const isSelected = selectedNota === num
                    let colorClass = 'hover:border-sky-400'

                    if (isSelected) {
                      if (num >= 9) colorClass = 'bg-emerald-600 text-white border-emerald-600'
                      else if (num >= 7) colorClass = 'bg-amber-500 text-white border-amber-500'
                      else colorClass = 'bg-rose-600 text-white border-rose-600'
                    } else {
                      colorClass = 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }

                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleScoreSelect(num)}
                        className={`h-11 sm:h-12 flex items-center justify-center rounded-lg border font-bold text-sm sm:text-base transition-all shadow-xs ${colorClass}`}
                      >
                        {num}
                      </button>
                    )
                  })}
                </div>

                <div className="flex justify-between text-[11px] text-slate-400 font-medium px-1">
                  <span>0 - Nada provável</span>
                  <span>10 - Extremamente provável</span>
                </div>

                {selectedNota !== null && (
                  <div className="pt-2 flex items-center justify-center">
                    <Badge
                      variant="outline"
                      className={`text-xs py-1 px-3 ${
                        selectedNota >= 9
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : selectedNota >= 7
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      Nota {selectedNota}:{' '}
                      {selectedNota >= 9
                        ? 'Promotor (Satisfeito)'
                        : selectedNota >= 7
                          ? 'Neutro'
                          : 'Detrator (Necessita atenção)'}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Justificativa Obrigatória / Opcional para Detratores */}
              {isDetrator && campaign?.justificativa_detrator !== 'nenhuma' && (
                <div className="space-y-2 p-4 rounded-xl bg-rose-50/70 border border-rose-200">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <Label
                      htmlFor="justificativa-detrator"
                      className="text-xs font-semibold text-rose-900"
                    >
                      O que podemos fazer para melhorar sua experiência?{' '}
                      {requiresDetractorReason && (
                        <span className="text-rose-600">* (Obrigatório)</span>
                      )}
                    </Label>
                  </div>
                  <Textarea
                    id="justificativa-detrator"
                    rows={3}
                    placeholder="Conte-nos o que motivou sua nota e quais aspectos precisamos aprimorar..."
                    value={justificativaDetrator}
                    onChange={(e) => setJustificativaDetrator(e.target.value)}
                    required={requiresDetractorReason}
                    className="text-xs bg-white border-rose-200 focus-visible:ring-rose-400"
                  />
                  <p className="text-[11px] text-rose-700">
                    Sua crítica construtiva nos ajuda diretamente a corrigir processos e treinar
                    equipes.
                  </p>
                </div>
              )}

              {/* Comentário Geral */}
              <div className="space-y-1.5">
                <Label htmlFor="comentario" className="text-xs font-medium text-slate-700">
                  Comentário ou elogio adicional (opcional)
                </Label>
                <Textarea
                  id="comentario"
                  rows={2}
                  placeholder="Deixe seus comentários, sugestões ou elogios..."
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  className="text-xs"
                />
              </div>

              {/* Perguntas Adicionais da Campanha */}
              {questions.length > 0 && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Perguntas Complementares
                  </h3>

                  {questions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="space-y-2 p-3.5 rounded-lg border border-slate-200 bg-slate-50/50"
                    >
                      <Label className="text-xs font-semibold text-slate-800 block">
                        {idx + 1}. {q.enunciado}{' '}
                        {q.obrigatoria && <span className="text-rose-500">*</span>}
                      </Label>

                      {q.tipo === 'nota' ? (
                        <div className="space-y-1">
                          <div className="grid grid-cols-11 gap-1">
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
                              const isChecked = additionalAnswers[q.id] === n
                              return (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => handleAdditionalChange(q.id, n)}
                                  className={`h-8 rounded text-xs font-bold border transition-colors ${
                                    isChecked
                                      ? 'bg-sky-600 text-white border-sky-600'
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  {n}
                                </button>
                              )
                            })}
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400 px-0.5">
                            <span>0 (Péssimo)</span>
                            <span>10 (Excelente)</span>
                          </div>
                        </div>
                      ) : (
                        <Input
                          placeholder="Sua resposta em texto..."
                          value={(additionalAnswers[q.id] as string) || ''}
                          onChange={(e) => handleAdditionalChange(q.id, e.target.value)}
                          required={q.obrigatoria}
                          className="text-xs bg-white"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Opção de Anonimato */}
              <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 bg-slate-50/70">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-slate-600" />
                    <Label
                      htmlFor="anonimo-switch"
                      className="text-xs font-semibold text-slate-800 cursor-pointer"
                    >
                      Enviar resposta de forma anônima
                    </Label>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Seu nome e e-mail não serão exibidos no relatório de respostas da pesquisa.
                  </p>
                </div>
                <Switch id="anonimo-switch" checked={anonimo} onCheckedChange={setAnonimo} />
              </div>
            </CardContent>

            <CardFooter className="pt-2 pb-6 px-6">
              <Button
                type="submit"
                disabled={selectedNota === null || isSubmitting}
                className="w-full bg-sky-600 hover:bg-sky-700 font-semibold h-11"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Gravando avaliação...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Enviar Minha Avaliação
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <p className="text-center text-xs text-slate-400 mt-6">
          Fundatec &bull; Fundação Universidade Empresa de Tecnologia e Ciências
        </p>
      </div>
    </div>
  )
}
