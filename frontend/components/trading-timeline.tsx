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
    color: 'hsl(var(--chart-1))',
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
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">
        Congressional trading activity in {ticker} by month
      </h3>
      <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
            allowDecimals={false}
            width={28}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area
            type="monotone"
            dataKey="trades"
            fill="var(--color-trades)"
            stroke="var(--color-trades)"
            fillOpacity={0.3}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  )
}
