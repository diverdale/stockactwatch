import { auth } from '@clerk/nextjs/server'
import { apiFetch } from '@/lib/api'
import type { PoliticianListResponse } from '@/lib/types'
import { PoliticiansList } from '@/components/politicians-list'
import { PaywallGate } from '@/components/paywall-gate'

export const revalidate = 600

export function generateMetadata() {
  return {
    title: 'Members of Congress — Congressional Stock Traders',
    description: 'Every US Congress member who has filed a STOCK Act trade disclosure — browse by name, party, or chamber.',
    alternates: { canonical: '/politicians' },
  }
}

const PREVIEW_COUNT = 8

export default async function PoliticiansPage() {
  const { userId } = await auth()
  const isSignedIn = !!userId

  const data = await apiFetch<PoliticianListResponse>('/politicians', {
    tags: ['politicians-list'],
    revalidate: 600,
  })

  const house = data.politicians.filter(p => p.chamber === 'House').length
  const senate = data.politicians.filter(p => p.chamber === 'Senate').length
  const totalTrades = data.politicians.reduce((sum, p) => sum + p.trade_count, 0)

  const politicians = isSignedIn
    ? data.politicians
    : data.politicians.slice(0, PREVIEW_COUNT)

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Members of Congress</h1>
        <p className="text-muted-foreground mt-1.5">
          All Congress members with STOCK Act trade disclosures. Click any member to see their full trading history.
        </p>
      </div>
      <PoliticiansList
        politicians={politicians}
        stats={{ total: data.total, house, senate, totalTrades }}
      />
      {!isSignedIn && (
        <PaywallGate
          locked
          message={`Sign in to browse all ${data.total} members`}
        />
      )}
    </main>
  )
}
