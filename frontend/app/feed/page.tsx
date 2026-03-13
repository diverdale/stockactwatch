// app/feed/page.tsx
import type { Metadata } from 'next'
import { FeedTable } from '@/components/feed-table'
import { FeedFilters } from '@/components/feed-filters'
import { apiFetch } from '@/lib/api'
import type { FeedResponse } from '@/lib/types'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Activity Feed — Congress Trades',
  description: 'Recent congressional stock trade disclosures from public STOCK Act filings.',
  alternates: { canonical: '/feed' },
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ chamber?: string; party?: string; limit?: string; offset?: string }>
}) {
  const params = await searchParams
  const qs = new URLSearchParams()
  if (params.chamber) qs.set('chamber', params.chamber)
  if (params.party) qs.set('party', params.party)
  qs.set('limit', params.limit ?? '50')
  if (params.offset) qs.set('offset', params.offset)

  const data = await apiFetch<FeedResponse>(
    `/feed${qs.toString() ? '?' + qs.toString() : ''}`,
    { tags: ['feed'], revalidate: 300 }
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Activity Feed</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Most recent congressional trade disclosures under the STOCK Act.
          Showing {data.entries.length} of {data.total} total trades.
        </p>
      </div>
      <FeedFilters />
      <FeedTable entries={data.entries} />
    </div>
  )
}
