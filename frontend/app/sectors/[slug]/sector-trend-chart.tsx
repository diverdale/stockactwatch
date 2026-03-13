'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { SectorTrendPoint } from '@/lib/types'

interface Props {
  trend: SectorTrendPoint[]
}

export function SectorTrendChart({ trend }: Props) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="rgba(128,128,128,0.15)" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
          />
          <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            formatter={(value: number, name: string) => [
              value,
              name === 'buy_count' ? 'Buys' : 'Sells',
            ]}
          />
          <Legend
            formatter={(value) => (value === 'buy_count' ? 'Buys' : 'Sells')}
          />
          <Bar dataKey="buy_count" name="buy_count" stackId="a" fill="#34d399" />
          <Bar dataKey="sell_count" name="sell_count" stackId="a" fill="#f87171" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
