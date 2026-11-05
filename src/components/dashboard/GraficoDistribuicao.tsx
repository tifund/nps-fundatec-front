// Gráfico de barras 0–10 com faixas destacadas: detratores (0–6) em rose,
// neutros (7–8) em amber, promotores (9–10) em emerald. Leve: recharts.
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'
import { corFaixa, faixaDaNota } from '@/lib/nps/calculos'

export function GraficoDistribuicao({
  counts,
}: {
  counts: number[] // índice 0..10
}) {
  const dados = counts.map((qtd, nota) => ({
    nota: String(nota),
    respostas: qtd,
    cor: corFaixa[faixaDaNota(nota)],
  }))

  return (
    <div className="h-56 w-full">
      {/* Legenda própria (o Legend do recharts 3 não aceita payload tipado) */}
      <div className="flex justify-center gap-4 text-[11px] text-slate-500 pb-1">
        {(
          [
            ['Detrator (0–6)', corFaixa.detrator],
            ['Neutro (7–8)', corFaixa.neutro],
            ['Promotor (9–10)', corFaixa.promotor],
          ] as const
        ).map(([rotulo, cor]) => (
          <span key={rotulo} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: cor }} />
            {rotulo}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="nota"
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(v: number | string) => [`${v} resposta(s)`, 'Notas']}
            labelFormatter={(l) => `Nota ${l}`}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
          />

          <Bar dataKey="respostas" radius={[3, 3, 0, 0]} maxBarSize={38}>
            {dados.map((d) => (
              <Cell key={d.nota} fill={d.cor} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
