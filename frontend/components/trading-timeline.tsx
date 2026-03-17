'use client'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import type { ChartConfig } from '@/components/ui/chart'

export interface TimelineDataPoint {
  month: string   // e.g. "2024-03"
  trades: number
}

interface TradingTimelineProps {
  data: TimelineDataPoint[]
  ticker: string
}

const chartConfig: ChartConfig = {
  trades: {
    label: 'Trades',
    color: 'var(--color-chart-1)',
  },
}

export function TradingTimeline({ data, ticker }: TradingTimelineProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        No historical trade data to chart.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Congressional trading activity in {ticker} by month
      </h3>
      <ChartContainer config={chartConfig} className="min-h-[180px] w-full">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.3} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            allowDecimals={false}
            width={28}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area
            type="monotone"
            dataKey="trades"
            fill="var(--color-trades)"
            stroke="var(--color-trades)"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  )
}
