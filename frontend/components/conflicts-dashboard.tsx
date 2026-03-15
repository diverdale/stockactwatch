'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts'
import type {
  ConflictTrade,
  ConflictsResponse,
  ConflictsSummaryResponse,
  ConflictHearingsResponse,
  CommitteeScorecard,
  HearingEvent,
} from '@/lib/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDollar(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

function formatAmount(lower: number | null, upper: number | null): string {
  if (lower === null && upper === null) return '—'
  const fmt = (n: number) =>
    n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
      ? `$${(n / 1_000).toFixed(0)}K`
      : `$${n.toLocaleString()}`
  if (lower !== null && upper !== null) return `${fmt(lower)}–${fmt(upper)}`
  if (lower !== null) return `${fmt(lower)}+`
  return '—'
}

function partyColor(party: string | null): string {
  if (party === 'Republican') return 'text-red-400'
  if (party === 'Democrat') return 'text-blue-400'
  return 'text-muted-foreground'
}

function partyLetter(party: string | null): string {
  if (party === 'Republican') return 'R'
  if (party === 'Democrat') return 'D'
  return party?.[0] ?? '?'
}

function isBuy(txType: string): boolean {
  return txType.toLowerCase().includes('purchase')
}

function shortCommitteeName(name: string): string {
  return name
    .replace(/^(House|Senate)\s+Committee\s+on\s+/i, '')
    .replace(/^(House|Senate)\s+/i, '')
    .replace(/\s+Committee$/i, '')
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7)
}

function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T12:00:00Z')
}

