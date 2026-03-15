'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useState, useMemo } from 'react'
import type { PoliticianListEntry } from '@/lib/types'

// ── Constants ──────────────────────────────────────────────────────────────────

const PARTY_GRADIENT: Record<string, string> = {
  Republican:  'from-red-600/60 via-red-900/40 to-transparent',
  Democrat:    'from-blue-600/60 via-blue-900/40 to-transparent',
  Independent: 'from-purple-600/60 via-purple-900/40 to-transparent',
}

const PARTY_GLOW: Record<string, string> = {
  Republican:  'hover:shadow-red-500/15',
  Democrat:    'hover:shadow-blue-500/15',
  Independent: 'hover:shadow-purple-500/15',
}

const PARTY_RING: Record<string, string> = {
  Republican:  'ring-red-500/60',
  Democrat:    'ring-blue-500/60',
  Independent: 'ring-purple-500/60',
}

const PARTY_BADGE: Record<string, string> = {
  Republican:  'bg-red-500/15 text-red-400 border-red-500/20',
  Democrat:    'bg-blue-500/15 text-blue-400 border-blue-500/20',
  Independent: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
}

const CHAMBER_BADGE: Record<string, string> = {
  House:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  Senate: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
}

function partyAbbr(party: string | null): string {
  if (!party) return '?'
  if (party.toLowerCase().startsWith('rep')) return 'R'
  if (party.toLowerCase().startsWith('dem')) return 'D'
  if (party.toLowerCase().startsWith('ind')) return 'I'
  return party[0]
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

// ── Politician card ────────────────────────────────────────────────────────────

function PoliticianCard({ p }: { p: PoliticianListEntry }) {
  const [imgFailed, setImgFailed] = useState(false)
  const buyPct = p.trade_count > 0 ? Math.round((p.buy_count / p.trade_count) * 100) : 50
  const gradient = PARTY_GRADIENT[p.party ?? ''] ?? 'from-muted/60 via-muted/30 to-transparent'
  const glow     = PARTY_GLOW[p.party ?? '']    ?? 'hover:shadow-white/5'
  const ring     = PARTY_RING[p.party ?? '']    ?? 'ring-border/60'
  const pBadge   = PARTY_BADGE[p.party ?? '']   ?? 'bg-muted/30 text-muted-foreground border-border/40'
  const cBadge   = CHAMBER_BADGE[p.chamber ?? ''] ?? 'bg-muted/30 text-muted-foreground border-border/40'

  return (
    <Link
      href={`/politicians/${p.politician_id}`}
      className={`group relative flex flex-col rounded-xl border border-border/60 bg-card overflow-hidden shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:border-border ${glow}`}
    >
      {/* Gradient banner */}
      <div className={`relative h-20 bg-gradient-to-b ${gradient} shrink-0`}>
        {/* Photo — centered, overflows banner bottom */}
        <div className={`absolute -bottom-7 left-1/2 -translate-x-1/2 h-[60px] w-[60px] rounded-full ring-2 ${ring} bg-card overflow-hidden shadow-lg`}>
          {p.photo_url && !imgFailed ? (
            <Image
              src={p.photo_url}
              alt={p.full_name}
              width={60}
              height={60}
              className="object-cover object-top w-full h-full"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <span className="text-sm font-bold text-muted-foreground">{initials(p.full_name)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="pt-9 pb-4 px-4 flex flex-col items-center text-center flex-1">
        {/* Name */}
        <p className="font-bold text-sm leading-tight group-hover:text-primary transition-colors line-clamp-2">
          {p.full_name}
        </p>

        {/* Badges */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap justify-center">
          {p.chamber && (
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cBadge}`}>
              {p.chamber}
            </span>
          )}
          {p.party && (
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${pBadge}`}>
              {partyAbbr(p.party)}
            </span>
          )}
          {p.state && (
            <span className="text-[10px] font-medium text-muted-foreground bg-muted/40 rounded-full px-2 py-0.5">
              {p.state}
            </span>
          )}
        </div>

        {/* Trade stats */}
        <div className="w-full mt-4 space-y-1.5">
          <div className="flex justify-between items-baseline text-xs">
            <span className="font-bold tabular-nums text-foreground">{p.trade_count.toLocaleString()}</span>
            <span className="text-muted-foreground text-[10px]">trades</span>
            <span className={`font-semibold tabular-nums text-[11px] ${buyPct >= 50 ? 'text-emerald-400' : 'text-orange-400'}`}>
              {buyPct}% buys
            </span>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted/40">
            <div className="bg-emerald-500 h-full rounded-l-full transition-all" style={{ width: `${buyPct}%` }} />
            <div className="bg-orange-500 h-full rounded-r-full transition-all" style={{ width: `${100 - buyPct}%` }} />
          </div>
        </div>
      </div>
    </Link>
  )
}

// ── Filters + sort bar ─────────────────────────────────────────────────────────

type Chamber = 'All' | 'House' | 'Senate'
type Party   = 'All' | 'R' | 'D' | 'I'
type SortKey = 'trades' | 'name' | 'buys'

const CHAMBER_TABS: { label: string; value: Chamber }[] = [
  { label: 'All',    value: 'All' },
  { label: 'House',  value: 'House' },
  { label: 'Senate', value: 'Senate' },
]

const PARTY_TABS: { label: string; value: Party; cls: string }[] = [
  { label: 'All', value: 'All', cls: 'hover:bg-accent' },
  { label: 'R',   value: 'R',   cls: 'hover:bg-red-500/20 data-[active=true]:bg-red-500/20 data-[active=true]:text-red-400 data-[active=true]:border-red-500/30' },
  { label: 'D',   value: 'D',   cls: 'hover:bg-blue-500/20 data-[active=true]:bg-blue-500/20 data-[active=true]:text-blue-400 data-[active=true]:border-blue-500/30' },
  { label: 'I',   value: 'I',   cls: 'hover:bg-purple-500/20 data-[active=true]:bg-purple-500/20 data-[active=true]:text-purple-400 data-[active=true]:border-purple-500/30' },
]

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  politicians: PoliticianListEntry[]
  stats: { total: number; house: number; senate: number; totalTrades: number }
}

export function PoliticiansList({ politicians, stats }: Props) {
  const [query,   setQuery]   = useState('')
  const [chamber, setChamber] = useState<Chamber>('All')
  const [party,   setParty]   = useState<Party>('All')
  const [sort,    setSort]    = useState<SortKey>('trades')

  const filtered = useMemo(() => {
    let list = politicians

    if (chamber !== 'All') list = list.filter(p => p.chamber === chamber)

    if (party !== 'All') {
      list = list.filter(p => partyAbbr(p.party) === party)
    }

    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(p =>
        p.full_name.toLowerCase().includes(q) ||
        (p.state ?? '').toLowerCase().includes(q)
      )
    }

    return [...list].sort((a, b) => {
      if (sort === 'trades') return b.trade_count - a.trade_count
      if (sort === 'name')   return a.full_name.localeCompare(b.full_name)
      if (sort === 'buys') {
        const aPct = a.trade_count > 0 ? a.buy_count / a.trade_count : 0
        const bPct = b.trade_count > 0 ? b.buy_count / b.trade_count : 0
        return bPct - aPct
      }
      return 0
    })
  }, [politicians, query, chamber, party, sort])

  return (
    <div className="space-y-5">
      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Members',      value: stats.total.toLocaleString() },
          { label: 'House',        value: stats.house.toLocaleString() },
          { label: 'Senate',       value: stats.senate.toLocaleString() },
          { label: 'Total Trades', value: stats.totalTrades.toLocaleString() },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border/60 bg-card/30 px-4 py-3">
            <p className="text-2xl font-black tabular-nums">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <input
          type="search"
          placeholder="Search by name or state…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="flex-1 rounded-lg border border-border/60 bg-background px-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />

        {/* Chamber tabs */}
        <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/20 p-1 shrink-0">
          {CHAMBER_TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setChamber(t.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                chamber === t.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Party tabs */}
        <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/20 p-1 shrink-0">
          {PARTY_TABS.map(t => (
            <button
              key={t.value}
              data-active={party === t.value}
              onClick={() => setParty(t.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all border border-transparent ${t.cls} ${
                party === t.value && t.value === 'All'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : party !== t.value ? 'text-muted-foreground' : ''
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Count + sort */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filtered.length} member{filtered.length !== 1 ? 's' : ''}
          {query && ` matching "${query}"`}
        </p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Sort:</span>
          {(['trades', 'name', 'buys'] as SortKey[]).map(k => (
            <button
              key={k}
              onClick={() => setSort(k)}
              className={`px-2.5 py-1 rounded-md transition-colors capitalize ${
                sort === k
                  ? 'bg-primary/20 text-primary font-semibold'
                  : 'hover:bg-accent hover:text-foreground'
              }`}
            >
              {k === 'buys' ? 'Buy rate' : k.charAt(0).toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {filtered.map(p => (
          <PoliticianCard key={p.politician_id} p={p} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/60 py-16 text-center text-muted-foreground">
          No members match your filters
        </div>
      )}
    </div>
  )
}
