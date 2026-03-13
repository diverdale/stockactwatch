// app/tickers/[ticker]/page.tsx
import type { Metadata } from 'next'
import { TickerTradesTable } from '@/components/ticker-trades-table'
import { TradingTimeline, type TimelineDataPoint } from '@/components/trading-timeline'
import { Disclaimer } from '@/components/disclaimer'
import { apiFetch } from '@/lib/api'
import type { TickerTrades } from '@/lib/types'

export const revalidate = 3600

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>
}): Promise<Metadata> {
  const { ticker } = await params
  return {
    title: `${ticker.toUpperCase()} — Congress Trades`,
    alternates: { canonical: `/tickers/${ticker.toUpperCase()}` },
  }
}

function buildMonthlyData(trades: TickerTrades['trades']): TimelineDataPoint[] {
  const counts: Record<string, number> = {}
  for (const trade of trades) {
    const month = trade.trade_date.substring(0, 7) // "YYYY-MM"
    counts[month] = (counts[month] ?? 0) + 1
  }
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, trades]) => ({ month, trades }))
}

export default async function TickerPage({
  params,
}: {
  params: Promise<{ ticker: string }>
}) {
  const { ticker } = await params
  const TICKER = ticker.toUpperCase()

  const data = await apiFetch<TickerTrades>(`/tickers/${TICKER}`, {
    tags: [`ticker-${TICKER}`, 'tickers'],
    revalidate: 3600,
  })

  const monthlyData = buildMonthlyData(data.trades)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-mono">{TICKER}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {data.total_trades} congressional trade{data.total_trades !== 1 ? 's' : ''} disclosed
          under the STOCK Act.
          {data.total_trades === 0 && ' No trades found for this ticker.'}
        </p>
      </div>

      {/* Timeline chart */}
      {monthlyData.length > 0 && (
        <div className="rounded-md border p-4">
          <TradingTimeline data={monthlyData} ticker={TICKER} />
        </div>
      )}

      {/* LEGAL-01: Disclaimer required on every analysis page */}
      <Disclaimer />

      {/* Trades table */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">All Trades</h2>
        <TickerTradesTable trades={data.trades} />
      </div>
    </div>
  )
}
