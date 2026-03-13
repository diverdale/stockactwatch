// app/leaderboard/volume/page.tsx
import type { Metadata } from 'next'
import type { SearchParams } from 'nuqs/server'
import { createLoader } from 'nuqs/server'
import { Disclaimer } from '@/components/disclaimer'
import { VolumeLeaderboardTable } from '@/components/volume-leaderboard-table'
import { apiFetch } from '@/lib/api'
import type { VolumeLeaderboardResponse } from '@/lib/types'
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
  const canonical = `/leaderboard/volume${qs.size ? '?' + qs.toString() : ''}`
  return {
    title: 'Volume Leaderboard — Congress Trades',
    description: 'Trade volume rankings for Congress members from public STOCK Act disclosures.',
    alternates: { canonical },
  }
}

export default async function VolumeLeaderboardPage() {
  const data = await apiFetch<VolumeLeaderboardResponse>('/leaderboard/volume', {
    tags: ['leaderboard-volume'],
    revalidate: 300,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Volume Leaderboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Congress members ranked by total number of disclosed trades. {data.total} members total.
        </p>
      </div>
      <Disclaimer />
      <VolumeLeaderboardTable entries={data.entries} />
    </div>
  )
}
