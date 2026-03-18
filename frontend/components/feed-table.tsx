'use client'
import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useQueryState } from 'nuqs'
import type { FeedEntry } from '@/lib/types'

// ── Sort ──────────────────────────────────────────────────────────────────────

type SortCol = 'full_name' | 'company_name' | 'transaction_type' | 'amount_lower' | 'trade_date' | 'lag' | 'asset_type'

function SortArrow({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <span className="ml-0.5 text-muted-foreground/30 text-[10px]">↕</span>
  return <span className="ml-0.5 text-[10px]">{dir === 'asc' ? '↑' : '↓'}</span>
}

function ColHeader({
  col, label, sortBy, sortDir, onSort, className = '',
}: {
  col: SortCol
  label: string
  sortBy: string
  sortDir: 'asc' | 'desc'
  onSort: (col: SortCol) => void
  className?: string
}) {
  const active = sortBy === col
  return (
    <button
      onClick={() => onSort(col)}
      className={`flex items-center gap-0.5 text-[10px] font-medium uppercase tracking-wider transition-colors whitespace-nowrap cursor-pointer select-none ${
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
      } ${className}`}
    >
      {label}
      <SortArrow active={active} dir={sortDir} />
    </button>
  )
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TIERS = [
  { level: 1, range: '<$15K',       min: 0,       max: 15_000 },
  { level: 2, range: '$15K–$100K',  min: 15_001,  max: 100_000 },
  { level: 3, range: '$100K–$500K', min: 100_001, max: 500_000 },
  { level: 4, range: '$500K+',      min: 500_001, max: Infinity },
]

const PARTY_RING: Record<string, string> = {
  Republican:  'ring-red-500/60',
  Democrat:    'ring-blue-500/60',
  Independent: 'ring-purple-500/60',
}

const PARTY_BADGE: Record<string, string> = {
  Republican:  'bg-red-500/15 text-red-400',
  Democrat:    'bg-blue-500/15 text-blue-400',
  Independent: 'bg-purple-500/15 text-purple-400',
}

const CHAMBER_BADGE: Record<string, string> = {
  House:  'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  Senate: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTier(lower: number | null) {
  const n = lower ?? 0
  return TIERS.find(t => n >= t.min && n <= t.max) ?? TIERS[0]
}

const isBuy = (tx: string) =>
  tx.toLowerCase().includes('purchase') || tx.toLowerCase().includes('buy')

function filingLag(tradeDate: string, disclosureDate: string): number {
  return Math.round(
    (new Date(disclosureDate).getTime() - new Date(tradeDate).getTime()) / 86_400_000
  )
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function lagColor(days: number): string {
  if (days <= 10) return 'text-emerald-600 dark:text-emerald-400'
  if (days <= 30) return 'text-yellow-600 dark:text-yellow-400'
  if (days <= 45) return 'text-amber-600 dark:text-amber-400'
  return 'text-orange-600 dark:text-orange-400'
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function partyAbbr(party: string | null): string {
  if (!party) return '?'
  if (party.toLowerCase().startsWith('rep')) return 'R'
  if (party.toLowerCase().startsWith('dem')) return 'D'
  return 'I'
}

// ── Ticker logo ────────────────────────────────────────────────────────────────

function TickerLogo({ ticker }: { ticker: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <img
      src={`https://assets.parqet.com/logos/symbol/${ticker}?format=png`}
      alt=""
      width={20}
      height={20}
      onError={() => setFailed(true)}
      className="h-5 w-5 rounded-full object-contain bg-white p-0.5 ring-1 ring-border/30 shrink-0"
    />
  )
}

// ── Trade row ─────────────────────────────────────────────────────────────────

function TradeRow({ entry }: { entry: FeedEntry }) {
  const buy        = isBuy(entry.transaction_type)
  const tier       = getTier(entry.amount_lower)
  const lag        = filingLag(String(entry.trade_date), String(entry.disclosure_date))
  const partyRing  = entry.party ? (PARTY_RING[entry.party]   ?? 'ring-border/40') : 'ring-border/40'
  const partyBadge = entry.party ? (PARTY_BADGE[entry.party]  ?? null) : null
  const chamberCls = entry.chamber ? (CHAMBER_BADGE[entry.chamber] ?? '') : null

  return (
    <div className="relative flex items-center hover:bg-muted/20 transition-colors group">
      {/* Buy/sell accent stripe */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${buy ? 'bg-emerald-500' : 'bg-orange-500'} opacity-50 group-hover:opacity-100 transition-opacity`} />

      {/* Member */}
      <div className="pl-4 pr-3 py-3.5 w-56 shrink-0 flex items-center gap-2.5 min-w-0">
        <div className={`relative shrink-0 h-9 w-9 rounded-full ring-2 ${partyRing} overflow-hidden`}>
          {entry.photo_url ? (
            <Image
              src={entry.photo_url}
              alt={entry.full_name}
              width={36}
              height={36}
              className="object-cover object-top w-full h-full"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <span className="text-[10px] font-bold text-muted-foreground">{initials(entry.full_name)}</span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <Link
            href={`/politicians/${entry.politician_id}`}
            className="font-semibold text-sm leading-tight hover:text-primary transition-colors block truncate"
          >
            {entry.full_name}
          </Link>
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            {partyBadge && (
              <span className={`text-[9px] font-bold px-1.5 py-px rounded ${partyBadge}`}>
                {partyAbbr(entry.party)}
              </span>
            )}
            {chamberCls && (
              <span className={`text-[9px] font-medium px-1.5 py-px rounded ${chamberCls}`}>
                {entry.chamber}
              </span>
            )}
            {entry.state && (
              <span className="text-[9px] text-muted-foreground">{entry.state}</span>
            )}
          </div>
        </div>
      </div>

      {/* Stock */}
      <div className="px-3 py-3.5 flex-1 min-w-0 flex items-center gap-2">
        <TickerLogo ticker={entry.ticker} />
        <div className="min-w-0">
          <Link
            href={`/tickers/${entry.ticker}`}
            className="font-bold text-sm hover:text-primary transition-colors block truncate"
          >
            {entry.company_name ?? entry.ticker}
          </Link>
          <p className="text-[11px] text-muted-foreground font-mono">{entry.ticker}</p>
        </div>
      </div>

      {/* Type */}
      <div className="px-3 py-3.5 w-20 shrink-0 flex flex-col gap-0.5 items-start">
        <span className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${
          buy
            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
            : 'bg-orange-500/15 text-orange-400 border-orange-500/20'
        }`}>
          {buy ? '▲ Buy' : '▼ Sell'}
        </span>
        {!entry.return_calculable && (
          <span className="text-[9px] text-muted-foreground">options</span>
        )}
      </div>

      {/* Amount */}
      <div className="px-3 py-3.5 w-24 shrink-0">
        <span className="font-mono text-sm font-bold leading-none block">
          <span className={buy ? 'text-emerald-400' : 'text-orange-400'}>{'$'.repeat(tier.level)}</span>
          <span className={buy ? 'text-emerald-400/20' : 'text-orange-400/20'}>{'$'.repeat(4 - tier.level)}</span>
        </span>
        <p className="text-[10px] text-muted-foreground mt-0.5">{tier.range}</p>
      </div>

      {/* Price */}
      <div className="px-3 py-3.5 w-24 shrink-0 hidden lg:block">
        {entry.price_at_trade != null ? (
          <>
            <p className="text-sm font-semibold tabular-nums">${Number(entry.price_at_trade).toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">trade day</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground/40">—</p>
        )}
      </div>

      {/* Traded */}
      <div className="px-3 py-3.5 w-24 shrink-0 hidden md:block">
        <p className="text-sm tabular-nums">{fmtDate(String(entry.trade_date))}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">traded</p>
      </div>

      {/* Filing lag */}
      <div className="px-3 py-3.5 w-24 shrink-0 hidden md:block">
        <p className={`text-sm font-semibold tabular-nums ${lagColor(lag)}`}>{lag}d</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">to disclose</p>
      </div>

      {/* Asset type */}
      <div className="px-3 py-3.5 w-20 shrink-0 hidden xl:block">
        <p className="text-xs text-muted-foreground capitalize">{entry.asset_type}</p>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function FeedTable({
  entries,
  sortBy: initialSortBy,
  sortDir: initialSortDir,
}: {
  entries: FeedEntry[]
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}) {
  const [sortBy, setSortBy] = useQueryState('sort_by', { defaultValue: initialSortBy ?? 'trade_date', shallow: false })
  const [sortDir, setSortDir] = useQueryState('sort_dir', { defaultValue: initialSortDir ?? 'desc', shallow: false })
  const [, setOffset] = useQueryState('offset', { defaultValue: '0', shallow: false })

  function handleSort(col: SortCol) {
    setOffset('0')
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(col)
      setSortDir('desc')
    }
  }

  const sortProps = { sortBy: sortBy ?? 'trade_date', sortDir: (sortDir ?? 'desc') as 'asc' | 'desc', onSort: handleSort }

  if (entries.length === 0) {
    return (
      <div className="py-10 text-center text-muted-foreground border-t border-border/60">
        No trades found for the selected filters.
      </div>
    )
  }

  const buys   = entries.filter(e => isBuy(e.transaction_type)).length
  const sells  = entries.length - buys
  const buyPct = Math.round((buys / entries.length) * 100)
  const lags   = entries.map(e => filingLag(String(e.trade_date), String(e.disclosure_date)))
  const avgLag = Math.round(lags.reduce((a, b) => a + b, 0) / lags.length)

  return (
    <div className="space-y-3">
      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/60 bg-card/30 px-4 py-3">
          <p className="text-2xl font-black tabular-nums">{entries.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Trades shown</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card/30 px-4 py-3">
          <p className="text-2xl font-black tabular-nums text-emerald-400">{buys}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Purchases</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card/30 px-4 py-3">
          <p className="text-2xl font-black tabular-nums text-orange-400">{sells}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Sales</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card/30 px-4 py-3">
          <p className={`text-2xl font-black tabular-nums ${lagColor(avgLag)}`}>{avgLag}d</p>
          <p className="text-xs text-muted-foreground mt-0.5">Avg filing lag</p>
        </div>
      </div>

      {/* Buy/sell proportion bar */}
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted/30">
        <div className="bg-emerald-500 h-full transition-all" style={{ width: `${buyPct}%` }} />
        <div className="bg-orange-500 h-full transition-all" style={{ width: `${100 - buyPct}%` }} />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/60 overflow-hidden">
        {/* Header */}
        <div className="flex items-center border-b border-border/60 bg-muted/40">
          <div className="pl-7 pr-3 py-2.5 w-56 shrink-0">
            <ColHeader col="full_name" label="Member" {...sortProps} />
          </div>
          <div className="px-3 py-2.5 flex-1">
            <ColHeader col="company_name" label="Stock" {...sortProps} />
          </div>
          <div className="px-3 py-2.5 w-20 shrink-0">
            <ColHeader col="transaction_type" label="Type" {...sortProps} />
          </div>
          <div className="px-3 py-2.5 w-24 shrink-0">
            <ColHeader col="amount_lower" label="Amount" {...sortProps} />
          </div>
          <div className="px-3 py-2.5 w-24 shrink-0 hidden lg:block">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Price</span>
          </div>
          <div className="px-3 py-2.5 w-24 shrink-0 hidden md:block">
            <ColHeader col="trade_date" label="Traded" {...sortProps} />
          </div>
          <div className="px-3 py-2.5 w-24 shrink-0 hidden md:block">
            <ColHeader col="lag" label="Lag" {...sortProps} />
          </div>
          <div className="px-3 py-2.5 w-20 shrink-0 hidden xl:block">
            <ColHeader col="asset_type" label="Asset" {...sortProps} />
          </div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border/40">
          {entries.map(entry => (
            <TradeRow key={entry.trade_id} entry={entry} />
          ))}
        </div>
      </div>
    </div>
  )
}
