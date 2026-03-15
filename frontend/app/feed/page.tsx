// app/feed/page.tsx
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { FeedTable } from '@/components/feed-table'
import { FeedFilters } from '@/components/feed-filters'
import { FeedCsvExport } from '@/components/feed-csv-export'
import { FeedPagination } from '@/components/feed-pagination'
import { apiFetch } from '@/lib/api'
import type { FeedResponse } from '@/lib/types'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Trades — Congress Trades',
  description: 'Recent congressional stock trade disclosures from public STOCK Act filings.',
  alternates: { canonical: '/feed' },
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{
    chamber?: string
    party?: string
    limit?: string
    offset?: string
    sort_by?: string
    sort_dir?: string
  }>
}) {
  const params = await searchParams
  const limit = Math.min(100, Math.max(1, Number(params.limit ?? 50)))
  const offset = Math.max(0, Number(params.offset ?? 0))

  const qs = new URLSearchParams()
  if (params.chamber) qs.set('chamber', params.chamber)
  if (params.party) qs.set('party', params.party)
  if (params.sort_by) qs.set('sort_by', params.sort_by)
  if (params.sort_dir) qs.set('sort_dir', params.sort_dir)
  qs.set('limit', String(limit))
  qs.set('offset', String(offset))

  const data = await apiFetch<FeedResponse>(
    `/feed${qs.toString() ? '?' + qs.toString() : ''}`,
    { tags: ['feed'], revalidate: 300 }
  )

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trades</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Most recent congressional trade disclosures under the STOCK Act.
          </p>
        </div>
        <FeedCsvExport entries={data.entries} />
      </div>
      <FeedFilters />
      <FeedTable entries={data.entries} sortBy={params.sort_by} sortDir={params.sort_dir as 'asc' | 'desc' | undefined} />
      <Suspense>
        <FeedPagination total={data.total} limit={limit} offset={offset} />
      </Suspense>
    </div>
  )
}
