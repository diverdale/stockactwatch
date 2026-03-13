// app/leaderboard/returns/page.tsx
import { Disclaimer } from '@/components/disclaimer'
import { ReturnsLeaderboardTable } from '@/components/returns-leaderboard-table'
import { apiFetch } from '@/lib/api'
import type { LeaderboardResponse } from '@/lib/types'

export const revalidate = 300

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
