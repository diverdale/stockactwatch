'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import type { PoliticianListEntry } from '@/lib/types'

const partyColor: Record<string, string> = {
  Republican: 'text-red-400 bg-red-400/10',
  Democrat: 'text-blue-400 bg-blue-400/10',
  Democratic: 'text-blue-400 bg-blue-400/10',
  Independent: 'text-purple-400 bg-purple-400/10',
}

const chamberColor: Record<string, string> = {
  House: 'text-emerald-400 bg-emerald-400/10',
  Senate: 'text-amber-400 bg-amber-400/10',
}

function partyAbbr(party: string | null): string {
  if (!party) return '?'
  if (party.toLowerCase().startsWith('rep')) return 'R'
  if (party.toLowerCase().startsWith('dem')) return 'D'
  if (party.toLowerCase().startsWith('ind')) return 'I'
  return party[0]
}

interface Props {
  politicians: PoliticianListEntry[]
  stats: { total: number; house: number; senate: number; totalTrades: number }
}

export function PoliticiansList({ politicians, stats }: Props) {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? politicians.filter(p =>
        p.full_name.toLowerCase().includes(query.toLowerCase()) ||
        (p.state ?? '').toLowerCase().includes(query.toLowerCase()) ||
        (p.party ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : politicians

  return (
    <div className="space-y-6">
      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Members', value: stats.total.toLocaleString() },
          { label: 'House', value: stats.house.toLocaleString() },
          { label: 'Senate', value: stats.senate.toLocaleString() },
          { label: 'Total Trades', value: stats.totalTrades.toLocaleString() },
        ].map(s => (
          <div key={s.label} className="rounded-lg border bg-card px-4 py-3">
            <p className="text-2xl font-bold tabular-nums">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <input
        type="search"
        placeholder="Search by name, state, or party…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      />

      {/* Count */}
      <p className="text-sm text-muted-foreground">
        {filtered.length} member{filtered.length !== 1 ? 's' : ''}
        {query && ` matching "${query}"`}
      </p>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(p => {
          const buyPct = p.trade_count > 0 ? Math.round((p.buy_count / p.trade_count) * 100) : 50
          const pColor = partyColor[p.party ?? ''] ?? 'text-muted-foreground bg-muted/30'
          const cColor = chamberColor[p.chamber ?? ''] ?? 'text-muted-foreground bg-muted/30'

          return (
            <Link
              key={p.politician_id}
              href={`/politicians/${p.politician_id}`}
              className="group rounded-xl border bg-card p-4 hover:bg-accent transition-colors flex gap-3 items-start"
            >
              {/* Photo */}
              <div className="shrink-0 w-12 h-12 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                {p.photo_url ? (
                  <Image
                    src={p.photo_url}
                    alt={p.full_name}
                    width={48}
                    height={48}
                    className="object-cover object-top w-full h-full"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                  />
                ) : (
                  <span className="text-lg font-bold text-muted-foreground">
                    {p.full_name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm leading-tight truncate group-hover:text-primary transition-colors">
                  {p.full_name}
                </p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {p.chamber && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cColor}`}>
                      {p.chamber}
                    </span>
                  )}
                  {p.party && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${pColor}`}>
                      {partyAbbr(p.party)}
                    </span>
                  )}
                  {p.state && (
                    <span className="text-[10px] text-muted-foreground">{p.state}</span>
                  )}
                </div>

                {/* Trade stats */}
                <div className="mt-2.5 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{p.trade_count.toLocaleString()} trades</span>
                    <span>{buyPct}% buys</span>
                  </div>
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
                    <div className="bg-emerald-400" style={{ width: `${buyPct}%` }} />
                    <div className="bg-orange-400" style={{ width: `${100 - buyPct}%` }} />
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
