'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import {
  Activity, Users, TrendingUp, Award, DollarSign, Calendar,
} from 'lucide-react'
import { FollowButton } from '@/components/follow-button'
import { PaywallGate } from '@/components/paywall-gate'
import type { TickerTradeEntry } from '@/lib/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const PARTY_COLORS: Record<string, string> = {
  Republican:  '#f87171',
  Democrat:    '#60a5fa',
  Independent: '#a78bfa',
}

const CHAMBER_COLORS: Record<string, string> = {
  House:  '#2dd4bf',
  Senate: '#fbbf24',
}

const PERIODS = [
  { label: '30D', days: 30 },
  { label: '3M',  days: 90 },
  { label: '6M',  days: 180 },
  { label: '1Y',  days: 365 },
  { label: 'All', days: 0 },
] as const

const TIERS = [
  { level: 1, label: '$',    range: '<$15K',       min: 0,      max: 15000 },
  { level: 2, label: '$$',   range: '$15K–$100K',  min: 15001,  max: 100000 },
  { level: 3, label: '$$$',  range: '$100K–$500K', min: 100001, max: 500000 },
  { level: 4, label: '$$$$', range: '$500K+',      min: 500001, max: Infinity },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function isBuy(t: TickerTradeEntry) {
  return t.transaction_type === 'Purchase'
}

function getTier(lower: number | null) {
  const n = lower ?? 0
  return TIERS.find(t => n >= t.min && n <= t.max) ?? TIERS[0]
}

function fmtVolume(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

function midpoint(lower: number | null, upper: number | null): number {
  if (!lower) return 0
  return upper ? Math.round((lower + upper) / 2) : lower
}

function filterByDays(trades: TickerTradeEntry[], days: number): TickerTradeEntry[] {
  if (!days) return trades
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return trades.filter(t => t.trade_date >= cutoffStr)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  )
}

/** Star-rating style amount: filled $ in buy/sell color, faded for unused slots, range underneath */
function AmountBadge({ trade }: { trade: TickerTradeEntry }) {
  const tier = getTier(trade.amount_lower)
  const buy = isBuy(trade)
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className="font-mono text-sm font-bold leading-none tracking-tight">
        <span className={buy ? 'text-emerald-400' : 'text-red-400'}>
          {'$'.repeat(tier.level)}
        </span>
        <span className={buy ? 'text-emerald-400/20' : 'text-red-400/20'}>
          {'$'.repeat(4 - tier.level)}
        </span>
      </span>
      <span className="text-[9px] text-muted-foreground leading-none">{tier.range}</span>
    </div>
  )
}

