'use client'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { PoliticianSectorEntry } from '@/lib/types'

interface Props {
  sectors: PoliticianSectorEntry[]
}

export function PoliticianSectorRadar({ sectors }: Props) {
  if (sectors.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No sector data available for this politician.</p>
    )
  }

  // Recharts RadarChart expects { subject, value } shape
  const data = sectors.map((s) => ({
    subject: s.sector,
    trades: s.trade_count,
  }))

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="rgba(255,255,255,0.08)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 'auto']}
            tick={{ fontSize: 9, fill: '#64748b' }}
            tickCount={4}
            axisLine={false}
          />
          <Radar
            name="Trades"
            dataKey="trades"
            stroke="#f59e0b"
            fill="#f59e0b"
            fillOpacity={0.18}
            strokeWidth={2}
          />
          <Tooltip
            formatter={(value: number) => [value, 'Trades']}
            contentStyle={{
              background: '#1e293b',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#f1f5f9',
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
