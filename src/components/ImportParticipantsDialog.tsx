// Diálogo de importação de participantes por arquivo (CSV/XLSX) com barra de progresso
// e relatório final com o motivo de cada linha ignorada.
import React, { useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import {
  Upload,
  Loader2,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react'
import { useImportacaoCsv, ResultadoImportacao, LinhaIgnorada } from '@/hooks/use-importacao-csv'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  campaignId: string
  campaignNome: string
  onImportado: () => void
}

export default function ImportParticipantsDialog({
  open,
  onOpenChange,
  campaignId,
  campaignNome,
  onImportado,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null)
  const [erro, setErro] = useState('')
  const { progresso, importarArquivo } = useImportacaoCsv(campaignId)
  const emAndamento = progresso.fase === 'lendo' || progresso.fase === 'importando'

  const reset = () => {
    setFileName('')
    setResultado(null)
    setErro('')
  }

  const handleClose = (o: boolean) => {
    if (emAndamento) return // não fecha no meio da importação
    if (!o) reset()
    onOpenChange(o)
  }

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResultado(null)
    setErro('')
    try {
      const res = await importarArquivo(file)
      setResultado(res)
      onImportado()
    } catch (err: unknown) {
      setErro((err as Error)?.message || 'Falha ao ler o arquivo.')
    }
  }

  const pct =
    progresso.total > 0
      ? Math.round((progresso.lidas / progresso.total) * 100)
      : emAndamento
        ? 5
        : 0

  const contagem = (detalhes: LinhaIgnorada[], chave: string) =>
    detalhes.filter((d) => d.motivo.startsWith(chave)).length

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-sky-600" />
            Importar Participantes (CSV / XLSX)
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Campanha de destino:{' '}
            <strong className="text-slate-700">{campaignNome || 'selecione acima'}</strong>. O
            arquivo deve conter as colunas <code>NOME</code> e <code>EMAIL</code> (aceita{' '}
            <code>email</code>, <code>e-mail</code>, qualquer caixa). E-mails duplicados na campanha
            e linhas inválidas são ignorados e reportados ao final.
          </DialogDescription>
        </DialogHeader>

        <div className="py-3 space-y-4">
          {/* seleção de arquivo */}
          <div className="space-y-1.5">
            <Label htmlFor="import-file" className="text-xs font-medium text-slate-700">
              Arquivo (.csv ou .xlsx) *
            </Label>
            <Input
              id="import-file"
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.tsv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={!campaignId || emAndamento}
              onChange={handlePick}
              className="text-xs"
            />
            {!campaignId && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                Selecione uma campanha no filtro acima antes de importar.
              </p>
            )}
            {fileName && !emAndamento && (
              <p className="text-[11px] text-slate-500">
                Arquivo: <strong>{fileName}</strong>
              </p>
            )}
          </div>

          {/* progresso */}
          {emAndamento && (
            <div className="space-y-2 rounded-lg border border-sky-100 bg-sky-50/60 p-3">
              <div className="flex items-center justify-between text-xs text-sky-900 font-medium">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {progresso.fase === 'lendo' ? 'Lendo arquivo...' : 'Importando participantes...'}
                </span>
                <span>
                  {progresso.lidas}/{progresso.total || '?'} linhas
                </span>
              </div>
              <Progress value={pct} className="h-2" />
              <p className="text-[11px] text-sky-800/80">
                {progresso.importados} importado(s), {progresso.ignorados} ignorado(s) até agora.
              </p>
            </div>
          )}

          {/* erro de leitura */}
          {erro && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}

          {/* resultado */}
          {resultado && (
            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm">
                <div className="flex items-center gap-2 font-semibold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4" />
                  {resultado.importados} importado(s), {resultado.ignorados} ignorado(s)
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                  {resultado.duplicadosArquivo > 0 && (
                    <Badge
                      variant="outline"
                      className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]"
                    >
                      {resultado.duplicadosArquivo} duplicado(s) no arquivo
                    </Badge>
                  )}
                  {resultado.duplicadosCampanha > 0 && (
                    <Badge
                      variant="outline"
                      className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]"
                    >
                      {resultado.duplicadosCampanha} já cadastrado(s) na campanha
                    </Badge>
                  )}
                  {resultado.erros > 0 && (
                    <Badge
                      variant="outline"
                      className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]"
                    >
                      {resultado.erros} erro(s) de gravação
                    </Badge>
                  )}
                </div>
              </div>

              {resultado.detalhes.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    Linhas ignoradas ({resultado.detalhes.length})
                  </p>
                  <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                    {resultado.detalhes.map((d, i) => (
                      <div
                        key={i}
                        className="px-3 py-1.5 text-[11px] flex items-start gap-2 bg-white"
                      >
                        <span className="font-mono text-slate-400 shrink-0">L{d.linha}</span>
                        <span className="text-slate-600 truncate flex-1">
                          {d.nome || d.email ? `${d.nome} ${d.email}`.trim() : '—'}
                        </span>
                        <span className="text-slate-500 shrink-0">{d.motivo}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {contagem(resultado.detalhes, 'e-mail inválido')} com e-mail inválido ·{' '}
                    {contagem(resultado.detalhes, 'e-mail duplicado')} duplicado(s) no arquivo ·{' '}
                    {contagem(resultado.detalhes, 'já cadastrado')} já cadastrado(s)
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={emAndamento}>
            {emAndamento ? 'Importando...' : 'Fechar'}
          </Button>
          <Button
            variant="outline"
            className="text-sky-700 border-sky-200 hover:bg-sky-50"
            disabled={emAndamento || !campaignId}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            {resultado ? 'Importar outro arquivo' : 'Escolher arquivo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
