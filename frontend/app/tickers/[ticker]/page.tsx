// app/tickers/[ticker]/page.tsx
import type { Metadata } from 'next'
import { TickerDashboard } from '@/components/ticker-dashboard'
import { apiFetch } from '@/lib/api'
import type { TickerTrades } from '@/lib/types'

export const revalidate = 3600

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>
}): Promise<Metadata> {
  const { ticker } = await params
  const TICKER = ticker.toUpperCase()
  return {
    title: `${TICKER} — Congressional Trading Activity`,
    description: `See every congressional trade in ${TICKER} — who bought, who sold, amounts, dates, and suspicion scores from STOCK Act disclosures.`,
    alternates: { canonical: `/tickers/${TICKER}` },
    openGraph: {
      title: `${TICKER} Congressional Trades`,
      description: `Full congressional trading history for ${TICKER} from public STOCK Act filings.`,
    },
  }
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

  return (
    <TickerDashboard
      ticker={TICKER}
      companyName={data.company_name}
      sector={data.sector ?? null}
      sectorSlug={data.sector_slug ?? null}
      allTrades={data.trades}
    />
  )
}
