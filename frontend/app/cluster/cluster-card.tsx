'use client'
import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// ─── Company logo ─────────────────────────────────────────────────────────────

function TickerLogo({ ticker, company }: { ticker: string; company: string | null }) {
  const [failed, setFailed] = useState(false)
  const abbr = (company ?? ticker).replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || ticker.slice(0, 2)

  if (!failed) {
    return (
      <img
        src={`https://assets.parqet.com/logos/symbol/${ticker}?format=png`}
        alt={ticker}
        width={40}
        height={40}
        onError={() => setFailed(true)}
        className="h-10 w-10 rounded-full object-contain bg-white p-0.5 ring-1 ring-border/40 shrink-0"
      />
    )
  }

  return (
    <div className="h-10 w-10 rounded-full bg-muted/60 ring-1 ring-border/40 flex items-center justify-center shrink-0">
      <span className="text-xs font-bold text-muted-foreground">{abbr}</span>
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClusterMember {
  politician_id: string
  full_name: string
  party: string | null
  chamber: string | null
  transaction_type: string
  trade_date: string
  amount_lower: number | null
  amount_upper: number | null
}

export interface ClusterEntry {
  ticker: string
  company_name: string | null
  member_count: number
  trade_count: number
  buy_count: number
  sell_count: number
  last_trade_date: string
  net_sentiment: 'bullish' | 'bearish' | 'mixed'
  members: ClusterMember[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIERS = [
  { level: 1, range: '<$15K',       min: 0,       max: 15_000 },
  { level: 2, range: '$15K–$100K',  min: 15_001,  max: 100_000 },
  { level: 3, range: '$100K–$500K', min: 100_001, max: 500_000 },
  { level: 4, range: '$500K+',      min: 500_001, max: Infinity },
]

function getAmountTier(lower: number | null, upper: number | null) {
  const val = lower ?? upper
  if (val === null) return { label: '–', level: 0 }
  const tier = TIERS.find(t => val >= t.min && val <= t.max)
  return tier ? { label: '$'.repeat(tier.level), level: tier.level } : { label: '–', level: 0 }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function daysSince(iso: string) {
  return Math.round((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function isBuyTx(tx: string) {
  const l = tx.toLowerCase()
  return l.includes('purchase') || l.includes('buy')
}

// ─── Sentiment config ─────────────────────────────────────────────────────────

const SENTIMENT = {
  bullish: {
    accent:  'border-t-emerald-500',
    glow:    'shadow-emerald-500/10',
    badge:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    label:   '▲ Bullish',
    barBuy:  'bg-emerald-500',
    barSell: 'bg-emerald-500/20',
  },
  bearish: {
    accent:  'border-t-orange-500',
    glow:    'shadow-orange-500/10',
    badge:   'bg-orange-500/15 text-orange-400 border-orange-500/30',
    label:   '▼ Bearish',
    barBuy:  'bg-emerald-500/30',
    barSell: 'bg-orange-500',
  },
  mixed: {
    accent:  'border-t-border',
    glow:    'shadow-black/5',
    badge:   'bg-muted/40 text-muted-foreground border-border/50',
    label:   '⇌ Mixed',
    barBuy:  'bg-emerald-500',
    barSell: 'bg-orange-500',
  },
}

const PARTY_RING: Record<string, string> = {
  Republican:  'ring-red-500 bg-red-500/20 text-red-300',
  Democrat:    'ring-blue-500 bg-blue-500/20 text-blue-300',
  Democratic:  'ring-blue-500 bg-blue-500/20 text-blue-300',
  Independent: 'ring-yellow-500 bg-yellow-500/20 text-yellow-300',
}

const PARTY_DOT: Record<string, string> = {
  Republican:  'bg-red-500',
  Democrat:    'bg-blue-500',
  Democratic:  'bg-blue-500',
  Independent: 'bg-yellow-500',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MemberAvatar({ member }: { member: ClusterMember }) {
  const ring = member.party ? (PARTY_RING[member.party] ?? 'ring-border bg-muted/40 text-muted-foreground') : 'ring-border bg-muted/40 text-muted-foreground'
  return (
    <div
      className={cn('h-7 w-7 rounded-full ring-1 flex items-center justify-center text-[10px] font-bold shrink-0', ring)}
      title={`${member.full_name} (${member.party ?? 'Unknown'})`}
    >
      {initials(member.full_name)}
    </div>
  )
}

function MemberRow({ member }: { member: ClusterMember }) {
  const buy = isBuyTx(member.transaction_type)
  const amt = getAmountTier(member.amount_lower, member.amount_upper)

  return (
    <Link
      href={`/politicians/${member.politician_id}`}
      className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/60"
    >
      <MemberAvatar member={member} />
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground group-hover:text-primary transition-colors">
        {member.full_name}
      </span>
      <span className={cn(
        'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold',
        buy
          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
          : 'bg-orange-500/15 text-orange-400 border-orange-500/20'
      )}>
        {buy ? '▲ Buy' : '▼ Sell'}
      </span>
      {amt.level > 0 && (
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground w-6 text-right" title={member.amount_lower !== null ? `$${member.amount_lower.toLocaleString()} – $${member.amount_upper?.toLocaleString() ?? '?'}` : ''}>
          {amt.label}
        </span>
      )}
      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70 hidden sm:block">
        {formatDate(member.trade_date)}
      </span>
    </Link>
  )
}

// ─── Main card ────────────────────────────────────────────────────────────────

const INITIAL_VISIBLE = 5

export function ClusterCard({ entry }: { entry: ClusterEntry }) {
  const [expanded, setExpanded] = useState(false)
  const overflow = entry.members.length - INITIAL_VISIBLE
  const visibleMembers = expanded ? entry.members : entry.members.slice(0, INITIAL_VISIBLE)
  const s = SENTIMENT[entry.net_sentiment]
  const hot = daysSince(entry.last_trade_date) <= 7
  const total = entry.buy_count + entry.sell_count
  const buyPct = total === 0 ? 50 : Math.round((entry.buy_count / total) * 100)

  // Party composition
  const partyCounts: Record<string, number> = {}
  for (const m of entry.members) {
    const p = m.party ?? 'Unknown'
    partyCounts[p] = (partyCounts[p] ?? 0) + 1
  }
  const partyDots = Object.entries(partyCounts).flatMap(([party, count]) =>
    Array(count).fill(party)
  )

  return (
    <div className={cn(
      'relative flex flex-col rounded-xl border border-border/60 border-t-2 bg-card overflow-hidden',
      'shadow-lg transition-all duration-200 hover:shadow-xl hover:border-border',
      s.accent, s.glow,
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 mb-0.5">
            {hot && (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
              </span>
            )}
            <Link
              href={`/tickers/${entry.ticker}`}
              className="text-3xl font-black tracking-tight text-foreground hover:text-primary transition-colors leading-none"
            >
              {entry.ticker}
            </Link>
            <TickerLogo ticker={entry.ticker} company={entry.company_name} />
          </div>
          {entry.company_name && (
            <p className="text-sm text-muted-foreground truncate leading-tight">{entry.company_name}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold', s.badge)}>
            {s.label}
          </span>
          {hot && (
            <span className="text-[10px] text-amber-400 font-medium">active this week</span>
          )}
        </div>
      </div>

      {/* Stat pills */}
      <div className="flex items-center gap-2 px-5 pb-3">
        <div className="flex items-center gap-1.5 rounded-lg bg-muted/30 px-2.5 py-1.5">
          <span className="text-lg font-black tabular-nums leading-none text-foreground">{entry.member_count}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">members</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-muted/30 px-2.5 py-1.5">
          <span className="text-lg font-black tabular-nums leading-none text-foreground">{entry.trade_count}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">trades</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-muted/30 px-2.5 py-1.5 ml-auto">
          <span className="text-[10px] text-muted-foreground">Last</span>
          <span className="text-xs font-semibold text-foreground">{formatDate(entry.last_trade_date)}</span>
        </div>
      </div>

      {/* Buy/sell bar */}
      <div className="px-5 pb-3 space-y-1">
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted/30">
          <div className={cn('h-full transition-all', s.barBuy)} style={{ width: `${buyPct}%` }} />
          <div className={cn('h-full transition-all', s.barSell)} style={{ width: `${100 - buyPct}%` }} />
        </div>
        <div className="flex justify-between text-[10px] tabular-nums">
          <span className="text-emerald-400 font-semibold">{entry.buy_count} {entry.buy_count === 1 ? 'buy' : 'buys'}</span>
          <span className="text-orange-400 font-semibold">{entry.sell_count} {entry.sell_count === 1 ? 'sell' : 'sells'}</span>
        </div>
      </div>

      {/* Party dot strip */}
      <div className="flex items-center gap-1 px-5 pb-4 flex-wrap">
        {partyDots.map((party, i) => (
          <span
            key={i}
            className={cn('h-2 w-2 rounded-full shrink-0', PARTY_DOT[party] ?? 'bg-muted-foreground/50')}
            title={party}
          />
        ))}
        <span className="ml-1 text-[10px] text-muted-foreground/60">
          {Object.entries(partyCounts).map(([p, n]) => `${n} ${p}`).join(' · ')}
        </span>
      </div>

      {/* Divider */}
      <div className="border-t border-border/40 mx-5" />

      {/* Member list */}
      <div className="px-3 py-2 space-y-0.5">
        {visibleMembers.map((member, idx) => (
          <MemberRow key={`${member.politician_id}-${member.trade_date}-${idx}`} member={member} />
        ))}

        {overflow > 0 && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 rounded-lg hover:bg-accent/40"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={cn('transition-transform duration-200', expanded ? 'rotate-180' : '')}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
            {expanded ? 'Show less' : `+${overflow} more ${overflow === 1 ? 'member' : 'members'}`}
          </button>
        )}
      </div>
    </div>
  )
}
