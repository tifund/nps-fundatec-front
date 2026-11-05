import React, { useEffect, useRef, useState } from 'react'
import { Campaign, CampaignQuestion, CreateCampaignPayload, Area } from '@/types/nps'
import { getCampaignQuestions } from '@/services/campaigns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, Loader2, Bold, Italic, List, Mail, Info, Lightbulb } from 'lucide-react'

export const PERGUNTA_NPS_PADRAO = 'Em uma escala de 0 a 10, quanto você recomendaria a Fundatec?'

// Template padrão do e-mail de convite Fundatec (variáveis {{pnome}} e {{link}})
export const TEMPLATE_EMAIL_PADRAO =
  '<p>Olá, <strong>{{pnome}}</strong>,</p>' +
  '<p>Gostaríamos muito de saber como foi sua experiência com a Fundatec. ' +
  'Sua opinião é fundamental para aprimorarmos continuamente nossos serviços.</p>' +
  '<p style="text-align:center; margin: 24px 0;">' +
  '<a href="{{link}}" style="background-color:#0284c7; color:#ffffff; padding:12px 28px; ' +
  'text-decoration:none; border-radius:6px; font-weight:bold; display:inline-block;">' +
  'Responder Avaliação Agora</a></p>' +
  '<p style="font-size:12px; color:#64748b;">Se o botão não funcionar, copie e cole ' +
  'este link no navegador: <a href="{{link}}">{{link}}</a></p>'

export interface CampaignFormValues {
  nome: string
  area_id: string
  pergunta_nps: string
  modo_acesso: 'convites' | 'link_aberto'
  status: 'rascunho' | 'ativa'
  vigencia_tipo: 'continua' | 'prazo'
  vigencia_fim: string // yyyy-mm-dd ou ''
  justificativa_detrator: 'obrigatoria' | 'geral'
  justificativa_geral: string
  texto_email_convite: string
  slug: string
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  areas: Area[]
  editing: Campaign | null
  submitting: boolean
  onSave: (
    valores: CampaignFormValues,
    perguntas: { enunciado: string; tipo: 'nota' | 'texto'; obrigatoria: boolean; ordem: number }[],
  ) => Promise<void>
}

// Editor "rico" simples (toolbar de formatação sobre um contentEditable).
// Guarda HTML com as variáveis {{pnome}} e {{link}}.
function EmailEditor({
  initialHtml,
  onChange,
}: {
  initialHtml: string
  onChange: (html: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== initialHtml) {
      ref.current.innerHTML = initialHtml
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialHtml])

  const exec = (cmd: string) => {
    document.execCommand(cmd, false)
    if (ref.current) onChange(ref.current.innerHTML)
  }

  const inserirVariavel = (v: string) => {
    document.execCommand('insertText', false, v)
    if (ref.current) onChange(ref.current.innerHTML)
  }

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 bg-slate-50 border-b border-slate-200 px-2 py-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => exec('bold')}
          title="Negrito"
        >
          <Bold className="w-3.5 h-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => exec('italic')}
          title="Itálico"
        >
          <Italic className="w-3.5 h-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => exec('insertUnorderedList')}
          title="Lista"
        >
          <List className="w-3.5 h-3.5" />
        </Button>
        <span className="w-px h-5 bg-slate-200 mx-1" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[11px] font-mono"
          onClick={() => inserirVariavel('{{pnome}}')}
        >
          {'{{pnome}}'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[11px] font-mono"
          onClick={() => inserirVariavel('{{link}}')}
        >
          {'{{link}}'}
        </Button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        data-placeholder="Texto do e-mail de convite..."
        className="prose prose-sm max-w-none min-h-[160px] max-h-64 overflow-y-auto p-3 text-sm focus:outline-none"
      />
    </div>
  )
}

