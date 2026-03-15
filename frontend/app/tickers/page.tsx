import { apiFetch } from '@/lib/api'
import type { TickerListResponse } from '@/lib/types'
import { TickersTable } from '@/components/tickers-table'

export const revalidate = 600

export function generateMetadata() {
  return {
    title: 'Tickers | Congressional Stock Tracker',
    description: 'All stock tickers traded by members of Congress under STOCK Act disclosures.',
    alternates: { canonical: '/tickers' },
  }
}

export default async function TickersPage() {
  const data = await apiFetch<TickerListResponse>('/tickers', {
    tags: ['tickers-list'],
    revalidate: 600,
  })

  return (
    <main className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Tickers</h1>
        <p className="text-muted-foreground mt-1.5">
          All securities traded by members of Congress. Click any ticker to see the full trading history.
        </p>
      </div>
      <TickersTable data={data} />
    </main>
  )
}