function StatRow({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType
  label: string
  value: string
  accent?: string
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3 w-3 shrink-0" />
        {label}
      </div>
      <span className={`text-sm font-semibold tabular-nums ${accent ?? 'text-foreground'}`}>
        {value}
      </span>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-border/60 bg-background px-3 py-2 text-xs shadow-lg">
      {label && <p className="font-medium mb-1">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color ?? p.fill }}>
          {p.name}: <span className="font-mono tabular-nums">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

/** Donut chart with inline legend */
function DonutPanel({
  title,
  data,
  colorMap,
  labelKey,
}: {
  title: string
  data: { name: string; value: number }[]
  colorMap: Record<string, string>
  labelKey?: string
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div className="rounded-xl border border-border/60 bg-card/30 p-4">
      <PanelTitle>{title}</PanelTitle>
      <div className="flex items-center gap-3">
        <div className="shrink-0">
          <ResponsiveContainer width={100} height={100}>
            <PieChart>
              <Pie
                data={data}
                cx="50%" cy="50%"
                innerRadius={30} outerRadius={46}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={colorMap[entry.name] ?? '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <div className="rounded-md border border-border/60 bg-background px-2 py-1.5 text-xs shadow-lg">
                      <p style={{ color: colorMap[payload[0].name as string] ?? '#94a3b8' }}>
                        {payload[0].name}: {payload[0].value}
                      </p>
                    </div>
                  ) : null
                }
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-1.5 min-w-0">
          {data.map((entry) => (
            <div key={entry.name} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: colorMap[entry.name] ?? '#94a3b8' }}
              />
              <span className="text-xs truncate">{entry.name}</span>
              <span className="ml-auto text-xs tabular-nums text-muted-foreground shrink-0">
                {entry.value}
                <span className="text-muted-foreground/50 ml-1">
                  ({total ? Math.round((entry.value / total) * 100) : 0}%)
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export function TickerDashboard({
  ticker,
  companyName,
  sector,
  sectorSlug,
  allTrades,
  isSignedIn = true,
}: {
  ticker: string
  companyName: string | null
  sector: string | null
  sectorSlug: string | null
  allTrades: TickerTradeEntry[]
  isSignedIn?: boolean
}) {
  const [periodIdx, setPeriodIdx] = useState(4) // default "All"
  const period = PERIODS[periodIdx]

  const trades = useMemo(
    () => filterByDays(allTrades, period.days),
    [allTrades, period.days],
  )

  // ── Derived stats ──────────────────────────────────────────────────────────

  const buyCount  = useMemo(() => trades.filter(isBuy).length, [trades])
  const sellCount = trades.length - buyCount
  const buyPct    = trades.length ? Math.round((buyCount / trades.length) * 100) : 0

  const uniqueMembers = useMemo(
    () => new Set(trades.map(t => t.politician_id)).size,
    [trades],
  )

  const estVolume = useMemo(
    () => trades.reduce((sum, t) => sum + midpoint(t.amount_lower, t.amount_upper), 0),
    [trades],
  )

  const mostRecentDate = trades[0]?.trade_date ?? '—'

  const partyCount = useMemo(() => {
    const m: Record<string, number> = {}
    for (const t of trades) { const p = t.party || 'Unknown'; m[p] = (m[p] ?? 0) + 1 }
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [trades])

  const topParty = partyCount[0]?.[0] ?? '—'

  const chamberCount = useMemo(() => {
    const m: Record<string, number> = {}
    for (const t of trades) { const c = t.chamber || 'Unknown'; m[c] = (m[c] ?? 0) + 1 }
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [trades])

  const monthlyData = useMemo(() => {
    const m: Record<string, { month: string; Buys: number; Sells: number }> = {}
    for (const t of trades) {
      const month = t.trade_date.substring(0, 7)
      if (!m[month]) m[month] = { month, Buys: 0, Sells: 0 }
      if (isBuy(t)) m[month].Buys++; else m[month].Sells++
    }
    return Object.values(m).sort((a, b) => a.month.localeCompare(b.month))
  }, [trades])

  const partyDonut = useMemo(() =>
    partyCount.map(([name, value]) => ({ name, value })),
    [partyCount],
  )

  const chamberDonut = useMemo(() =>
    chamberCount.map(([name, value]) => ({ name, value })),
    [chamberCount],
  )

  const buySellDonut = [
    { name: 'Buy',  value: buyCount  },
    { name: 'Sell', value: sellCount },
  ]

  const amountData = useMemo(() =>
    TIERS.map(tier => ({
      label: tier.label,
      range: tier.range,
      count: trades.filter(t => { const n = t.amount_lower ?? 0; return n >= tier.min && n <= tier.max }).length,
    })),
    [trades],
  )

  const topTraders = useMemo(() => {
    const m: Record<string, {
      politician_id: string; name: string; party: string | null
      chamber: string | null; buys: number; sells: number
    }> = {}
    for (const t of trades) {
      if (!m[t.politician_id]) m[t.politician_id] = {
        politician_id: t.politician_id, name: t.full_name,
        party: t.party, chamber: t.chamber, buys: 0, sells: 0,
      }
      if (isBuy(t)) m[t.politician_id].buys++; else m[t.politician_id].sells++
    }
    return Object.values(m).sort((a, b) => (b.buys + b.sells) - (a.buys + a.sells)).slice(0, 10)
  }, [trades])

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr_240px]">

      {/* ── Left column ───────────────────────────────────────────────────── */}
      <div className="space-y-4">

        {/* Ticker header + period filter */}
        <div className="rounded-xl border border-border/60 bg-card/30 p-4">
          <h1 className="text-2xl font-bold tracking-tight font-mono text-primary">{ticker}</h1>
          {companyName && (
            <p className="text-muted-foreground text-xs mt-0.5 truncate">{companyName}</p>
          )}
          {sector && (
            <div className="mt-1.5">
              {sectorSlug ? (
                <Link
                  href={`/sectors/${sectorSlug}`}
                  className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary/80 hover:bg-primary/20 hover:text-primary transition-colors"
                >
                  {sector}
                </Link>
              ) : (
                <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary/80">
                  {sector}
                </span>
              )}
            </div>
          )}
          <div className="mt-3">
            <FollowButton type="ticker" refId={ticker} />
          </div>
          <div className="flex flex-wrap gap-1 mt-3">
            {PERIODS.map((p, i) => (
              <button
                key={p.label}
                onClick={() => setPeriodIdx(i)}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  i === periodIdx
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats collapsed under ticker */}
        <div className="rounded-xl border border-border/60 bg-card/30 px-4 py-3">
          <StatRow icon={Activity}   label="Trades"      value={String(trades.length)} />
          <StatRow icon={Users}      label="Members"     value={String(uniqueMembers)} />
          <StatRow
            icon={TrendingUp}
            label="Buy Rate"
            value={`${buyPct}% (${buyCount}B · ${sellCount}S)`}
            accent={buyPct >= 50 ? 'text-emerald-400' : 'text-red-400'}
          />
          <StatRow
            icon={Award}
            label="Top Party"
            value={topParty}
            accent={topParty === 'Democrat' ? 'text-blue-400' : topParty === 'Republican' ? 'text-red-400' : undefined}
          />
          <StatRow icon={DollarSign} label="Est. Volume" value={fmtVolume(estVolume)} />
          <StatRow icon={Calendar}   label="Most Recent" value={mostRecentDate} />
        </div>

        {/* Party donut */}
        <DonutPanel
          title="By Party"
          data={partyDonut}
          colorMap={PARTY_COLORS}
        />

        {/* Chamber donut */}
        <DonutPanel
          title="By Chamber"
          data={chamberDonut}
          colorMap={CHAMBER_COLORS}
        />

        {/* Trade size distribution */}
        <div className="rounded-xl border border-border/60 bg-card/30 p-4">
          <PanelTitle>Trade Size</PanelTitle>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={amountData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.3} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)', fontFamily: 'monospace', fontWeight: 700 }}
              />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false}
                tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} />
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <div className="rounded-md border border-border/60 bg-background px-3 py-2 text-xs shadow-lg">
                      <p className="text-muted-foreground">{amountData.find(d => d.label === payload[0]?.payload?.label)?.range}</p>
                      <p className="font-mono font-semibold">{payload[0].value} trades</p>
                    </div>
                  ) : null
                }
              />
              <Bar dataKey="count" name="Trades" radius={[4, 4, 0, 0]} fill="var(--primary)" fillOpacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5">
            {TIERS.map(t => (
              <span key={t.label} className="flex items-baseline gap-1 text-[9px] text-muted-foreground">
                <span className="font-mono font-bold">{t.label}</span>
                <span className="truncate">{t.range}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <PaywallGate locked={!isSignedIn} className="lg:col-span-2">
      {/* ── Center column ─────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {trades.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card/30 py-16 text-center text-muted-foreground">
            No trades in the selected period.
          </div>
        ) : (
          <>
            {/* Timeline */}
            <div className="rounded-xl border border-border/60 bg-card/30 p-4">
              <PanelTitle>Monthly Activity — Buys vs Sells</PanelTitle>
              <ResponsiveContainer width="100%" height={190}>
                <AreaChart data={monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="buyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#34d399" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="sellGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#f87171" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.3} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false}
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    interval="preserveStartEnd" />
                  <YAxis tickLine={false} axisLine={false} width={24} allowDecimals={false}
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Buys"  stroke="#34d399" strokeWidth={2} fill="url(#buyGrad)" />
                  <Area type="monotone" dataKey="Sells" stroke="#f87171" strokeWidth={2} fill="url(#sellGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Trade history — scrollable */}
            <div className="rounded-xl border border-border/60 bg-card/30">
              <div className="px-4 pt-4 pb-2">
                <PanelTitle>Trade History</PanelTitle>
              </div>
              <div className="max-h-[520px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card/95 backdrop-blur-sm">
                    <tr className="border-b border-border/60 text-left">
                      <th className="px-4 py-2 font-medium text-muted-foreground text-xs">Member</th>
                      <th className="px-4 py-2 font-medium text-muted-foreground text-xs hidden md:table-cell">Affiliation</th>
                      <th className="px-4 py-2 font-medium text-muted-foreground text-xs">Type</th>
                      <th className="px-4 py-2 font-medium text-muted-foreground text-xs">Size</th>
                      <th className="px-4 py-2 font-medium text-muted-foreground text-xs">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((trade) => (
                      <tr key={trade.trade_id} className="border-b border-border/60 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/politicians/${trade.politician_id}`}
                            className="font-medium hover:text-primary transition-colors"
                          >
                            {trade.full_name}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs hidden md:table-cell">
                          {[trade.chamber, trade.party].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge
                            variant="outline"
                            className={`text-xs ${isBuy(trade)
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                              : 'bg-red-500/15 text-red-400 border-red-500/20'
                            }`}
                          >
                            {isBuy(trade) ? 'Buy' : 'Sell'}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          <AmountBadge trade={trade} />
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-muted-foreground text-xs">
                          {trade.trade_date}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top traders — full width below trade history */}
            <div className="rounded-xl border border-border/60 bg-card/30 p-4">
              <PanelTitle>Top Traders</PanelTitle>
              <div className="divide-y divide-border/60">
                {topTraders.map((trader, i) => {
                  const total = trader.buys + trader.sells
                  const buyWidth = total ? Math.round((trader.buys / total) * 100) : 0
                  return (
                    <div
                      key={trader.politician_id}
                      className="flex items-center gap-3 py-2.5"
                    >
                      <span className="w-5 shrink-0 text-center text-[10px] font-semibold text-muted-foreground tabular-nums">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/politicians/${trader.politician_id}`}
                            className="text-sm font-medium hover:text-primary transition-colors truncate"
                          >
                            {trader.name}
                          </Link>
                          {trader.party && (
                            <span className="text-[10px] font-medium shrink-0" style={{ color: PARTY_COLORS[trader.party] ?? '#94a3b8' }}>
                              {trader.party[0]}
                            </span>
                          )}
                          {trader.chamber && (
                            <span className="text-[10px] shrink-0 text-muted-foreground">
                              {trader.chamber}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="h-1 w-24 overflow-hidden rounded-full bg-red-400/30">
                            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${buyWidth}%` }} />
                          </div>
                          <span className="text-[10px] tabular-nums text-muted-foreground">
                            <span className="text-emerald-400">{trader.buys}B</span>
                            {' / '}
                            <span className="text-red-400">{trader.sells}S</span>
                          </span>
                        </div>
                      </div>
                      <span className="shrink-0 text-xs tabular-nums font-medium text-muted-foreground">
                        {total} trades
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Right column ──────────────────────────────────────────────────── */}
      <div className="space-y-4">

        {/* Buy vs Sell donut */}
        <DonutPanel
          title="Buy vs Sell"
          data={buySellDonut}
          colorMap={{ Buy: '#34d399', Sell: '#f87171' }}
        />
      </div>
      </PaywallGate>

    </div>
  )
}
