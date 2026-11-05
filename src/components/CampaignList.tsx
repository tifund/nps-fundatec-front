import { Campaign, Area, CampaignStats } from '@/types/nps'
import { Calendar, Copy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface Props {
  campaigns: Campaign[]
  areas: Area[]
  stats: Record<string, CampaignStats>
  canManage: boolean
  onEdit: (c: Campaign) => void
  onClose: (c: Campaign) => void
  onDelete: (c: Campaign) => void
  onCopyLink: (c: Campaign) => void
  onViewQuestions: (c: Campaign) => void
}

function statusBadge(c: Campaign, expired: boolean) {
  if (expired) {
    return (
      <Badge
        variant="outline"
        className="bg-amber-50 text-amber-700 border-amber-200 text-xs font-medium"
      >
        Expirada
      </Badge>
    )
  }
  if (c.status === 'ativa') {
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 text-xs font-medium">
        Ativa
      </Badge>
    )
  }
  if (c.status === 'encerrada') {
    return (
      <Badge
        variant="outline"
        className="bg-rose-50 text-rose-700 border-rose-200 text-xs font-medium"
      >
        Encerrada
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="bg-slate-50 text-slate-600 border-slate-200 text-xs font-medium"
    >
      Rascunho
    </Badge>
  )
}

export default function CampaignList({
  campaigns,
  areas,
  stats,
  canManage,
  onEdit,
  onClose,
  onDelete,
  onCopyLink,
  onViewQuestions,
}: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="text-xs font-semibold text-slate-600">Nome</TableHead>
          <TableHead className="text-xs font-semibold text-slate-600">Área</TableHead>
          <TableHead className="text-xs font-semibold text-slate-600">Modo</TableHead>
          <TableHead className="text-xs font-semibold text-slate-600">Vigência</TableHead>
          <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
          <TableHead className="text-xs font-semibold text-slate-600">
            Respondidos / Convocados
          </TableHead>
          <TableHead className="text-xs font-semibold text-slate-600">NPS atual</TableHead>
          <TableHead className="text-xs font-semibold text-slate-600 text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {campaigns.map((camp) => {
          const areaNome = areas.find((a) => a.id === camp.area_id)?.nome || 'Área não identificada'
          const expired = !!camp.vigencia_fim && new Date(camp.vigencia_fim) < new Date()
          const s = stats[camp.id] || { respondidos: 0, convocados: 0, respostas: 0, nps: null }
          const temRespostas = s.respostas > 0

          return (
            <TableRow key={camp.id} className="hover:bg-slate-50/70">
              <TableCell>
                <div className="font-semibold text-slate-800 text-sm">{camp.nome}</div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">slug: {camp.slug}</div>
              </TableCell>
              <TableCell className="text-xs font-medium text-slate-700">{areaNome}</TableCell>
              <TableCell>
                {camp.modo_acesso === 'convites' ? (
                  <Badge
                    variant="outline"
                    className="text-[11px] bg-slate-50 border-slate-200 text-slate-600"
                  >
                    Convites individuais
                  </Badge>
                ) : (
                  <Badge className="text-[11px] bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-50">
                    Link aberto
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-xs text-slate-500">
                {camp.vigencia_tipo === 'prazo' && camp.vigencia_fim ? (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {new Date(camp.vigencia_fim).toLocaleDateString('pt-BR')}
                  </div>
                ) : (
                  <span className="text-slate-400">Contínua</span>
                )}
              </TableCell>
              <TableCell>{statusBadge(camp, expired)}</TableCell>
              <TableCell className="text-xs text-slate-600">
                {camp.modo_acesso === 'link_aberto' ? (
                  <span className="text-slate-400">— (link aberto)</span>
                ) : (
                  <>
                    {s.respondidos}/{s.convocados}
                  </>
                )}
                {s.respostas > 0 && (
                  <span className="text-slate-400 ml-1">({s.respostas} respostas)</span>
                )}
              </TableCell>
              <TableCell>
                {s.nps === null ? (
                  <span className="text-xs text-slate-400">Sem respostas</span>
                ) : (
                  <span
                    className={`text-xs font-bold ${
                      s.nps >= 50
                        ? 'text-emerald-600'
                        : s.nps >= 0
                          ? 'text-amber-600'
                          : 'text-rose-600'
                    }`}
                  >
                    {s.nps > 0 ? `+${s.nps}` : s.nps}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right space-x-1">
                {camp.modo_acesso === 'link_aberto' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs text-sky-700 border-sky-200 hover:bg-sky-50"
                    onClick={() => onCopyLink(camp)}
                    title="Copiar link aberto"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copiar link
                  </Button>
                )}
                {canManage && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-slate-600 hover:text-slate-900"
                      onClick={() => onViewQuestions(camp)}
                      title="Perguntas adicionais"
                    >
                      Perguntas
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs text-slate-600 hover:text-sky-700"
                      onClick={() => onEdit(camp)}
                      title="Editar campanha"
                    >
                      Editar
                    </Button>
                    {camp.status !== 'encerrada' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-rose-600 hover:bg-rose-50"
                        onClick={() => onClose(camp)}
                        title="Encerrar campanha"
                      >
                        Encerrar
                      </Button>
                    )}
                    {!temRespostas && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-rose-600 hover:bg-rose-50"
                        onClick={() => onDelete(camp)}
                        title={
                          temRespostas
                            ? 'Campanha com respostas não pode ser excluída'
                            : 'Excluir campanha'
                        }
                      >
                        Excluir
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
  )
}
