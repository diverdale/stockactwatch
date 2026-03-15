import { apiFetch } from '@/lib/api'
import type { ConflictsResponse, ConflictsSummaryResponse, ConflictHearingsResponse } from '@/lib/types'
import { ConflictsDashboard } from '@/components/conflicts-dashboard'

export const revalidate = 600

export async function generateMetadata() {
  return {
    title: 'Committee Conflicts | Congressional Stock Tracker',
    description:
      'Trades where members sit on oversight committees for the sector they traded — with hearing timeline analysis',
    alternates: { canonical: '/conflicts' },
  }
}

export default async function ConflictsPage() {
  const [trades, summary, hearings] = await Promise.all([
    apiFetch<ConflictsResponse>('/conflicts', { tags: ['conflicts'], revalidate: 600 }),
    apiFetch<ConflictsSummaryResponse>('/conflicts/summary', {
      tags: ['conflicts-summary'],
      revalidate: 600,
    }),
    apiFetch<ConflictHearingsResponse>('/conflicts/hearings', {
      tags: ['conflicts-hearings'],
      revalidate: 3600,
    }).catch(() => ({ hearings: [], total: 0, cached: false } as ConflictHearingsResponse)),
  ])

  return <ConflictsDashboard trades={trades} summary={summary} hearings={hearings} />
}
