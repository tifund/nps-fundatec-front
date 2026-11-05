// Evolução do NPS por semana ou mês (gráfico de linha). NPS por bucket =
// %promotores − %detratores dentro do bucket; só renderiza com ≥ 2 buckets
// com respostas (dados suficientes).
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'

export interface PontoEvolucao {
  rotulo: string
  nps: number
  respostas: number
}

export function GraficoEvolucao({ pontos }: { pontos: PontoEvolucao[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pontos} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="rotulo"
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
          />
          <YAxis
            domain={[-100, 100]}
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(v: number | string, _n, p) => [
              `NPS ${v} (${(p?.payload as PontoEvolucao)?.respostas ?? 0} resposta(s))`,
              'NPS',
            ]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
          <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="nps"
            stroke="#0284c7"
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: '#0284c7' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
