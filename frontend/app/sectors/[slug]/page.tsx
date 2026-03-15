import { notFound } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import type { SectorDetailResponse, IndustryBreakdownResponse } from '@/lib/types'
import { SectorTrendChart } from './sector-trend-chart'
import { SectorIndustryBreakdown } from '@/components/sector-industry-breakdown'
import { SectorCsvExport } from '@/components/sector-csv-export'

export const revalidate = 600

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const name = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return {
    title: `${name} Sector — Congressional Trading`,
    description: `Congressional stock trades in the ${name} sector — buy/sell activity, top traders, and committee overlap analysis.`,
    alternates: { canonical: `/sectors/${slug}` },
  }
}

export default async function SectorDetailPage({ params }: Props) {
  const { slug } = await params
  let data: SectorDetailResponse
  try {
    data = await apiFetch<SectorDetailResponse>(`/sectors/${slug}`, {
      tags: [`sector-${slug}`, 'sectors'],
      revalidate: 600,
    })
  } catch {
    notFound()
  }

  let industriesData: IndustryBreakdownResponse | null = null
  try {
    industriesData = await apiFetch<IndustryBreakdownResponse>(`/sectors/${slug}/industries`, {
      tags: [`sector-industries-${slug}`],
      revalidate: 600,
    })
  } catch {
    // industries endpoint optional — page renders without it
  }

  const sentimentColor =
    data.sentiment === 'bullish'
      ? 'bg-emerald-100 text-emerald-800'
      : data.sentiment === 'bearish'
      ? 'bg-red-100 text-red-800'
      : 'bg-yellow-100 text-yellow-800'

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Link href="/sectors" className="text-sm text-muted-foreground hover:underline mb-2 block">
          &larr; All Sectors
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{data.sector}</h1>
          <span className={`text-sm font-medium px-2 py-1 rounded-full ${sentimentColor}`}>
            {data.sentiment}
          </span>
        </div>
        <div className="flex gap-6 mt-3 text-sm text-muted-foreground">
          <span>{data.total_trades.toLocaleString()} total trades</span>
          <span className="text-emerald-600">{data.buy_count} buys</span>
          <span className="text-red-500">{data.sell_count} sells</span>
        </div>
        <div className="mt-3">
          <SectorCsvExport slug={slug} />
        </div>
      </div>

      {/* Trend Chart */}
      {data.trend.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Trading Activity Over Time</h2>
          <SectorTrendChart trend={data.trend} />
        </section>
      )}

      {/* Industry Breakdown */}
      {industriesData && industriesData.industries.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Industry Breakdown</h2>
          <SectorIndustryBreakdown industries={industriesData.industries} />
        </section>
      )}

      {/* Top Tickers */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">Top Tickers</h2>
        <div className="space-y-2">
          {data.top_tickers.map((t) => (
            <Link
              key={t.ticker}
              href={`/tickers/${t.ticker}`}
              className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 hover:bg-accent transition-colors"
            >
              <div>
                <span className="font-mono font-semibold">{t.ticker}</span>
                {t.company_name && (
                  <span className="text-sm text-muted-foreground ml-2">{t.company_name}</span>
                )}
              </div>
              <div className="text-sm text-muted-foreground flex gap-4">
                <span className="text-emerald-600">{t.buy_count}B</span>
                <span className="text-red-500">{t.sell_count}S</span>
                <span>{t.total_trades} trades</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Top Politicians */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">Most Active Politicians</h2>
        <div className="space-y-2">
          {data.top_politicians.map((p) => (
            <Link
              key={p.politician_id}
              href={`/politicians/${p.politician_id}`}
              className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 hover:bg-accent transition-colors"
            >
              <div>
                <span className="font-semibold">{p.full_name}</span>
                {(p.party || p.chamber) && (
                  <span className="text-sm text-muted-foreground ml-2">
                    {[p.chamber, p.party].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
              <span className="text-sm text-muted-foreground">{p.trade_count} trades</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
