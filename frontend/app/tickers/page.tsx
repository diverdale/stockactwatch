import { auth } from '@clerk/nextjs/server'
import { apiFetch } from '@/lib/api'
import type { TickerListResponse } from '@/lib/types'
import { TickersTable } from '@/components/tickers-table'
import { PaywallGate } from '@/components/paywall-gate'

export const revalidate = 600

export function generateMetadata() {
  return {
    title: 'Stocks Traded by Congress',
    description: 'Every stock ticker bought or sold by US Congress members under STOCK Act disclosure requirements.',
    alternates: { canonical: '/tickers' },
  }
}

const PREVIEW_COUNT = 8

export default async function TickersPage() {
  const { userId } = await auth()
  const isSignedIn = !!userId

  const data = await apiFetch<TickerListResponse>('/tickers', {
    tags: ['tickers-list'],
    revalidate: 600,
  })

  const previewData = isSignedIn
    ? data
    : { ...data, tickers: data.tickers.slice(0, PREVIEW_COUNT) }

  return (
    <main className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Tickers</h1>
        <p className="text-muted-foreground mt-1.5">
          All securities traded by members of Congress. Click any ticker to see the full trading history.
        </p>
      </div>
      <TickersTable data={previewData} />
      {!isSignedIn && (
        <PaywallGate
          locked
          message={`Sign in to browse all ${data.tickers.length} tickers`}
        />
      )}
    </main>
  )
}