function daysBetween(d1: Date, d2: Date): number {
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface Props {
  trades: ConflictsResponse
  summary: ConflictsSummaryResponse
  hearings: ConflictHearingsResponse
}

interface TradeWithProximity extends ConflictTrade {
  nearestHearing?: HearingEvent
  daysBeforeHearing?: number
}

// ---------------------------------------------------------------------------
// Committee Scorecard Card
// ---------------------------------------------------------------------------

function CommitteeScorecardCard({
  card,
  isSelected,
  onClick,
}: {
  card: CommitteeScorecard
  isSelected: boolean
  onClick: () => void
}) {
  const total = card.buy_count + card.sell_count || 1
  const buyPct = (card.buy_count / total) * 100
  const isHouse = card.chamber === 'House'

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-lg border p-3 text-left transition-all cursor-pointer ${
        isSelected
          ? 'border-amber-400/60 bg-amber-500/10 ring-1 ring-amber-400/40'
          : 'border-border/60 bg-card/60 hover:border-amber-400/30 hover:bg-card'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
            isHouse
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-amber-500/15 text-amber-400'
          }`}
        >
          {card.chamber}
        </span>
        {card.chair_trades > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">
            {card.chair_trades} chair
          </span>
        )}
      </div>

      <p className="text-[11px] font-medium text-muted-foreground leading-snug mb-2">
        {shortCommitteeName(card.committee_name)}
      </p>

      <div className="flex items-baseline gap-1.5 mb-0.5">
        <span className="text-xl font-bold tabular-nums">{card.total_trades.toLocaleString()}</span>
        <span className="text-xs text-muted-foreground">trades</span>
      </div>
      <p className="text-[10px] text-muted-foreground mb-2">
        {card.member_count} member{card.member_count !== 1 ? 's' : ''}
      </p>

      <div className="w-full h-1.5 rounded-full bg-red-500/20 overflow-hidden">
        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${buyPct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] mt-1 text-muted-foreground">
        <span className="text-emerald-500">{card.buy_count}B</span>
        <span className="text-xs font-medium">{formatDollar(card.dollar_vol_est)}</span>
        <span className="text-red-400">{card.sell_count}S</span>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Timeline chart
// ---------------------------------------------------------------------------

interface MonthlyBucket {
  month: string
  label: string
  count: number
}

interface HearingRefLine {
  date: string
  label: string
  committee_code: string
}

interface PreHearingRegion {
  x1: string
  x2: string
}

function TradeTimeline({
  trades,
  hearings,
  windowDays,
  selectedCommittee,
}: {
  trades: ConflictTrade[]
  hearings: HearingEvent[]
  windowDays: 7 | 30
  selectedCommittee: string | null
}) {
  const filteredTrades = selectedCommittee
    ? trades.filter((t) => t.committee_code === selectedCommittee)
    : trades

  const filteredHearings = selectedCommittee
    ? hearings.filter((h) => h.committee_code === selectedCommittee)
    : hearings

  const buckets = useMemo<MonthlyBucket[]>(() => {
    const now = new Date()
    const months: MonthlyBucket[] = []
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      months.push({ month: key, label, count: 0 })
    }
    filteredTrades.forEach((t) => {
      const mk = monthKey(t.trade_date)
      const bucket = months.find((b) => b.month === mk)
      if (bucket) bucket.count++
    })
    return months
  }, [filteredTrades])

  const cutoff = useMemo(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 24)
    return d.toISOString().slice(0, 10)
  }, [])

  const hearingLines = useMemo<HearingRefLine[]>(() => {
    return filteredHearings
      .filter((h) => h.hearing_date >= cutoff)
      .map((h) => ({
        date: monthKey(h.hearing_date),
        label: `${h.committee_code} ${h.meeting_type || 'Meeting'}`,
        committee_code: h.committee_code,
      }))
  }, [filteredHearings, cutoff])

  const regions = useMemo<PreHearingRegion[]>(() => {
    return filteredHearings
      .filter((h) => h.hearing_date >= cutoff)
      .map((h) => {
        const hearingDate = parseDate(h.hearing_date)
        const windowStart = new Date(hearingDate)
        windowStart.setDate(windowStart.getDate() - windowDays)
        return {
          x1: monthKey(windowStart.toISOString().slice(0, 10)),
          x2: monthKey(h.hearing_date),
        }
      })
      .filter((r) => r.x1 !== r.x2)
  }, [filteredHearings, windowDays, cutoff])

  if (buckets.length === 0) return null

  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={buckets} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval={2} />
        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={28} />
        <Tooltip
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
          formatter={(value: number) => [`${value} trades`, 'Conflicts']}
        />
        {regions.map((r, i) => (
          <ReferenceArea key={`region-${i}`} x1={r.x1} x2={r.x2} fill="#f59e0b" fillOpacity={0.12} />
        ))}
        <Bar dataKey="count" fill="#f59e0b" radius={[2, 2, 0, 0]} opacity={0.85} />
        {hearingLines.map((hl, i) => (
          <ReferenceLine
            key={`hl-${hl.date}-${i}`}
            x={hl.date}
            stroke="#ef4444"
            strokeDasharray="4 2"
            strokeWidth={1.5}
            opacity={0.6}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Compact trade row (used in both pre-hearing and all-conflicts tables)
// ---------------------------------------------------------------------------

function TradeRow({
  trade,
  daysBeforeHearing,
}: {
  trade: ConflictTrade
  daysBeforeHearing?: number
}) {
  const buy = isBuy(trade.transaction_type)
  const date = new Date(trade.trade_date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
  })

  return (
    <tr className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors group">
      {/* Buy/sell */}
      <td className="pl-4 pr-2 py-2.5 whitespace-nowrap">
        <span
          className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${
            buy
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-red-500/15 text-red-400'
          }`}
        >
          {buy ? '▲ Buy' : '▼ Sell'}
        </span>
      </td>

      {/* Ticker */}
      <td className="px-2 py-2.5 whitespace-nowrap">
        <Link
          href={`/tickers/${trade.ticker}`}
          className="font-mono text-xs font-bold text-primary hover:underline"
        >
          {trade.ticker}
        </Link>
      </td>

      {/* Member */}
      <td className="px-2 py-2.5">
        <div className="flex items-center gap-1.5">
          <Link
            href={`/politicians/${trade.politician_id}`}
            className="text-xs font-medium hover:text-primary transition-colors whitespace-nowrap"
          >
            {trade.full_name}
          </Link>
          {trade.party && (
            <span className={`text-[10px] font-semibold ${partyColor(trade.party)}`}>
              {partyLetter(trade.party)}{trade.state ? `-${trade.state}` : ''}
            </span>
          )}
          {trade.role && (
            <span className="text-[10px] font-medium px-1 py-0.5 rounded bg-amber-500/15 text-amber-400 whitespace-nowrap">
              {trade.role}
            </span>
          )}
        </div>
      </td>

      {/* Committee */}
      <td className="px-2 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
        {shortCommitteeName(trade.committee_name)}
      </td>

      {/* Amount */}
      <td className="px-2 py-2.5 text-xs text-right whitespace-nowrap tabular-nums">
        {formatAmount(trade.amount_lower, trade.amount_upper)}
      </td>

      {/* Date */}
      <td className="px-2 py-2.5 text-xs text-muted-foreground whitespace-nowrap tabular-nums">
        {date}
      </td>

      {/* Pre-hearing badge (optional) */}
      {daysBeforeHearing !== undefined && (
        <td className="pl-2 pr-4 py-2.5 whitespace-nowrap">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">
            {daysBeforeHearing}d before hearing
          </span>
        </td>
      )}
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

export function ConflictsDashboard({ trades, summary, hearings }: Props) {
  const [selectedCommittee, setSelectedCommittee] = useState<string | null>(null)
  const [windowDays, setWindowDays] = useState<7 | 30>(30)
  const [search, setSearch] = useState('')
  const [chamber, setChamber] = useState<'All' | 'House' | 'Senate'>('All')
  const [txFilter, setTxFilter] = useState<'All' | 'Purchase' | 'Sale'>('All')
  const [pageSize, setPageSize] = useState<20 | 50 | 100>(50)
  const [page, setPage] = useState(0)

  const preHearingTrades = useMemo<TradeWithProximity[]>(() => {
    if (hearings.hearings.length === 0) return []
    return trades.trades
      .filter((t) => !selectedCommittee || t.committee_code === selectedCommittee)
      .flatMap((trade) => {
        const tradeDate = parseDate(trade.trade_date)
        const relevantHearings = hearings.hearings.filter((h) => {
          if (h.committee_code !== trade.committee_code) return false
          const diff = daysBetween(tradeDate, parseDate(h.hearing_date))
          return diff >= 0 && diff <= windowDays
        })
        if (relevantHearings.length === 0) return []
        const nearest = relevantHearings.reduce((a, b) => {
          const da = daysBetween(tradeDate, parseDate(a.hearing_date))
          const db = daysBetween(tradeDate, parseDate(b.hearing_date))
          return da <= db ? a : b
        })
        return [{ ...trade, nearestHearing: nearest, daysBeforeHearing: daysBetween(tradeDate, parseDate(nearest.hearing_date)) }]
      })
      .sort((a, b) => (a.daysBeforeHearing ?? 999) - (b.daysBeforeHearing ?? 999))
  }, [trades.trades, hearings.hearings, windowDays, selectedCommittee])

  const filteredTrades = useMemo(() => {
    setPage(0)
    const q = search.toLowerCase().trim()
    return trades.trades.filter((t) => {
      if (q && !t.full_name.toLowerCase().includes(q) && !t.ticker.toLowerCase().includes(q)) return false
      if (chamber !== 'All' && t.chamber !== chamber) return false
      if (txFilter !== 'All') {
        const buyTx = isBuy(t.transaction_type)
        if (txFilter === 'Purchase' && !buyTx) return false
        if (txFilter === 'Sale' && buyTx) return false
      }
      if (selectedCommittee && t.committee_code !== selectedCommittee) return false
      return true
    })
  }, [trades.trades, search, chamber, txFilter, selectedCommittee])

  const totalPages = Math.ceil(filteredTrades.length / pageSize)
  const paginated = filteredTrades.slice(page * pageSize, (page + 1) * pageSize)

  const toggleCommittee = (code: string) => {
    setSelectedCommittee((prev) => (prev === code ? null : code))
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Committee Conflict Tracker</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Trades where the member sits on an oversight committee for the sector they traded in.
        </p>
        <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-300/90">
          <strong className="text-amber-200">Note:</strong> These trades are not illegal. The STOCK Act requires disclosure but permits trading.
          Conflicts are based on committee oversight areas and do not imply wrongdoing.
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Conflict Trades', value: summary.total_flagged_trades.toLocaleString() },
          { label: 'Est. Volume', value: formatDollar(summary.dollar_vol_est) },
          { label: 'Members', value: summary.total_members_implicated.toLocaleString() },
          { label: 'Committees', value: summary.total_committees.toLocaleString() },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-border/60 bg-card/60 px-4 py-3">
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Committee Scorecards */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Committee Scorecards</h2>
          {selectedCommittee && (
            <button
              onClick={() => setSelectedCommittee(null)}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Clear filter
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
          {summary.committees.map((card) => (
            <CommitteeScorecardCard
              key={card.committee_code}
              card={card}
              isSelected={selectedCommittee === card.committee_code}
              onClick={() => toggleCommittee(card.committee_code)}
            />
          ))}
        </div>
      </section>

      {/* Timeline */}
      <section className="rounded-xl border border-border/60 bg-card/40 p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-base font-semibold">Trade &amp; Hearing Timeline</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Bars = conflict trades per month · Red lines = committee hearings · Amber = {windowDays}-day pre-hearing window
            </p>
          </div>
          <div className="flex rounded-md border border-border/60 overflow-hidden text-xs">
            {([7, 30] as const).map((d) => (
              <button
                key={d}
                onClick={() => setWindowDays(d)}
                className={`px-3 py-1.5 transition-colors ${
                  windowDays === d
                    ? 'bg-amber-500/20 text-amber-300 font-semibold'
                    : 'bg-transparent text-muted-foreground hover:bg-muted/40'
                }`}
              >
                {d}d window
              </button>
            ))}
          </div>
        </div>
        {hearings.hearings.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            No hearing data available.
          </div>
        ) : (
          <TradeTimeline
            trades={selectedCommittee ? trades.trades.filter((t) => t.committee_code === selectedCommittee) : trades.trades}
            hearings={hearings.hearings}
            windowDays={windowDays}
            selectedCommittee={selectedCommittee}
          />
        )}
      </section>

      {/* Pre-hearing trades */}
      {preHearingTrades.length > 0 && (
        <section className="rounded-xl border border-red-500/20 bg-red-500/5">
          <div className="px-5 py-4 border-b border-red-500/20">
            <h2 className="text-base font-semibold text-red-300">
              ⚡ {preHearingTrades.length} trade{preHearingTrades.length !== 1 ? 's' : ''} within {windowDays} days before a committee hearing
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sorted by proximity to hearing — closest first.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-red-500/20 text-left">
                  <th className="pl-4 pr-2 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Type</th>
                  <th className="px-2 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Ticker</th>
                  <th className="px-2 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Member</th>
                  <th className="px-2 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Committee</th>
                  <th className="px-2 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide text-right">Amount</th>
                  <th className="px-2 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Date</th>
                  <th className="pl-2 pr-4 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Proximity</th>
                </tr>
              </thead>
              <tbody>
                {preHearingTrades.slice(0, 20).map((trade) => (
                  <TradeRow
                    key={`pre-${trade.trade_id}-${trade.committee_code}`}
                    trade={trade}
                    daysBeforeHearing={trade.daysBeforeHearing}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {preHearingTrades.length > 20 && (
            <p className="text-xs text-muted-foreground text-center px-5 py-3 border-t border-red-500/20">
              + {preHearingTrades.length - 20} more — filter by committee above to narrow results
            </p>
          )}
        </section>
      )}

      {/* All conflicts table */}
      <section>
        <h2 className="text-base font-semibold mb-4">All Conflict Trades</h2>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or ticker…"
            className="flex-1 min-w-48 rounded-md border border-border/60 bg-card/60 px-3 py-1.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex rounded-md border border-border/60 overflow-hidden text-xs">
            {(['All', 'House', 'Senate'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setChamber(c)}
                className={`px-3 py-1.5 transition-colors ${
                  chamber === c ? 'bg-primary/20 text-primary font-semibold' : 'text-muted-foreground hover:bg-muted/40'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex rounded-md border border-border/60 overflow-hidden text-xs">
            {(['All', 'Purchase', 'Sale'] as const).map((tx) => (
              <button
                key={tx}
                onClick={() => setTxFilter(tx)}
                className={`px-3 py-1.5 transition-colors ${
                  txFilter === tx ? 'bg-primary/20 text-primary font-semibold' : 'text-muted-foreground hover:bg-muted/40'
                }`}
              >
                {tx}
              </button>
            ))}
          </div>
        </div>

        {/* Count + page size */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="text-xs text-muted-foreground">
            {filteredTrades.length.toLocaleString()} trade{filteredTrades.length !== 1 ? 's' : ''}
            {filteredTrades.length !== trades.total && ` of ${trades.total.toLocaleString()} total`}
          </p>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Show</span>
            <div className="flex rounded-md border border-border/60 overflow-hidden">
              {([20, 50, 100] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => { setPageSize(n); setPage(0) }}
                  className={`px-2.5 py-1.5 transition-colors ${
                    pageSize === n ? 'bg-primary/20 text-primary font-semibold' : 'text-muted-foreground hover:bg-muted/40'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredTrades.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No conflicts match your filters.
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr className="border-b border-border/60 text-left">
                      <th className="pl-4 pr-2 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Type</th>
                      <th className="px-2 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Ticker</th>
                      <th className="px-2 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Member</th>
                      <th className="px-2 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Committee</th>
                      <th className="px-2 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide text-right">Amount</th>
                      <th className="px-2 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((trade) => (
                      <TradeRow
                        key={`${trade.trade_id}-${trade.committee_code}`}
                        trade={trade}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/40">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 text-xs rounded-md border border-border/60 bg-card disabled:opacity-40 hover:bg-muted/40 transition-colors"
                >
                  ← Previous
                </button>
                <span className="text-xs text-muted-foreground">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 text-xs rounded-md border border-border/60 bg-card disabled:opacity-40 hover:bg-muted/40 transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
