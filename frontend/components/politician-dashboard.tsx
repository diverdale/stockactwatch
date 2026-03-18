'use client'
import { useMemo, useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ExternalLink, Activity, BarChart2, DollarSign, Calendar, TrendingUp, MapPin, Info } from 'lucide-react'
import { FollowButton } from '@/components/follow-button'
import { PaywallGate } from '@/components/paywall-gate'
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { PoliticianSectorRadar } from '@/components/politician-sector-radar'
import { DisclosureScore } from '@/components/disclosure-score'
import { SuspicionBadge } from '@/components/suspicion-badge'
import type { PoliticianProfile, PoliticianSectorEntry, TradeEntry, AnnualReturn } from '@/lib/types'

// ── Constants ─────────────────────────────────────────────────────────────────

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

const ASSET_COLORS: Record<string, string> = {
  Stock:   '#60a5fa',
  Option:  '#f59e0b',
  Bond:    '#34d399',
  Fund:    '#a78bfa',
  Other:   '#94a3b8',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isBuy(t: TradeEntry) {
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

function filterByDays(trades: TradeEntry[], days: number): TradeEntry[] {
  if (!days) return trades
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return trades.filter(t => t.trade_date >= cutoffStr)
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
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
      <span className={`text-sm font-semibold tabular-nums truncate max-w-[120px] ${accent ?? 'text-foreground'}`}>
        {value}
      </span>
    </div>
  )
}

function AmountBadge({ trade }: { trade: TradeEntry }) {
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

function DonutPanel({
  title,
  data,
  colorMap,
}: {
  title: string
  data: { name: string; value: number }[]
  colorMap: Record<string, string>
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div className="rounded-xl border border-border/60 bg-card/30 p-4">
      <PanelTitle>{title}</PanelTitle>
      <div className="flex items-center gap-3">
        <div className="shrink-0">
          <ResponsiveContainer width={90} height={90}>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={27} outerRadius={42}
                paddingAngle={2} dataKey="value" strokeWidth={0}>
                {data.map((entry) => (
                  <Cell key={entry.name} fill={colorMap[entry.name] ?? '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className="rounded-md border border-border/60 bg-background px-2 py-1.5 text-xs shadow-lg">
                    <p style={{ color: colorMap[payload[0].name as string] ?? '#94a3b8' }}>
                      {payload[0].name}: {payload[0].value}
                    </p>
                  </div>
                ) : null
              } />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-1.5 min-w-0">
          {data.map((entry) => (
            <div key={entry.name} className="flex items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorMap[entry.name] ?? '#94a3b8' }} />
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

// ── Annual Returns Panel ──────────────────────────────────────────────────────

function AnnualReturnsPanel({ politicianId }: { politicianId: string }) {
  const [entries, setEntries] = useState<AnnualReturn[]>([])
  const [loading, setLoading] = useState(true)
  const [showNote, setShowNote] = useState(false)

  useEffect(() => {
    fetch(`/api/politician-annual-returns?id=${politicianId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setEntries(data?.entries ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [politicianId])

  if (loading) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/30 px-4 py-3 animate-pulse">
        <div className="h-3 w-28 rounded bg-muted/40 mb-3" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-2 py-1.5 border-b border-border/30 last:border-0">
            <div className="h-3 w-10 rounded bg-muted/30" />
            <div className="ml-auto h-3 w-12 rounded bg-muted/20" />
            <div className="h-3 w-12 rounded bg-muted/20" />
            <div className="h-3 w-10 rounded bg-muted/20" />
          </div>
        ))}
      </div>
    )
  }

  if (!entries.length) return null

  return (
    <div className="rounded-xl border border-border/60 bg-card/30 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Annual Returns (Est.)
        </p>
        <button
          onClick={() => setShowNote(n => !n)}
          className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          title="Methodology note"
        >
          <Info className="h-3 w-3" />
        </button>
      </div>

      {showNote && (
        <p className="text-[10px] text-muted-foreground/70 leading-relaxed mb-2 border-b border-border/30 pb-2">
          Entry = closing price on trade date. Exit = Dec 31 close (or today for current year).
          Weighted by disclosed amount midpoint. Options excluded. Estimates only.
        </p>
      )}

      {/* Header row */}
      <div className="grid grid-cols-4 gap-1 mb-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">
        <span>Year</span>
        <span className="text-right">Return</span>
        <span className="text-right">S&amp;P 500</span>
        <span className="text-right">Alpha</span>
      </div>

      {entries.map(e => {
        const ret = e.weighted_return_pct
        const sp = e.avg_sp500_return_pct
        const alpha = e.alpha
        const retColor = ret === null ? 'text-muted-foreground' : ret >= 0 ? 'text-emerald-400' : 'text-red-400'
        const alphaColor = alpha === null ? 'text-muted-foreground' : alpha >= 0 ? 'text-emerald-400' : 'text-red-400'
        return (
          <div
            key={e.year}
            className="grid grid-cols-4 gap-1 py-1.5 border-b border-border/30 last:border-0 text-xs tabular-nums"
          >
            <span className="font-medium">{e.year}</span>
            <span className={`text-right font-semibold ${retColor}`}>
              {ret !== null ? `${ret >= 0 ? '+' : ''}${ret.toFixed(1)}%` : '—'}
            </span>
            <span className="text-right text-muted-foreground">
              {sp !== null ? `${sp >= 0 ? '+' : ''}${sp.toFixed(1)}%` : '—'}
            </span>
            <span className={`text-right font-semibold ${alphaColor}`}>
              {alpha !== null ? `${alpha >= 0 ? '+' : ''}${alpha.toFixed(1)}%` : '—'}
            </span>
          </div>
        )
      })}

      <p className="text-[9px] text-muted-foreground/40 mt-2">
        {entries[0]?.priced_count}/{entries[0]?.trade_count} trades priced in {entries[0]?.year}
      </p>
    </div>
  )
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export function PoliticianDashboard({ profile, sectors, isSignedIn = true }: { profile: PoliticianProfile; sectors?: PoliticianSectorEntry[]; isSignedIn?: boolean }) {
  const [periodIdx, setPeriodIdx] = useState(4)
  const [tradePage, setTradePage] = useState(0)
  const [tradePageSize, setTradePageSize] = useState<10 | 25 | 50 | 100>(25)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(true)
  const [aiOpen, setAiOpen] = useState(true)
  const [sortCol, setSortCol] = useState<string>('trade_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const period = PERIODS[periodIdx]

  const trades = useMemo(() => {
    setTradePage(0)
    return filterByDays(profile.trades, period.days)
  }, [profile.trades, period.days])

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
    setTradePage(0)
  }

  const sortedTrades = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...trades].sort((a, b) => {
      switch (sortCol) {
        case 'ticker':      return dir * (a.company_name ?? a.ticker).localeCompare(b.company_name ?? b.ticker)
        case 'asset_type':  return dir * (a.asset_type ?? '').localeCompare(b.asset_type ?? '')
        case 'type':        return dir * (a.transaction_type ?? '').localeCompare(b.transaction_type ?? '')
        case 'size':        return dir * ((a.amount_lower ?? 0) - (b.amount_lower ?? 0))
        case 'return':      return dir * ((a.avg_return_pct ?? 0) - (b.avg_return_pct ?? 0))
        case 'suspicion':   return dir * ((a.suspicion_score ?? 0) - (b.suspicion_score ?? 0))
        case 'trade_date':  return dir * a.trade_date.localeCompare(b.trade_date)
        default:            return 0
      }
    })
  }, [trades, sortCol, sortDir])

  const tradePages = Math.ceil(sortedTrades.length / tradePageSize)
  const pagedTrades = sortedTrades.slice(tradePage * tradePageSize, (tradePage + 1) * tradePageSize)

  // ── Derived stats ──────────────────────────────────────────────────────────

  const buyCount  = useMemo(() => trades.filter(isBuy).length, [trades])
  const sellCount = trades.length - buyCount
  const buyPct    = trades.length ? Math.round((buyCount / trades.length) * 100) : 0

  const uniqueIssuers = useMemo(
    () => new Set(trades.map(t => t.ticker)).size,
    [trades],
  )

  const estVolume = useMemo(
    () => trades.reduce((sum, t) => sum + midpoint(t.amount_lower, t.amount_upper), 0),
    [trades],
  )

  const lastTradeDate = trades[0]?.trade_date ?? '—'

  const avgFilingLag = useMemo(() => {
    const lags = trades
      .filter(t => t.trade_date && t.disclosure_date)
      .map(t => Math.round(
        (new Date(t.disclosure_date).getTime() - new Date(t.trade_date).getTime())
        / (1000 * 60 * 60 * 24)
      ))
      .filter(d => d >= 0 && d <= 3650)
    if (!lags.length) return null
    return Math.round(lags.reduce((s, d) => s + d, 0) / lags.length)
  }, [trades])

  const avgReturn = useMemo(() => {
    const calc = trades.filter(t => t.return_calculable && t.avg_return_pct !== null)
    if (!calc.length) return null
    const avg = calc.reduce((s, t) => s + Number(t.avg_return_pct), 0) / calc.length
    return avg
  }, [trades])

  const totalEstReturnDollars = useMemo(() => {
    const calc = trades.filter(t => t.return_calculable && t.avg_return_pct !== null)
    if (!calc.length) return null
    return calc.reduce((sum, t) => {
      const mid = midpoint(t.amount_lower, t.amount_upper)
      return sum + mid * Number(t.avg_return_pct) / 100
    }, 0)
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

  const assetDonut = useMemo(() => {
    const m: Record<string, number> = {}
    for (const t of trades) {
      const key = t.asset_type
        ? t.asset_type.charAt(0).toUpperCase() + t.asset_type.slice(1).toLowerCase()
        : 'Other'
      m[key] = (m[key] ?? 0) + 1
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))
  }, [trades])

  const topTickers = useMemo(() => {
    const m: Record<string, { ticker: string; buys: number; sells: number }> = {}
    for (const t of trades) {
      if (!m[t.ticker]) m[t.ticker] = { ticker: t.ticker, buys: 0, sells: 0 }
      if (isBuy(t)) m[t.ticker].buys++; else m[t.ticker].sells++
    }
    return Object.values(m).sort((a, b) => (b.buys + b.sells) - (a.buys + a.sells)).slice(0, 8)
  }, [trades])

  useEffect(() => {
    setAiLoading(true)
    fetch(`/api/politician-summary?id=${profile.politician_id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setAiSummary(data?.summary ?? null)
        setAiLoading(false)
      })
      .catch(() => setAiLoading(false))
  }, [profile.politician_id])

  // ── Party styling ──────────────────────────────────────────────────────────

  const partyGradient =
    profile.party === 'Democrat'    ? 'from-blue-600/50 via-blue-900/40 to-transparent' :
    profile.party === 'Republican'  ? 'from-red-600/50 via-red-900/40 to-transparent' :
                                      'from-gray-600/40 via-gray-900/30 to-transparent'

  const partyBadgeClass =
    profile.party === 'Democrat'    ? 'border-blue-500/30 bg-blue-500/15 text-blue-400' :
    profile.party === 'Republican'  ? 'border-red-500/30 bg-red-500/15 text-red-400' :
                                      'border-border/50 text-muted-foreground'

  const ini = initials(profile.full_name)

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr_240px]">

      {/* ── Left column ───────────────────────────────────────────────────── */}
      <div className="space-y-4">

        {/* Photo + identity card */}
        <div className="rounded-xl border border-border/60 overflow-hidden bg-card/30">
          {/* Hero gradient + photo */}
          <div className={`relative flex justify-center bg-gradient-to-b ${partyGradient} pt-6 pb-0`}>
            {profile.photo_url ? (
              <Image
                src={profile.photo_url}
                alt={profile.full_name}
                width={120}
                height={148}
                className="object-cover object-top rounded-t-lg"
                onError={(e) => {
                  const el = e.currentTarget as HTMLImageElement
                  el.style.display = 'none'
                  el.nextElementSibling?.classList.remove('hidden')
                }}
              />
            ) : null}
            {/* Fallback initials */}
            <div
              className={`${profile.photo_url ? 'hidden' : 'flex'} h-36 w-28 items-center justify-center text-5xl font-bold text-white/20`}
            >
              {ini}
            </div>
          </div>

          {/* Name + badges */}
          <div className="px-4 py-4 text-center border-t border-border/40">
            <h1 className="text-lg font-bold tracking-tight leading-snug">{profile.full_name}</h1>
            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
              {profile.party && (
                <Badge variant="outline" className={`text-xs ${partyBadgeClass}`}>
                  {profile.party}
                </Badge>
              )}
              {profile.chamber && (
                <Badge variant="outline" className="text-xs border-border/50 text-muted-foreground">
                  {profile.chamber}
                </Badge>
              )}
              {profile.state && (
                <Badge variant="outline" className="text-xs border-border/50 text-muted-foreground">
                  {profile.state}
                  {profile.chamber === 'House' && profile.district != null
                    ? `-${profile.district}`
                    : ''}
                </Badge>
              )}
            </div>
            {profile.trades.length > 0 && (
              <div className="mt-2 flex justify-center">
                <DisclosureScore trades={profile.trades} />
              </div>
            )}
            <div className="mt-3 flex justify-center">
              <FollowButton type="politician" refId={profile.politician_id} />
            </div>
          </div>

          {/* Period filter */}
          <div className="px-4 pb-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Period</p>
            <div className="flex flex-wrap gap-1">
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
        </div>

        {/* Stats */}
        <div className="rounded-xl border border-border/60 bg-card/30 px-4 py-3">
          {profile.state && (
            <StatRow
              icon={MapPin}
              label="District"
              value={
                profile.chamber === 'House' && profile.district != null
                  ? `${profile.state}-${profile.district}`
                  : profile.state
              }
            />
          )}
          <StatRow icon={Activity}   label="Trades"       value={String(trades.length)} />
          <StatRow icon={BarChart2}  label="Issuers"      value={String(uniqueIssuers)} />
          <StatRow icon={DollarSign} label="Est. Volume"  value={fmtVolume(estVolume)} />
          <StatRow icon={Calendar}   label="Last Trade"   value={lastTradeDate} />
          {avgFilingLag !== null && (
            <StatRow
              icon={Calendar}
              label="Avg Filing Lag"
              value={`${avgFilingLag}d`}
              accent={avgFilingLag <= 20 ? 'text-emerald-600 dark:text-emerald-400' : avgFilingLag <= 45 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}
            />
          )}
          {avgReturn !== null && (
            <StatRow
              icon={TrendingUp}
              label="Avg Return"
              value={`${avgReturn >= 0 ? '+' : ''}${avgReturn.toFixed(1)}%`}
              accent={avgReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}
            />
          )}
          {totalEstReturnDollars !== null && (
            <StatRow
              icon={DollarSign}
              label="Est. Return $"
              value={`${totalEstReturnDollars >= 0 ? '+' : ''}${fmtVolume(Math.abs(totalEstReturnDollars))}${totalEstReturnDollars < 0 ? ' loss' : ''}`}
              accent={totalEstReturnDollars >= 0 ? 'text-emerald-400' : 'text-red-400'}
            />
          )}
          <StatRow
            icon={TrendingUp}
            label="Buy Rate"
            value={`${buyPct}% (${buyCount}B · ${sellCount}S)`}
            accent={buyPct >= 50 ? 'text-emerald-400' : 'text-red-400'}
          />
        </div>

        {/* Annual returns */}
        <AnnualReturnsPanel politicianId={profile.politician_id} />

        {/* Social / external links */}
        {profile.bio_guide_id && (
          <div className="rounded-xl border border-border/60 bg-card/30 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Links</p>
            <a
              href={`https://bioguide.congress.gov/search/bio/${profile.bio_guide_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              Congress Bioguide
            </a>
          </div>
        )}

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
            {/* Monthly buy/sell timeline */}
            <div className="rounded-xl border border-border/60 bg-card/30 p-4">
              <PanelTitle>Monthly Activity — Buys vs Sells</PanelTitle>
              <ResponsiveContainer width="100%" height={190}>
                <AreaChart data={monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="polBuyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#34d399" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="polSellGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#f87171" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.3} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} interval="preserveStartEnd"
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                  <YAxis tickLine={false} axisLine={false} width={24} allowDecimals={false}
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Buys"  stroke="#34d399" strokeWidth={2} fill="url(#polBuyGrad)" />
                  <Area type="monotone" dataKey="Sells" stroke="#f87171" strokeWidth={2} fill="url(#polSellGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Trade history — paginated */}
            <div className="rounded-xl border border-border/60 bg-card/30">
              <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                <PanelTitle>Trade History</PanelTitle>
                <span className="text-xs text-muted-foreground">
                  {sortedTrades.length} trade{sortedTrades.length !== 1 ? 's' : ''}
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left bg-muted/20">
                    {([
                      { col: 'ticker',     label: 'Stock',       cls: '' },
                      { col: 'asset_type', label: 'Asset',       cls: 'hidden sm:table-cell' },
                      { col: 'type',       label: 'Type',        cls: '' },
                      { col: 'size',       label: 'Size',        cls: '' },
                      { col: 'return',     label: 'Return',      cls: '' },
                      { col: 'suspicion',  label: '✦ Suspicion', cls: '', gradient: true },
                      { col: 'trade_date', label: 'Trade Date',  cls: '' },
                    ] as { col: string; label: string; cls: string; gradient?: boolean }[]).map(({ col, label, cls, gradient }) => {
                      const active = sortCol === col
                      return (
                        <th key={col} className={`px-4 py-2 ${cls}`}>
                          <button
                            onClick={() => toggleSort(col)}
                            className={`flex items-center gap-0.5 text-xs font-medium cursor-pointer select-none transition-colors whitespace-nowrap ${active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                          >
                            <span className={gradient ? 'bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent font-semibold' : ''}>
                              {label}
                            </span>
                            {active
                              ? <span className="ml-0.5 text-[10px]">{sortDir === 'asc' ? '↑' : '↓'}</span>
                              : <span className="ml-0.5 text-muted-foreground/30 text-[10px]">↕</span>
                            }
                          </button>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {pagedTrades.map((trade) => {
                    const retVal = trade.avg_return_pct !== null ? Number(trade.avg_return_pct) : null
                    return (
                      <tr key={trade.trade_id} className="border-b border-border/60 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 max-w-[160px]">
                          <Link href={`/tickers/${trade.ticker}`} className="block hover:text-primary transition-colors">
                            <span className="font-semibold text-sm leading-tight block truncate">
                              {trade.company_name
                                ? trade.company_name.replace(/\s+(Inc\.?|Corp\.?|Ltd\.?|LLC\.?|Co\.?|Group|Holdings?|Technologies?|Pharmaceuticals?|Bancorp|Bancshares|International)$/i, '').trim()
                                : trade.ticker}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-mono">{trade.ticker}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                          {trade.asset_type}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge
                            variant="outline"
                            className={`text-xs ${isBuy(trade)
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                              : 'bg-orange-500/15 text-orange-400 border-orange-500/20'
                            }`}
                          >
                            {isBuy(trade) ? '▲ Buy' : '▼ Sell'}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          <AmountBadge trade={trade} />
                        </td>
                        <td className="px-4 py-2.5">
                          {!trade.return_calculable ? (
                            <span className="text-[10px] text-muted-foreground">n/a</span>
                          ) : retVal !== null ? (
                            <span className={`font-mono text-xs tabular-nums ${retVal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {retVal >= 0 ? '+' : ''}{retVal.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <SuspicionBadge score={trade.suspicion_score ?? null} flags={trade.suspicion_flags ?? null} />
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-xs">
                          <span className="text-muted-foreground">{trade.trade_date}</span>
                          {(() => {
                            const lag = Math.round(
                              (new Date(trade.disclosure_date).getTime() - new Date(trade.trade_date).getTime())
                              / (1000 * 60 * 60 * 24)
                            )
                            if (lag < 0 || lag > 3650) return null
                            return (
                              <span
                                title={`Filed ${lag} day${lag !== 1 ? 's' : ''} after trade${lag > 45 ? ' — exceeds 45-day STOCK Act limit' : ''}`}
                                className={`ml-1.5 text-[10px] cursor-help ${lag > 45 ? 'text-red-400' : 'text-muted-foreground/50'}`}
                              >
                                +{lag}d
                              </span>
                            )
                          })()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="flex items-center justify-between px-4 py-3 border-t border-border/60">
                <button
                  onClick={() => setTradePage(p => Math.max(0, p - 1))}
                  disabled={tradePage === 0}
                  className="px-3 py-1.5 text-xs rounded border border-input bg-background disabled:opacity-40 hover:bg-accent transition-colors"
                >
                  ← Prev
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {tradePages > 1 ? `${tradePage + 1} / ${tradePages}` : `${trades.length} trades`}
                  </span>
                  <div className="flex rounded border border-input overflow-hidden text-xs">
                    {([10, 25, 50, 100] as const).map(n => (
                      <button
                        key={n}
                        onClick={() => { setTradePageSize(n); setTradePage(0) }}
                        className={`px-2.5 py-1.5 transition-colors ${
                          tradePageSize === n
                            ? 'bg-primary text-primary-foreground font-semibold'
                            : 'bg-background text-muted-foreground hover:bg-accent'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setTradePage(p => Math.min(tradePages - 1, p + 1))}
                  disabled={tradePage >= tradePages - 1}
                  className="px-3 py-1.5 text-xs rounded border border-input bg-background disabled:opacity-40 hover:bg-accent transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Right column ──────────────────────────────────────────────────── */}
      <div className="space-y-4">

        {/* AI summary */}
        {(aiLoading || aiSummary) && (
          <div className="rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-100/60 via-card/40 to-indigo-100/40 dark:from-violet-950/40 dark:via-card/40 dark:to-indigo-950/30 shadow-[0_0_24px_-6px_rgba(139,92,246,0.25)]">
            <button
              onClick={() => setAiOpen(o => !o)}
              className="flex w-full items-center justify-between px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">✦</span>
                <span className="text-xs font-semibold tracking-wide bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-400 bg-clip-text text-transparent">
                  AI Trading Profile
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-violet-600/60 dark:text-violet-500/50 font-mono">claude</span>
                <span className={`text-violet-600/60 dark:text-violet-500/50 text-xs transition-transform duration-200 ${aiOpen ? 'rotate-180' : ''}`}>▾</span>
              </div>
            </button>
            {aiOpen && (
              <div className="px-4 pb-3 border-t border-violet-500/20 pt-3">
                {aiLoading ? (
                  <div className="space-y-2">
                    <div className="h-2 w-full rounded-full bg-violet-500/10 animate-pulse" />
                    <div className="h-2 w-5/6 rounded-full bg-violet-500/10 animate-pulse" />
                    <div className="h-2 w-4/6 rounded-full bg-violet-500/10 animate-pulse" />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/90 leading-relaxed">{aiSummary}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Buy vs Sell donut */}
        <DonutPanel
          title="Buy vs Sell"
          data={[
            { name: 'Buy',  value: buyCount  },
            { name: 'Sell', value: sellCount },
          ]}
          colorMap={{ Buy: '#34d399', Sell: '#f87171' }}
        />

        {/* Asset type donut */}
        <DonutPanel
          title="Asset Types"
          data={assetDonut}
          colorMap={ASSET_COLORS}
        />

        {/* Sector radar */}
        {sectors && sectors.length > 0 && (
          <div className="rounded-xl border border-border/60 bg-card/30 p-4">
            <PanelTitle>Activity by Sector</PanelTitle>
            <PoliticianSectorRadar sectors={sectors} />
          </div>
        )}

        {/* Top tickers */}
        <div className="rounded-xl border border-border/60 bg-card/30 p-4">
          <PanelTitle>Top Tickers</PanelTitle>
          <div className="space-y-0">
            {topTickers.map((item, i) => {
              const total = item.buys + item.sells
              const buyWidth = total ? Math.round((item.buys / total) * 100) : 0
              return (
                <div key={item.ticker} className="flex items-center gap-2 border-b border-border/60 py-2.5 last:border-0">
                  <span className="w-4 shrink-0 text-center text-[10px] font-semibold text-muted-foreground tabular-nums">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/tickers/${item.ticker}`}
                      className="font-mono text-sm font-semibold hover:text-primary transition-colors"
                    >
                      {item.ticker}
                    </Link>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-red-400/30">
                      <div className="h-full rounded-full bg-emerald-400" style={{ width: `${buyWidth}%` }} />
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground whitespace-nowrap">
                    <span className="text-emerald-400">{item.buys}B</span>
                    {' / '}
                    <span className="text-red-400">{item.sells}S</span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>

      </div>
      </PaywallGate>
    </div>
  )
}
