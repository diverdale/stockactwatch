'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
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
  if (lower === null && upper === null) return 'N/A'
  const fmt = (n: number) =>
    n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
      ? `$${(n / 1_000).toFixed(0)}K`
      : `$${n.toLocaleString()}`
  if (lower !== null && upper !== null) return `${fmt(lower)} – ${fmt(upper)}`
  if (lower !== null) return `${fmt(lower)}+`
  return 'N/A'
}

function partyClass(party: string | null): string {
  if (party === 'Republican') return 'bg-red-100 text-red-800'
  if (party === 'Democrat') return 'bg-blue-100 text-blue-800'
  return 'bg-gray-100 text-gray-700'
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
  return dateStr.slice(0, 7) // "YYYY-MM"
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
      className={`w-full rounded-xl border-2 p-4 text-left transition-all cursor-pointer ${
        isSelected
          ? 'border-amber-400 bg-amber-50 shadow-md'
          : 'border-border bg-card hover:border-amber-200 hover:shadow-sm'
      }`}
    >
      {/* Chamber badge */}
      <div className="flex items-start justify-between mb-2">
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            isHouse
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {card.chamber}
        </span>
        {card.chair_trades > 0 && (
          <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
            {card.chair_trades} chair
          </span>
        )}
      </div>

      {/* Name */}
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 leading-tight">
        {shortCommitteeName(card.committee_name)}
      </p>

      {/* Trade count */}
      <p className="text-3xl font-bold tabular-nums">{card.total_trades.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground mb-3">
        {card.member_count} member{card.member_count !== 1 ? 's' : ''} implicated
      </p>

      {/* Buy/sell bar */}
      <div className="w-full h-2 rounded-full bg-red-200 mb-1 overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full"
          style={{ width: `${buyPct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground mb-2">
        <span className="text-emerald-700">{card.buy_count} buy</span>
        <span className="text-red-700">{card.sell_count} sell</span>
      </div>

      {/* Volume */}
      <p className="text-sm font-medium">{formatDollar(card.dollar_vol_est)}</p>

      {/* Sectors */}
      <div className="mt-2 flex flex-wrap gap-1">
        {card.sectors.slice(0, 2).map((s) => (
          <span key={s} className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
            {s.replace(/-/g, ' ')}
          </span>
        ))}
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
  // Filter trades/hearings to selected committee if any
  const filteredTrades = selectedCommittee
    ? trades.filter((t) => t.committee_code === selectedCommittee)
    : trades

  const filteredHearings = selectedCommittee
    ? hearings.filter((h) => h.committee_code === selectedCommittee)
    : hearings

  // Build monthly buckets for the last 24 months
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

  // Reference lines for hearings (only those in the 24-month window)
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

  // Pre-hearing shaded regions
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
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={buckets} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          interval={2}
        />
        <YAxis tick={{ fontSize: 11 }} width={30} />
        <Tooltip
          formatter={(value: number) => [`${value} trades`, 'Conflict trades']}
        />
        {regions.map((r, i) => (
          <ReferenceArea
            key={`region-${i}`}
            x1={r.x1}
            x2={r.x2}
            fill="#fef3c7"
            fillOpacity={0.6}
          />
        ))}
        <Bar dataKey="count" fill="#f59e0b" radius={[2, 2, 0, 0]} />
        {hearingLines.map((hl, i) => (
          <ReferenceLine
            key={`hl-${hl.date}-${i}`}
            x={hl.date}
            stroke="#dc2626"
            strokeDasharray="4 2"
            strokeWidth={1.5}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Trade card
// ---------------------------------------------------------------------------

function TradeCard({
  trade,
  nearestHearing,
  daysBeforeHearing,
}: {
  trade: ConflictTrade
  nearestHearing?: HearingEvent
  daysBeforeHearing?: number
}) {
  const buy = isBuy(trade.transaction_type)

  return (
    <div className={`rounded-lg border bg-card border-l-4 pl-4 pr-5 py-4 shadow-sm ${buy ? 'border-l-emerald-400' : 'border-l-orange-400'}`}>
      <div className="flex items-start gap-4">
        {/* Photo */}
        {trade.photo_url ? (
          <div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden bg-muted">
            <Image
              src={trade.photo_url}
              alt={trade.full_name}
              width={48}
              height={48}
              className="object-cover w-full h-full"
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          </div>
        ) : (
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-lg font-semibold">
            {trade.full_name[0]}
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/politicians/${trade.politician_id}`}
                  className="font-semibold text-base hover:underline"
                >
                  {trade.full_name}
                </Link>
                {trade.party && (
                  <span
                    className={`text-xs font-medium px-1.5 py-0.5 rounded ${partyClass(trade.party)}`}
                  >
                    {partyLetter(trade.party)}
                    {trade.state ? `-${trade.state}` : ''}
                  </span>
                )}
                {trade.role && (
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                    {trade.role}
                  </span>
                )}
                {daysBeforeHearing !== undefined && (
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                    {daysBeforeHearing}d before {nearestHearing?.meeting_type || 'hearing'}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {trade.role ? `${trade.role} of ` : 'Member of '}
                {trade.committee_name}
              </p>
            </div>

            {/* Right: badge + amount */}
            <div className="flex flex-col items-end gap-1">
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded border ${
                  buy
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                    : 'bg-orange-500/15 text-orange-400 border-orange-500/20'
                }`}
              >
                {buy ? '▲ Buy' : '▼ Sell'}
              </span>
              <span className="text-sm font-medium">
                {formatAmount(trade.amount_lower, trade.amount_upper)}
              </span>
            </div>
          </div>

          {/* Ticker row */}
          <div className="mt-2 flex items-center gap-2 flex-wrap text-sm">
            <span className="font-mono font-bold text-sm bg-muted px-1.5 py-0.5 rounded">
              {trade.ticker}
            </span>
            {trade.company_name && (
              <span className="text-muted-foreground">{trade.company_name}</span>
            )}
            {trade.sector && (
              <span className="text-muted-foreground">• {trade.sector} sector</span>
            )}
            <span className="text-muted-foreground">
              • Traded:{' '}
              {new Date(trade.trade_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>

          {/* Conflict reason */}
          <p className="mt-2 text-sm italic text-amber-700">
            Conflict: {trade.conflict_reason} — traded {trade.sector} stock
          </p>
        </div>
      </div>
    </div>
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

  // Compute pre-hearing trades
  const preHearingTrades = useMemo<TradeWithProximity[]>(() => {
    if (hearings.hearings.length === 0) return []

    return trades.trades
      .filter((t) => {
        if (selectedCommittee && t.committee_code !== selectedCommittee) return false
        return true
      })
      .flatMap((trade) => {
        const tradeDate = parseDate(trade.trade_date)
        // Find hearings for the same committee that fall within windowDays AFTER the trade
        const relevantHearings = hearings.hearings.filter((h) => {
          if (h.committee_code !== trade.committee_code) return false
          const hearingDate = parseDate(h.hearing_date)
          const diff = daysBetween(tradeDate, hearingDate)
          return diff >= 0 && diff <= windowDays
        })
        if (relevantHearings.length === 0) return []
        // Pick the closest upcoming hearing
        const nearest = relevantHearings.reduce((a, b) => {
          const da = daysBetween(tradeDate, parseDate(a.hearing_date))
          const db = daysBetween(tradeDate, parseDate(b.hearing_date))
          return da <= db ? a : b
        })
        const daysBeforeHearing = daysBetween(tradeDate, parseDate(nearest.hearing_date))
        return [{ ...trade, nearestHearing: nearest, daysBeforeHearing }]
      })
      .sort((a, b) => (a.daysBeforeHearing ?? 999) - (b.daysBeforeHearing ?? 999))
  }, [trades.trades, hearings.hearings, windowDays, selectedCommittee])

  // Filtered all-conflicts list
  const filteredTrades = useMemo(() => {
    setPage(0)
    const q = search.toLowerCase().trim()
    return trades.trades.filter((t) => {
      if (q && !t.full_name.toLowerCase().includes(q) && !t.ticker.toLowerCase().includes(q)) {
        return false
      }
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
    <div className="min-h-screen bg-background">
      {/* Dark header */}
      <div className="bg-slate-900 text-white px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start gap-3 mb-2">
            <span className="text-2xl mt-0.5">&#9888;</span>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Committee Conflict Tracker</h1>
              <p className="text-slate-300 mt-1 text-sm">
                Trades where members sit on oversight committees for the sector they traded in
              </p>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <strong>Note:</strong> These trades are not illegal. The STOCK Act requires disclosure but
            permits trading. Conflicts are based on committee oversight areas and do not imply wrongdoing.
          </div>

          {/* Stats row */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Conflicts', value: summary.total_flagged_trades.toLocaleString() },
              { label: 'Est. Volume', value: formatDollar(summary.dollar_vol_est) },
              { label: 'Members', value: summary.total_members_implicated.toLocaleString() },
              { label: 'Committees', value: summary.total_committees.toLocaleString() },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-800 rounded-lg px-4 py-3">
                <p className="text-2xl font-bold tabular-nums text-white">{value}</p>
                <p className="text-sm text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Committee Scorecards */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Committee Scorecards</h2>
            {selectedCommittee && (
              <button
                onClick={() => setSelectedCommittee(null)}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Clear filter
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
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
        <section className="bg-card rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-bold">Trade & Hearing Timeline</h2>
              <p className="text-sm text-muted-foreground">
                Bars = conflict trades per month. Red dashed lines = committee hearings.
                Amber shading = {windowDays}-day pre-hearing window.
              </p>
            </div>
            {/* Window toggle */}
            <div className="flex rounded-md border border-input overflow-hidden text-sm">
              {([7, 30] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setWindowDays(d)}
                  className={`px-4 py-2 transition-colors ${
                    windowDays === d
                      ? 'bg-amber-500 text-white font-semibold'
                      : 'bg-background text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {d} days
                </button>
              ))}
            </div>
          </div>
          {hearings.hearings.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              No hearing data yet. Run <code className="mx-1 px-1 rounded bg-muted">/internal/enrich-hearings</code> to populate.
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
          <section className="rounded-xl border border-amber-200 bg-amber-50">
            <div className="px-6 py-4 border-b border-amber-200">
              <h2 className="text-xl font-bold text-amber-900">
                &#9889; {preHearingTrades.length} trade{preHearingTrades.length !== 1 ? 's' : ''} within {windowDays} days before a committee hearing
              </h2>
              <p className="text-sm text-amber-700 mt-1">
                Sorted by proximity to hearing — closest (most suspicious) first.
              </p>
            </div>
            <div className="p-6 space-y-4">
              {preHearingTrades.slice(0, 20).map((trade) => (
                <TradeCard
                  key={`pre-${trade.trade_id}-${trade.committee_code}`}
                  trade={trade}
                  nearestHearing={trade.nearestHearing}
                  daysBeforeHearing={trade.daysBeforeHearing}
                />
              ))}
              {preHearingTrades.length > 20 && (
                <p className="text-sm text-amber-700 text-center pt-2">
                  + {preHearingTrades.length - 20} more pre-hearing trades (filter by committee above to narrow)
                </p>
              )}
            </div>
          </section>
        )}

        {/* All conflicts */}
        <section>
          <h2 className="text-xl font-bold mb-4">All Conflict Trades</h2>

          {/* Filters */}
          <div className="mb-5 flex flex-wrap gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or ticker..."
              className="flex-1 min-w-48 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex rounded-md border border-input overflow-hidden text-sm">
              {(['All', 'House', 'Senate'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setChamber(c)}
                  className={`px-3 py-2 transition-colors ${
                    chamber === c
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="flex rounded-md border border-input overflow-hidden text-sm">
              {(['All', 'Purchase', 'Sale'] as const).map((tx) => (
                <button
                  key={tx}
                  onClick={() => setTxFilter(tx)}
                  className={`px-3 py-2 transition-colors ${
                    txFilter === tx
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {tx}
                </button>
              ))}
            </div>
          </div>

          {/* Count + page-size selector */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">
              {filteredTrades.length.toLocaleString()} flagged trade{filteredTrades.length !== 1 ? 's' : ''}
              {filteredTrades.length !== trades.total && ` (of ${trades.total.toLocaleString()} total)`}
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Show</span>
              <div className="flex rounded-md border border-input overflow-hidden">
                {([20, 50, 100] as const).map((n) => (
                  <button
                    key={n}
                    onClick={() => { setPageSize(n); setPage(0) }}
                    className={`px-3 py-1.5 transition-colors ${
                      pageSize === n
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : 'bg-background text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredTrades.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              No conflicts match your filters.
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {paginated.map((trade) => (
                  <TradeCard
                    key={`${trade.trade_id}-${trade.committee_code}`}
                    trade={trade}
                  />
                ))}
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-4 py-2 text-sm rounded-md border border-input bg-background disabled:opacity-40 hover:bg-accent transition-colors"
                  >
                    ← Previous
                  </button>
                  <span className="text-sm text-muted-foreground">
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-4 py-2 text-sm rounded-md border border-input bg-background disabled:opacity-40 hover:bg-accent transition-colors"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
