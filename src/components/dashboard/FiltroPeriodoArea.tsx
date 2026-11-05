// Seletor de período do dashboard (datas de/ate) + filtro por área.
// Usado pela Visão Geral e pelo Dashboard da Campanha — o período afeta TODOS os números.
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { CalendarDays, RotateCcw } from 'lucide-react'
import {
  isoHoje,
  isoNDiasAtras,
  PERIODO_PADRAO_DIAS,
  type PeriodoFiltro,
} from '@/services/dashboard'
import type { Area } from '@/types/nps'

const ATALHOS = [
  { rotulo: '30 dias', dias: 30 },
  { rotulo: '90 dias', dias: PERIODO_PADRAO_DIAS },
  { rotulo: '180 dias', dias: 180 },
  { rotulo: '12 meses', dias: 365 },
]

export function FiltroPeriodoArea({
  periodo,
  onPeriodo,
  areas,
  areaId,
  onArea,
  mostrarArea = true,
}: {
  periodo: PeriodoFiltro
  onPeriodo: (p: PeriodoFiltro) => void
  areas: Area[]
  areaId: string
  onArea: (id: string) => void
  mostrarArea?: boolean
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {mostrarArea ? (
        <div className="space-y-1">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Área de negócio
          </Label>
          <Select value={areaId || 'todas'} onValueChange={(v) => onArea(v === 'todas' ? '' : v)}>
            <SelectTrigger className="w-52 h-9 bg-white text-xs">
              <SelectValue placeholder="Todas as áreas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as áreas</SelectItem>
              {areas.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-1">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5" /> Período
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={periodo.de}
            max={periodo.ate}
            onChange={(e) => onPeriodo({ ...periodo, de: e.target.value })}
            className="h-9 w-36 text-xs bg-white"
            aria-label="Data inicial"
          />
          <span className="text-xs text-slate-400">até</span>
          <Input
            type="date"
            value={periodo.ate}
            min={periodo.de}
            max={isoHoje()}
            onChange={(e) => onPeriodo({ ...periodo, ate: e.target.value })}
            className="h-9 w-36 text-xs bg-white"
            aria-label="Data final"
          />
        </div>
      </div>

      <div className="flex gap-1.5">
        {ATALHOS.map((a) => (
          <Button
            key={a.dias}
            type="button"
            variant="outline"
            size="sm"
            className="h-9 px-2.5 text-[11px]"
            onClick={() => onPeriodo({ de: isoNDiasAtras(a.dias), ate: isoHoje() })}
          >
            {a.rotulo}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 px-2.5 text-[11px] text-slate-500"
          onClick={() => onPeriodo({ de: isoNDiasAtras(PERIODO_PADRAO_DIAS), ate: isoHoje() })}
          title="Restaurar padrão (últimos 90 dias)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}
