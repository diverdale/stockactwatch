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
    <div className="rounded-lg border bg-card p-4">
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="rgba(128,128,128,0.2)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 'auto']}
            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
            tickCount={4}
          />
          <Radar
            name="Trades"
            dataKey="trades"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.25}
          />
          <Tooltip
            formatter={(value: number) => [value, 'Trades']}
            contentStyle={{
              background: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              fontSize: '12px',
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
