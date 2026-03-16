import { auth } from '@clerk/nextjs/server'
import { apiFetch } from '@/lib/api'
import type { ConflictsResponse, ConflictsSummaryResponse, ConflictHearingsResponse } from '@/lib/types'
import { ConflictsDashboard } from '@/components/conflicts-dashboard'
import { PaywallGate } from '@/components/paywall-gate'

export const revalidate = 600

export async function generateMetadata() {
  return {
    title: 'Committee Conflicts',
    description:
      'Congressional trades where members sit on oversight committees for the sector they traded — with hearing timeline analysis.',
    alternates: { canonical: '/conflicts' },
  }
}

export default async function ConflictsPage() {
  const { userId } = await auth()
  const isSignedIn = !!userId

  const [trades, summary, hearings] = await Promise.all([
    apiFetch<ConflictsResponse>('/conflicts', { tags: ['conflicts'], revalidate: 600 }),
    apiFetch<ConflictsSummaryResponse>('/conflicts/summary', { tags: ['conflicts-summary'], revalidate: 600 }),
    apiFetch<ConflictHearingsResponse>('/conflicts/hearings', { tags: ['conflicts-hearings'], revalidate: 3600 })
      .catch(() => ({ hearings: [], total: 0, cached: false } as ConflictHearingsResponse)),
  ])

  const content = <ConflictsDashboard trades={trades} summary={summary} hearings={hearings} />

  if (!isSignedIn) {
    return (
      <PaywallGate locked size="page" message="Sign in to see trades made by members sitting on oversight committees">
        {content}
      </PaywallGate>
    )
  }

  return content
}
