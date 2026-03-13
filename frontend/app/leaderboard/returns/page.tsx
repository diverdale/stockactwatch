// app/leaderboard/returns/page.tsx
import type { Metadata } from 'next'
import type { SearchParams } from 'nuqs/server'
import { createLoader } from 'nuqs/server'
import { Disclaimer } from '@/components/disclaimer'
import { ReturnsLeaderboardTable } from '@/components/returns-leaderboard-table'
import { apiFetch } from '@/lib/api'
import type { LeaderboardResponse } from '@/lib/types'
import { leaderboardParams } from '@/lib/search-params'

export const revalidate = 300

const loadLeaderboardParams = createLoader(leaderboardParams)

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}): Promise<Metadata> {
  const { chamber, party } = await loadLeaderboardParams(searchParams)
  const qs = new URLSearchParams()
  if (chamber) qs.set('chamber', chamber)
  if (party) qs.set('party', party)
  const canonical = `/leaderboard/returns${qs.size ? '?' + qs.toString() : ''}`
  return {
    title: 'Returns Leaderboard — Congress Trades',
    description: 'Estimated returns for Congress members based on public STOCK Act disclosures.',
    alternates: { canonical },
  }
}

export default async function ReturnsLeaderboardPage() {
  const data = await apiFetch<LeaderboardResponse>('/leaderboard/returns', {
    tags: ['leaderboard-returns'],
    revalidate: 300,
  })

  const methodologyLabel =
    data.entries[0]?.methodology_label ?? 'v1 — estimated gain/loss vs. entry price'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Returns Leaderboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Congress members ranked by estimated average return on disclosed trades.
          {data.total} members with calculable returns.
        </p>
      </div>
      <Disclaimer />
      <ReturnsLeaderboardTable
        entries={data.entries}
        methodologyLabel={methodologyLabel}
      />
    </div>
  )
}
