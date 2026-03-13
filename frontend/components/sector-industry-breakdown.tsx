'use client'
import type { IndustryEntry } from '@/lib/types'

interface Props {
  industries: IndustryEntry[]
}

export function SectorIndustryBreakdown({ industries }: Props) {
  if (industries.length === 0) {
    return <p className="text-sm text-muted-foreground">No industry breakdown available.</p>
  }
  const maxTrades = Math.max(...industries.map(i => i.total_trades))
  return (
    <div className="space-y-2">
      {industries.map((ind) => {
        const barPct = maxTrades > 0 ? Math.round((ind.total_trades / maxTrades) * 100) : 0
        return (
          <div key={ind.industry} className="rounded-lg border bg-card px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-medium text-sm">{ind.industry}</span>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span className="text-emerald-600">{ind.buy_count}B</span>
                <span className="text-red-500">{ind.sell_count}S</span>
                <span>{ind.total_trades} trades</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary/40 rounded-full" style={{ width: `${barPct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
