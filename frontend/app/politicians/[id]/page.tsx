// app/politicians/[id]/page.tsx
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Disclaimer } from '@/components/disclaimer'
import { PoliticianMetrics } from '@/components/politician-metrics'
import { TradeTable } from '@/components/trade-table'
import { apiFetch } from '@/lib/api'
import type { PoliticianProfile } from '@/lib/types'

export const revalidate = 3600

export default async function PoliticianPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let profile: PoliticianProfile
  try {
    profile = await apiFetch<PoliticianProfile>(`/politicians/${id}`, {
      tags: [`politician-${id}`, 'politicians'],
      revalidate: 3600,
    })
  } catch {
    notFound()
  }

  return (
    <div className="space-y-8">
      {/* Profile header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold">{profile.full_name}</h1>
          <Badge variant="outline">{profile.chamber}</Badge>
          <Badge variant="secondary">{profile.party}</Badge>
        </div>
        <p className="text-muted-foreground">
          {profile.state} · {profile.total_trades} disclosed trades
        </p>
        <p className="text-muted-foreground text-xs">
          Committee assignments are not available in public STOCK Act disclosure data.
        </p>
      </div>

      {/* LEGAL-01: Disclaimer required on every analysis page showing estimated returns */}
      <Disclaimer />

      {/* Metrics */}
      <PoliticianMetrics profile={profile} />

      <Separator />

      {/* Trade history */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Trade History</h2>
        <TradeTable trades={profile.trades} />
      </div>
    </div>
  )
}
