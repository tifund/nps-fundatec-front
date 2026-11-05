import React, { useMemo, useState } from 'react'
import { Campaign } from '@/types/nps'
import { conviteParaTexto, assuntoConvite } from '@/lib/convite/template'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Link2, Copy, MessageSquareText, Info } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaign: Campaign | null
}

/**
 * Dialog do modo "link aberto": mostra o LINK ÚNICO da campanha com botão
 * "copiar link" e botão "copiar mensagem pronta" (texto do convite com o
 * link embutido, para colar em WhatsApp, Teams ou outro canal).
 * Não há envio individual neste modo (trava do sistema).
 */
export default function OpenLinkDialog({ open, onOpenChange, campaign }: Props) {
  const { toast } = useToast()
  const [pnomeExemplo, setPnomeExemplo] = useState('')

  const baseUrl = window.location.origin
  const linkUnico = campaign ? `${baseUrl}/avaliar/aberto/${campaign.slug}` : ''

  const mensagemPronta = useMemo(() => {
    if (!campaign) return ''
    const pnome = pnomeExemplo.trim() || '{{pnome}}'
    return conviteParaTexto(campaign.texto_email_convite, pnome, linkUnico)
  }, [campaign, pnomeExemplo, linkUnico])

  if (!campaign) return null

  const copiar = async (texto: string, titulo: string, descricao: string) => {
    try {
      await navigator.clipboard.writeText(texto)
      toast({ title: titulo, description: descricao })
    } catch {
      // fallback para ambientes sem permissão de clipboard
      const el = document.createElement('textarea')
      el.value = texto
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      toast({ title: titulo, description: descricao })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-sky-600" />
            Link aberto — {campaign.nome}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Neste modo qualquer pessoa com o link pode responder. Não há envio individual de
            convites — compartilhe pelo canal que preferir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Link único */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Link único da campanha</Label>
            <div className="flex items-center gap-2">
              <Input readOnly value={linkUnico} className="text-xs font-mono bg-slate-50" />
              <Button
                variant="outline"
                size="sm"
                className="h-9 shrink-0 text-sky-700 border-sky-200 hover:bg-sky-50"
                onClick={() =>
                  copiar(
                    linkUnico,
                    'Link copiado!',
                    'O link aberto da campanha foi copiado para a área de transferência.',
                  )
                }
              >
                <Copy className="w-3.5 h-3.5 mr-1" />
                Copiar link
              </Button>
            </div>
          </div>

          {/* Nome para personalização da mensagem */}
          <div className="space-y-1.5">
            <Label htmlFor="pnome-exemplo" className="text-xs text-slate-600">
              Nome para personalizar a mensagem (opcional)
            </Label>
            <Input
              id="pnome-exemplo"
              placeholder="Ex.: Maria — substitui {{pnome}} na mensagem"
              value={pnomeExemplo}
              onChange={(e) => setPnomeExemplo(e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          {/* Mensagem pronta */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-700">
                Mensagem pronta (link embutido)
              </Label>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs text-sky-700 border-sky-200 hover:bg-sky-50"
                onClick={() =>
                  copiar(
                    mensagemPronta,
                    'Mensagem copiada!',
                    'Cole no WhatsApp, Teams ou outro canal para divulgar a pesquisa.',
                  )
                }
              >
                <MessageSquareText className="w-3.5 h-3.5 mr-1" />
                Copiar mensagem pronta
              </Button>
            </div>
            <pre className="whitespace-pre-wrap text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-700 max-h-52 overflow-y-auto font-sans">
              {mensagemPronta}
            </pre>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-sky-50 border border-sky-100 p-3">
            <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-sky-800">
              O texto vem do campo <strong>texto do e-mail de convite</strong> da campanha, com{' '}
              <code className="bg-white px-1 rounded">{'{{pnome}}'}</code> e{' '}
              <code className="bg-white px-1 rounded">{'{{link}}'}</code> substituídos. O assunto do
              convite por e-mail seria: <em>{assuntoConvite(campaign, false)}</em>.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
