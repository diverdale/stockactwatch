import type { Metadata } from 'next'
import { Disclaimer } from '@/components/disclaimer'
import { LeaderboardTable } from '@/components/leaderboard-table'
import { apiFetch } from '@/lib/api'
import type { LeaderboardResponse, VolumeLeaderboardResponse } from '@/lib/types'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Congressional Trading Leaderboard',
  description: 'Congress members ranked by estimated returns and total trading volume from public STOCK Act disclosures.',
  alternates: { canonical: '/leaderboard' },
}

export default async function LeaderboardPage() {
  const [returnsData, volumeData] = await Promise.all([
    apiFetch<LeaderboardResponse>('/leaderboard/returns', {
      tags: ['leaderboard-returns'],
      revalidate: 300,
    }),
    apiFetch<VolumeLeaderboardResponse>('/leaderboard/volume', {
      tags: ['leaderboard-volume'],
      revalidate: 300,
    }),
  ])

  const methodologyLabel =
    returnsData.entries[0]?.methodology_label ?? 'estimated gain/loss vs. entry price'

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Congress members ranked by estimated returns or trading activity.
          </p>
        </div>
        <span className="text-sm text-muted-foreground tabular-nums shrink-0">
          {volumeData.total} members
        </span>
      </div>
      <Disclaimer />
      <LeaderboardTable
        returns={returnsData.entries}
        volume={volumeData.entries}
        methodologyLabel={methodologyLabel}
      />
    </div>
  )
}
