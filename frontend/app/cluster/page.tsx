// app/cluster/page.tsx
import type { Metadata } from 'next'
import { apiFetch } from '@/lib/api'
import { PeriodSelector } from './period-selector'
import { ClusterCard } from './cluster-card'
import type { ClusterEntry } from './cluster-card'

export const revalidate = 1800

export const metadata: Metadata = {
  title: 'Cluster Trades — Congress Trades',
  description:
    'Stocks being traded by multiple Congress members simultaneously — a signal for journalists and researchers.',
}

interface ClusterResponse {
  entries: ClusterEntry[]
  window_days: number
  total: number
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ClusterPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  const params = await searchParams
  const days = params.days ?? '30'

  const data = await apiFetch<ClusterResponse>(
    `/cluster?days=${days}&min_members=2`,
    { revalidate: 1800, tags: ['cluster'] }
  )

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cluster Trades</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Stocks being traded by multiple Congress members simultaneously
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-sm text-muted-foreground tabular-nums">
            {data.total} {data.total === 1 ? 'cluster' : 'clusters'}
          </span>
          <PeriodSelector />
        </div>
      </div>

      {/* Grid */}
      {data.entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-20 text-center">
          <p className="text-lg font-medium text-muted-foreground">No clusters found</p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            Try expanding the time window above
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.entries.map((entry) => (
            <ClusterCard key={entry.ticker} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}
