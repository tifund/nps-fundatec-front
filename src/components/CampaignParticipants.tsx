// Seção "Participantes" de uma campanha em modo convites individuais.
// Tabela com nome, e-mail, situação (aguardando resposta / já respondeu), data do
// último envio e ações (copiar link pessoal, reenviar convite). Botões de escrita
// aparecem apenas para ADMIN/GESTOR.
import { useMemo, useState } from 'react'
import { Participant } from '@/types/nps'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Loader2,
  Copy,
  Send,
  CheckCircle2,
  Clock,
  Search,
  Users,
  Upload,
  ShieldAlert,
  Inbox,
} from 'lucide-react'
import ImportParticipantsDialog from '@/components/ImportParticipantsDialog'
import { fmtData } from '@/lib/importacao/formato'
import { usePermissions } from '@/hooks/use-permissions'

interface Props {
  campaignId: string
  campaignNome: string
  participantes: Participant[]
  ultimoEnvio: Record<string, string>
  loading: boolean
  sendingId: string | null
  onImportado: () => void
  onCopiarLink: (p: Participant) => void
  onReenviar: (p: Participant) => void
}

export default function CampaignParticipants({
  campaignId,
  campaignNome,
  participantes,
  ultimoEnvio,
  loading,
  sendingId,
  onImportado,
  onCopiarLink,
  onReenviar,
}: Props) {
  const { canManageParticipants, canSendInvites, isLeitura } = usePermissions()
  const [busca, setBusca] = useState('')
  const [importOpen, setImportOpen] = useState(false)

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase()
    if (!t) return participantes
    return participantes.filter(
      (p) => p.nome.toLowerCase().includes(t) || p.email.toLowerCase().includes(t),
    )
  }, [participantes, busca])

  const respondidos = participantes.filter((p) => p.respondido).length
  const pct = participantes.length > 0 ? Math.round((respondidos / participantes.length) * 100) : 0

  return (
    <Card className="border-slate-200 shadow-sm bg-white">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-sky-600" />
              <CardTitle className="text-base font-semibold text-slate-800">
                Participantes da Campanha ({participantes.length})
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              Cada participante tem um link individual com o hash do token — copie para reenviar por
              WhatsApp ou outro canal quando o e-mail não chegar.
            </CardDescription>
          </div>
          {canManageParticipants && (
            <Button
              size="sm"
              onClick={() => setImportOpen(true)}
              className="bg-sky-600 hover:bg-sky-700 text-xs"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Importar CSV/XLSX
            </Button>
          )}
        </div>

        {/* resumo + busca */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-3">
          <div className="flex-1 max-w-xs">
            <div className="flex justify-between text-[11px] text-slate-500 mb-1">
              <span>Respondidos</span>
              <span className="font-semibold text-slate-700">
                {respondidos}/{participantes.length}
              </span>
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>
          <div className="relative sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou e-mail..."
              className="h-8 text-xs pl-8 bg-white"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-sky-600 mb-2" />
            <p className="text-xs">Carregando participantes...</p>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="py-12 text-center text-sm">
            <Inbox className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-slate-500">
              {participantes.length === 0
                ? 'Nenhum participante nesta campanha.'
                : 'Nenhum participante encontrado para a busca.'}
            </p>
            {participantes.length === 0 && canManageParticipants && (
              <p className="text-xs text-slate-400 mt-1">
                Use &quot;Importar CSV/XLSX&quot; para cadastrar a lista de convidados.
              </p>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-semibold text-slate-600">Participante</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Situação</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Último envio</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 text-right">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((p) => {
                const isSending = sendingId === p.id
                const envio = ultimoEnvio[p.id]
                return (
                  <TableRow key={p.id} className="hover:bg-slate-50/70">
                    <TableCell>
                      <div className="font-semibold text-slate-800 text-sm">{p.nome}</div>
                      <div className="text-xs text-slate-500">{p.email}</div>
                    </TableCell>
                    <TableCell>
                      {p.respondido ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 text-xs gap-1 font-medium">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Já respondeu
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-amber-50 text-amber-700 border-amber-200 text-xs gap-1 font-medium"
                        >
                          <Clock className="w-3 h-3 text-amber-600" />
                          Aguardando resposta
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {envio ? (
                        fmtData(envio)
                      ) : (
                        <span className="text-slate-400">Nunca enviado</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {canManageParticipants && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs text-slate-700 hover:text-sky-700"
                          onClick={() => onCopiarLink(p)}
                          title={`Copiar link de avaliação (${p.token})`}
                        >
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          Copiar link
                        </Button>
                      )}
                      {canSendInvites && !p.respondido && (
                        <Button
                          variant="default"
                          size="sm"
                          className="h-8 text-xs bg-sky-600 hover:bg-sky-700"
                          disabled={isSending}
                          onClick={() => onReenviar(p)}
                        >
                          {isSending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                          ) : (
                            <Send className="w-3.5 h-3.5 mr-1" />
                          )}
                          Reenviar convite
                        </Button>
                      )}
                      {!canManageParticipants && (
                        <span className="text-[11px] text-slate-400 italic px-2 inline-flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3 text-slate-400" />
                          {isLeitura ? 'somente leitura' : '—'}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* diálogo de importação — montado aqui, dentro da seção da campanha */}
      {canManageParticipants && (
        <ImportParticipantsDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          campaignId={campaignId}
          campaignNome={campaignNome}
          onImportado={onImportado}
        />
      )}
    </Card>
  )
}
