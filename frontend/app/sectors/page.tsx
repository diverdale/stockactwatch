import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import type { SectorOverviewResponse } from '@/lib/types'

export const revalidate = 600
export const dynamic = 'force-static'

export function generateMetadata() {
  return {
    title: 'Sector Activity | Congressional Stock Tracker',
    description: 'Congressional trading activity grouped by market sector — see which sectors are being bought or sold.',
    alternates: {
      canonical: '/sectors',
    },
  }
}

export default async function SectorsPage() {
  const data = await apiFetch<SectorOverviewResponse>('/sectors', {
    tags: ['sectors-overview'],
    revalidate: 600,
  })

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">Sector Activity</h1>
      <p className="text-muted-foreground mb-8">
        Congressional trading activity grouped by market sector. Click any sector to explore top stocks and politicians.
      </p>
      {data.sectors.length === 0 ? (
        <p className="text-muted-foreground">No sector data available yet. Data enriches as trades are ingested.</p>
      ) : (
        <div className="space-y-3">
          {data.sectors.map((sector) => {
            const total = sector.buy_count + sector.sell_count
            const buyPct = total > 0 ? Math.round((sector.buy_count / total) * 100) : 50
            const sellPct = 100 - buyPct
            const sentimentColor =
              sector.sentiment === 'bullish'
                ? 'bg-emerald-100 text-emerald-800'
                : sector.sentiment === 'bearish'
                ? 'bg-red-100 text-red-800'
                : 'bg-yellow-100 text-yellow-800'

            return (
              <Link
                key={sector.sector_slug}
                href={`/sectors/${sector.sector_slug}`}
                className="block rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-lg">{sector.sector}</span>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${sentimentColor}`}
                    >
                      {sector.sentiment}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {sector.total_trades.toLocaleString()} trades
                    </span>
                  </div>
                </div>
                <div className="flex h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-400 flex-none"
                    style={{ width: `${buyPct}%` }}
                    title={`${sector.buy_count} buys`}
                  />
                  <div
                    className="bg-red-400 flex-none"
                    style={{ width: `${sellPct}%` }}
                    title={`${sector.sell_count} sells`}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{sector.buy_count} buys</span>
                  <span>{sector.sell_count} sells</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
