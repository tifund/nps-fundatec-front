import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Loader2, ShieldCheck, Send, PartyPopper } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  getSurveyContextByParams,
  parseAvaliacaoParams,
  type ParametroAvaliacao,
} from '@/services/surveyContext'
import { submitSurveyResponse } from '@/services/responses'
import { primeiroNome } from '@/lib/convite/template'
import type { SurveyContext } from '@/types/nps'
import { cn } from '@/lib/utils'

const ESCALA = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

type PerguntaAdicional = SurveyContext['questions'][number]

type RespostasAdicionais = Record<string, { nota?: number; texto?: string }>

function corNota(n: number): string {
  if (n <= 6) return 'bg-rose-600 hover:bg-rose-700 text-white'
  if (n <= 8) return 'bg-amber-500 hover:bg-amber-600 text-white'
  return 'bg-emerald-600 hover:bg-emerald-700 text-white'
}

// Escala 0 a 10 em botões grandes (o toque principal da página — mobile first)
function EscalaNps({
  valor,
  onChange,
  disabled,
}: {
  valor: number | null
  onChange: (n: number) => void
  disabled?: boolean
}) {
  return (
    <div className="grid grid-cols-11 gap-1 sm:gap-2 w-full">
      {ESCALA.map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          aria-label={`Nota ${n}`}
          className={cn(
            'aspect-square w-full rounded-lg border text-base sm:text-xl font-bold transition-all',
            'flex items-center justify-center select-none',
            valor === n
              ? corNota(n) + ' border-transparent scale-105 shadow-md'
              : 'bg-white border-slate-300 text-slate-700 hover:border-sky-500 hover:text-sky-700 hover:bg-sky-50 active:scale-95',
          )}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

// Rótulos da escala estilo NPS clássico
function RotulosEscala() {
  return (
    <div className="flex justify-between text-xs text-slate-500 mt-1.5 px-0.5">
      <span>Pouco provável</span>
      <span>Muito provável</span>
    </div>
  )
}

export function AvaliacaoPage() {
  const [searchParams] = useSearchParams()
  const param: ParametroAvaliacao | null = useMemo(
    () => parseAvaliacaoParams(searchParams),
    [searchParams],
  )

  const [carregando, setCarregando] = useState(true)
  const [erroLink, setErroLink] = useState(false)
  const [contexto, setContexto] = useState<SurveyContext | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erroEnvio, setErroEnvio] = useState('')

  // Respostas
  const [nota, setNota] = useState<number | null>(null)
  const [justificativa, setJustificativa] = useState('')
  const [respostasAdicionais, setRespostasAdicionais] = useState<RespostasAdicionais>({})
  const [comentario, setComentario] = useState('')
  const [anonimo, setAnonimo] = useState(false)

  useEffect(() => {
    setCarregando(true)
    setErroLink(false)
    setContexto(null)
    setEnviado(false)
    setErroEnvio('')
    setNota(null)
    setJustificativa('')
    setRespostasAdicionais({})
    setComentario('')
    setAnonimo(false)

    if (!param) {
      setCarregando(false)
      setErroLink(true)
      return
    }

    let ativo = true
    getSurveyContextByParams(param)
      .then((ctx) => {
        if (ativo) setContexto(ctx)
      })
      .catch(() => {
        if (ativo) setErroLink(true)
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [param])

  const campanha = contexto?.campaign ?? null
  const participante = contexto?.participant ?? null
  const perguntas = contexto?.questions ?? []

  const jaRespondido = contexto?.closed_reason === 'ja_respondida'
  const encerrada = contexto !== null && !jaRespondido && contexto.closed_reason !== ''

  // Justificativa de detrator obrigatória? (nota 0–6 + campanha individual_obrigatoria)
  const exigeJustificativa =
    campanha?.justificativa_detrator === 'obrigatoria' && nota !== null && nota <= 6

  const podeEnviar =
    nota !== null && (!exigeJustificativa || justificativa.trim().length > 0) && !enviando

  const enviar = async () => {
    if (nota === null || !campanha || !contexto) return
    setEnviando(true)
    setErroEnvio('')
    try {
      await submitSurveyResponse({
        campaign_id: campanha.id,
        // No link aberto, ou com anonimato marcado, a resposta não carrega vínculo.
        participant_id: participante && !anonimo ? participante.id : '',
        nota,
        classificacao: nota <= 6 ? 'detrator' : nota <= 8 ? 'neutro' : 'promotor',
        comentario: comentario.trim(),
        justificativa_detrator: nota <= 6 && justificativa.trim() ? justificativa.trim() : '',
        anonimo: anonimo,
        respostas_adicionais: perguntas
          .map((q) => {
            const r = respostasAdicionais[q.id] || {}
            const valor = q.tipo === 'nota' ? r.nota : (r.texto || '').trim()
            if (valor === undefined || valor === null || valor === '') return null
            return { question_id: q.id, enunciado: q.enunciado, valor }
          })
          .filter((v) => v !== null),
      })
      setEnviado(true)
    } catch (err) {
      setErroEnvio(
        (err as Error)?.message || 'Não foi possível registrar sua avaliação. Tente novamente.',
      )
    } finally {
      setEnviando(false)
    }
  }

  // ---------- Estados de tela ----------

  if (carregando) {
    return (
      <EstadoCentral>
        <Loader2 className="w-8 h-8 text-sky-700 animate-spin" />
        <p className="text-sm text-slate-500">Carregando avaliação…</p>
      </EstadoCentral>
    )
  }

  if (erroLink || !param || !contexto || !campanha) {
    return (
      <EstadoCentral>
        <p className="text-lg font-medium text-slate-700">Link inválido ou expirado</p>
      </EstadoCentral>
    )
  }

  if (jaRespondido) {
    return (
      <EstadoCentral>
        <p className="text-lg font-medium text-slate-700">
          Esta avaliação já foi preenchida. Obrigado!
        </p>
      </EstadoCentral>
    )
  }

  if (encerrada) {
    return (
      <EstadoCentral>
        <p className="text-lg font-medium text-slate-700">Esta campanha está encerrada</p>
      </EstadoCentral>
    )
  }

  if (enviado) {
    return (
      <EstadoCentral>
        <PartyPopper className="w-10 h-10 text-sky-700" />
        <p className="text-lg font-semibold text-slate-800">Obrigado pela sua avaliação!</p>
        <p className="text-sm text-slate-500">Sua opinião ajuda a Fundatec a melhorar.</p>
      </EstadoCentral>
    )
  }

  // ---------- Formulário ----------

  const nomeParticipante = participante?.nome || ''
  const saudacao = participante ? `Olá, ${primeiroNome(nomeParticipante)}!` : 'Olá!'

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white">
      <div className="mx-auto w-full max-w-xl px-4 py-8 sm:py-12">
        {/* Cabeçalho institucional */}
        <header className="text-center mb-6 sm:mb-8">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-sky-700 text-white font-bold text-lg">
            F
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-800">
            Fundatec
          </p>
          <h1 className="mt-1 text-xl sm:text-2xl font-bold text-slate-800">
            Pesquisa de Satisfação
          </h1>
          {campanha.area_nome ? (
            <p className="mt-1 text-xs text-slate-500">{campanha.area_nome}</p>
          ) : null}
        </header>

        <form
          className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm space-y-7"
          onSubmit={(e) => {
            e.preventDefault()
            if (podeEnviar) enviar()
          }}
        >
          {/* 1) Saudação */}
          <p className="text-base sm:text-lg text-slate-700">
            {saudacao}{' '}
            <span className="text-sm text-slate-500">Sua opinião é muito importante para nós.</span>
          </p>

          {/* 2) Pergunta NPS + escala 0–10 */}
          <div className="space-y-3">
            <label className="block text-sm sm:text-base font-semibold text-slate-800">
              {campanha.pergunta_nps} <span className="text-rose-600">*</span>
            </label>
            <EscalaNps valor={nota} onChange={setNota} />
            <RotulosEscala />
          </div>

          {/* 3) Justificativa do detrator (0–6) */}
          {campanha.justificativa_detrator === 'obrigatoria' && nota !== null && nota <= 6 ? (
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-800">
                Nos ajude a melhorar: conte o que motivou sua nota{' '}
                <span className="text-rose-600">*</span>
              </label>
              <Textarea
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                rows={3}
                className="resize-none"
              />
              {justificativa.trim() === '' ? (
                <p className="text-xs text-rose-600">
                  A justificativa é obrigatória para notas de 0 a 6.
                </p>
              ) : null}
            </div>
          ) : campanha.justificativa_detrator === 'geral' && campanha.justificativa_geral ? (
            <p className="rounded-lg bg-sky-50 border border-sky-100 px-4 py-3 text-sm text-sky-900">
              {campanha.justificativa_geral}
            </p>
          ) : null}

          {/* 4) Perguntas adicionais (todas opcionais na prática) */}
          {perguntas.map((q: PerguntaAdicional) => (
            <div key={q.id} className="space-y-3">
              <label className="block text-sm sm:text-base font-semibold text-slate-800">
                {q.enunciado}
              </label>
              {q.tipo === 'nota' ? (
                <EscalaNps
                  valor={respostasAdicionais[q.id]?.nota ?? null}
                  onChange={(n) =>
                    setRespostasAdicionais((prev) => ({
                      ...prev,
                      [q.id]: { ...prev[q.id], nota: n },
                    }))
                  }
                />
              ) : (
                <Textarea
                  value={respostasAdicionais[q.id]?.texto || ''}
                  onChange={(e) =>
                    setRespostasAdicionais((prev) => ({
                      ...prev,
                      [q.id]: { ...prev[q.id], texto: e.target.value },
                    }))
                  }
                  rows={3}
                  className="resize-none"
                />
              )}
            </div>
          ))}

          {/* 5) Comentário aberto (todas as campanhas) */}
          <div className="space-y-2">
            <label className="block text-sm sm:text-base font-semibold text-slate-800">
              Quer comentar algo mais?
            </label>
            <Textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* 6) Anonimato — decisão do respondente */}
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3 cursor-pointer">
            <Checkbox
              checked={anonimo}
              onCheckedChange={(v) => setAnonimo(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm text-slate-700 select-none">
              Quero responder de forma anônima
            </span>
          </label>

          {erroEnvio ? (
            <p className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
              {erroEnvio}
            </p>
          ) : null}

          {/* 7) Enviar */}
          <Button
            type="submit"
            disabled={!podeEnviar}
            className="w-full h-12 text-base font-semibold bg-sky-700 hover:bg-sky-800"
          >
            {enviando ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Enviar
              </>
            )}
          </Button>
          {nota === null ? (
            <p className="text-center text-xs text-slate-500">
              Selecione uma nota de 0 a 10 para enviar.
            </p>
          ) : null}
        </form>

        {/* 8) Rodapé */}
        <footer className="mt-8 pb-6 text-center">
          <ShieldCheck className="mx-auto mb-2 h-4 w-4 text-slate-400" />
          <p className="text-[11px] text-slate-400">
            Fundatec — Fundação Universidade Empresa de Tecnologia e Ciências
          </p>
          <a
            href="https://fundatec.org.br"
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-xs text-sky-700 hover:underline"
          >
            Política de Privacidade
          </a>
        </footer>
      </div>
    </div>
  )
}

function EstadoCentral({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-3">
        {children}
        <p className="pt-2 text-xs text-slate-400">
          <Link to="https://fundatec.org.br" className="hover:underline" asChild={false}>
            Fundatec
          </Link>
        </p>
      </div>
    </div>
  )
}