export default function CampaignFormDialog({
  open,
  onOpenChange,
  areas,
  editing,
  submitting,
  onSave,
}: Props) {
  const isEdit = !!editing
  const [nome, setNome] = useState('')
  const [areaId, setAreaId] = useState('')
  const [perguntaNps, setPerguntaNps] = useState(PERGUNTA_NPS_PADRAO)
  const [modoAcesso, setModoAcesso] = useState<'convites' | 'link_aberto'>('convites')
  const [statusSalvo, setStatusSalvo] = useState<'rascunho' | 'ativa'>('rascunho')
  const [vigenciaTipo, setVigenciaTipo] = useState<'continua' | 'prazo'>('continua')
  const [vigenciaFim, setVigenciaFim] = useState('')
  const [justificativa, setJustificativa] = useState<'obrigatoria' | 'geral'>('obrigatoria')
  const [justificativaGeral, setJustificativaGeral] = useState('')
  const [emailHtml, setEmailHtml] = useState(TEMPLATE_EMAIL_PADRAO)
  const [slug, setSlug] = useState('')
  const [erro, setErro] = useState('')
  const [perguntas, setPerguntas] = useState<CampaignQuestion[]>([])
  const [novoEnunciado, setNovoEnunciado] = useState('')
  const [novoTipo, setNovoTipo] = useState<'nota' | 'texto'>('nota')
  const [novaObrigatoria, setNovaObrigatoria] = useState(false)

  // Carrega/reset ao abrir
  useEffect(() => {
    if (!open) return
    setErro('')
    if (editing) {
      setNome(editing.nome)
      setAreaId(editing.area_id)
      setPerguntaNps(editing.pergunta_nps)
      setModoAcesso(editing.modo_acesso)
      setStatusSalvo(editing.status === 'encerrada' ? 'rascunho' : editing.status)
      setVigenciaTipo(editing.vigencia_tipo || 'continua')
      setVigenciaFim(editing.vigencia_fim ? editing.vigencia_fim.split(' ')[0].split('T')[0] : '')
      setJustificativa(editing.justificativa_detrator === 'geral' ? 'geral' : 'obrigatoria')
      setJustificativaGeral(editing.justificativa_geral || '')
      setEmailHtml(editing.texto_email_convite || TEMPLATE_EMAIL_PADRAO)
      setSlug(editing.slug)
      getCampaignQuestions(editing.id)
        .then(setPerguntas)
        .catch(() => setPerguntas([]))
    } else {
      setNome('')
      setAreaId(areas.find((a) => a.ativa)?.id || '')
      setPerguntaNps(PERGUNTA_NPS_PADRAO)
      setModoAcesso('convites')
      setStatusSalvo('rascunho')
      setVigenciaTipo('continua')
      setVigenciaFim('')
      setJustificativa('obrigatoria')
      setJustificativaGeral('')
      setEmailHtml(TEMPLATE_EMAIL_PADRAO)
      setSlug('')
      setPerguntas([])
    }
    setNovoEnunciado('')
    setNovoTipo('nota')
    setNovaObrigatoria(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing])

  const addPergunta = () => {
    if (!novoEnunciado.trim()) return
    setPerguntas((prev) => [
      ...prev,
      {
        id: `novo-${prev.length + 1}`,
        campaign_id: editing?.id || '',
        enunciado: novoEnunciado.trim(),
        tipo: novoTipo,
        obrigatoria: novaObrigatoria,
        ordem: prev.length + 1,
      },
    ])
    setNovoEnunciado('')
    setNovoTipo('nota')
    setNovaObrigatoria(false)
  }

  const removePergunta = (id: string) => {
    setPerguntas((prev) => prev.filter((p) => p.id !== id).map((p, i) => ({ ...p, ordem: i + 1 })))
  }

  const moverPergunta = (idx: number, direcao: -1 | 1) => {
    setPerguntas((prev) => {
      const nova = [...prev]
      const alvo = idx + direcao
      if (alvo < 0 || alvo >= nova.length) return prev
      ;[nova[idx], nova[alvo]] = [nova[alvo], nova[idx]]
      return nova.map((p, i) => ({ ...p, ordem: i + 1 }))
    })
  }

  const validar = (): string => {
    if (!nome.trim()) return 'Informe o nome da campanha.'
    if (!areaId) return 'Selecione a área de negócio da campanha.'
    if (!perguntaNps.trim()) return 'Informe a pergunta NPS da campanha.'
    if (!slug.trim()) return 'Informe o identificador (slug) da URL.'
    if (vigenciaTipo === 'prazo') {
      if (!vigenciaFim) return 'Com vigência "Com prazo", a data de encerramento é obrigatória.'
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)
      if (new Date(`${vigenciaFim}T23:59:59`) < hoje)
        return 'A data de encerramento deve ser uma data futura.'
    }
    if (justificativa === 'geral' && !justificativaGeral.trim())
      return 'Com justificativa geral, escreva o texto de justificativa sobre os detratores.'
    if (statusSalvo === 'ativa' && (!areaId || !perguntaNps.trim()))
      return 'Só é possível ativar uma campanha com área vinculada e pergunta NPS preenchida.'
    return ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const erroAtual = validar()
    if (erroAtual) {
      setErro(erroAtual)
      return
    }
    setErro('')
    const valores: CampaignFormValues = {
      nome: nome.trim(),
      area_id: areaId,
      pergunta_nps: perguntaNps.trim(),
      modo_acesso: modoAcesso,
      status: statusSalvo,
      vigencia_tipo: vigenciaTipo,
      vigencia_fim: vigenciaTipo === 'prazo' ? `${vigenciaFim} 23:59:59.000Z` : '',
      justificativa_detrator: justificativa,
      justificativa_geral: justificativa === 'geral' ? justificativaGeral.trim() : '',
      texto_email_convite: emailHtml,
      slug: slug.trim(),
    }
    await onSave(
      valores,
      perguntas.map((p, i) => ({
        enunciado: p.enunciado,
        tipo: p.tipo,
        obrigatoria: p.obrigatoria,
        ordem: i + 1,
      })),
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-800">
              {isEdit ? 'Editar Campanha' : 'Nova Campanha de NPS'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Configure a área, o modo de acesso, a vigência, a justificativa de detrator e o e-mail
              de convite.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {erro && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3 py-2 flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                {erro}
              </div>
            )}

            {/* Nome + slug */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700">Nome da campanha *</Label>
                <Input
                  value={nome}
                  onChange={(e) => {
                    setNome(e.target.value)
                    if (!isEdit) setSlug(generateSlug(e.target.value))
                  }}
                  placeholder="Ex: Satisfação Alunos 2025/1"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700">
                  Identificador da URL (slug) *
                </Label>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(generateSlug(e.target.value))}
                  placeholder="ex: nps-alunos-2025"
                  className="text-sm font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">Área de negócio *</Label>
              <Select value={areaId} onValueChange={setAreaId}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Selecione uma área ativa" />
                </SelectTrigger>
                <SelectContent>
                  {areas
                    .filter((a) => a.ativa || a.id === areaId)
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.nome}
                        {!a.ativa && ' (inativa)'}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Pergunta NPS + comentário aberto */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">Pergunta NPS *</Label>
              <Textarea
                rows={2}
                value={perguntaNps}
                onChange={(e) => setPerguntaNps(e.target.value)}
                className="text-sm"
              />
              <div className="flex items-start gap-2 rounded-lg bg-sky-50 border border-sky-100 px-3 py-2 text-[11px] text-sky-800">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Toda avaliação terá automaticamente um campo de comentário opcional — este campo é
                fixo do sistema e não pode ser desativado nem parametrizado.
              </div>
            </div>

            {/* Perguntas adicionais */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-slate-700">
                  Perguntas adicionais (opcionais)
                </Label>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-amber-50 text-amber-700 border-amber-200"
                >
                  <Lightbulb className="w-3 h-3 mr-1" />
                  Ideal NPS: apenas a pergunta principal
                </Badge>
              </div>
              {perguntas.length > 0 && (
                <div className="space-y-1.5">
                  {perguntas.map((p, idx) => (
                    <div
                      key={p.id}
                      className="flex items-start gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    >
                      <span className="font-semibold text-slate-500 mt-0.5">{p.ordem}.</span>
                      <div className="flex-1">
                        <div className="font-medium text-slate-800">{p.enunciado}</div>
                        <div className="text-slate-500 mt-0.5">
                          {p.tipo === 'nota' ? 'Nota 0–10' : 'Texto livre'}
                          {p.obrigatoria && ' · obrigatória'}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => moverPergunta(idx, -1)}
                        disabled={idx === 0}
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => moverPergunta(idx, 1)}
                        disabled={idx === perguntas.length - 1}
                      >
                        ↓
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-rose-600"
                        onClick={() => removePergunta(p.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-lg space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
                  <div className="space-y-1">
                    <Input
                      placeholder="Enunciado da pergunta adicional..."
                      value={novoEnunciado}
                      onChange={(e) => setNovoEnunciado(e.target.value)}
                      className="text-xs bg-white"
                    />
                  </div>
                  <Select value={novoTipo} onValueChange={(v: 'nota' | 'texto') => setNovoTipo(v)}>
                    <SelectTrigger className="text-xs bg-white h-9 w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nota">Nota 0–10</SelectItem>
                      <SelectItem value="texto">Texto livre</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    onClick={addPergunta}
                    disabled={!novoEnunciado.trim()}
                    className="h-9 bg-sky-600 hover:bg-sky-700 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Adicionar
                  </Button>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <Checkbox
                    checked={novaObrigatoria}
                    onCheckedChange={(v) => setNovaObrigatoria(v === true)}
                    className="text-sky-600"
                  />
                  Resposta obrigatória nesta pergunta
                </label>
              </div>
            </div>

            {/* Modo de acesso */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">Modo de acesso *</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(
                  [
                    {
                      v: 'convites',
                      t: 'Convites individuais',
                      d: 'Importação de participantes + link pessoal por hash.',
                    },
                    {
                      v: 'link_aberto',
                      t: 'Link aberto',
                      d: 'Sem importação; o sistema gera um link único da campanha.',
                    },
                  ] as const
                ).map((op) => (
                  <button
                    key={op.v}
                    type="button"
                    onClick={() => setModoAcesso(op.v)}
                    className={`text-left p-3 rounded-lg border text-xs transition ${
                      modoAcesso === op.v
                        ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-300'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="font-semibold text-slate-800">{op.t}</div>
                    <div className="text-slate-500 mt-0.5">{op.d}</div>
                  </button>
                ))}
              </div>
              {modoAcesso === 'link_aberto' && (
                <p className="text-[11px] text-slate-500">
                  Campanhas de link aberto não exibem nem importam participantes — a distribuição é
                  feita pelo link único gerado.
                </p>
              )}
            </div>

            {/* Vigência */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">Vigência *</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(
                  [
                    {
                      v: 'continua',
                      t: 'Contínua',
                      d: 'Sem data de fim — funciona até ser encerrada manualmente.',
                    },
                    { v: 'prazo', t: 'Com prazo', d: 'Exige data de encerramento futura.' },
                  ] as const
                ).map((op) => (
                  <button
                    key={op.v}
                    type="button"
                    onClick={() => setVigenciaTipo(op.v)}
                    className={`text-left p-3 rounded-lg border text-xs transition ${
                      vigenciaTipo === op.v
                        ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-300'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="font-semibold text-slate-800">{op.t}</div>
                    <div className="text-slate-500 mt-0.5">{op.d}</div>
                  </button>
                ))}
              </div>
              {vigenciaTipo === 'prazo' && (
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">Data de encerramento *</Label>
                  <Input
                    type="date"
                    value={vigenciaFim}
                    onChange={(e) => setVigenciaFim(e.target.value)}
                    className="text-sm"
                  />
                </div>
              )}
            </div>

            {/* Justificativa de detrator */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">
                Justificativa de detrator *
              </Label>
              <Select
                value={justificativa}
                onValueChange={(v: 'obrigatoria' | 'geral') => setJustificativa(v)}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="obrigatoria">
                    Individual obrigatória (nota 0–6 exige texto do respondente)
                  </SelectItem>
                  <SelectItem value="geral">Justificativa geral da campanha</SelectItem>
                </SelectContent>
              </Select>
              {justificativa === 'geral' && (
                <Textarea
                  rows={3}
                  placeholder="Texto de justificativa geral exibido aos respondentes detratores (nota 0–6)..."
                  value={justificativaGeral}
                  onChange={(e) => setJustificativaGeral(e.target.value)}
                  className="text-sm"
                />
              )}
            </div>

            {/* E-mail de convite */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-sky-600" />
                Texto do e-mail de convite
              </Label>
              <p className="text-[11px] text-slate-500">
                Editor rico com valor padrão do template Fundatec. Variáveis disponíveis:{' '}
                <code className="font-mono bg-slate-100 px-1 rounded">{'{{pnome}}'}</code> (primeiro
                nome) e <code className="font-mono bg-slate-100 px-1 rounded">{'{{link}}'}</code>{' '}
                (link da avaliação).
              </p>
              <EmailEditor initialHtml={emailHtml} onChange={setEmailHtml} />
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">Status *</Label>
              {editing?.status === 'encerrada' ? (
                <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  Esta campanha está <strong>encerrada</strong> e não pode voltar a ficar ativa.
                </div>
              ) : (
                <Select
                  value={statusSalvo}
                  onValueChange={(v: 'rascunho' | 'ativa') => setStatusSalvo(v)}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rascunho">Rascunho (ainda não recebe respostas)</SelectItem>
                    <SelectItem value="ativa">Ativa (recebe respostas)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" className="bg-sky-600 hover:bg-sky-700" disabled={submitting}>
              {submitting ? (
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
  )
}

// Exporta também o tipo do payload já pronto para o serviço
export function toPayload(v: CampaignFormValues): CreateCampaignPayload {
  return {
    nome: v.nome,
    area_id: v.area_id,
    pergunta_nps: v.pergunta_nps,
    modo_acesso: v.modo_acesso,
    status: v.status,
    vigencia_tipo: v.vigencia_tipo,
    vigencia_fim: v.vigencia_fim || undefined,
    justificativa_detrator: v.justificativa_detrator,
    justificativa_geral: v.justificativa_geral || undefined,
    texto_email_convite: v.texto_email_convite || undefined,
    slug: v.slug,
  }
}
