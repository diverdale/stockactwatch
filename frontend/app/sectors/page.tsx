import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { apiFetch } from '@/lib/api'
import { PaywallGate } from '@/components/paywall-gate'
import type { SectorEntry, SectorOverviewResponse } from '@/lib/types'

export const revalidate = 600

export function generateMetadata() {
  return {
    title: 'Congressional Trading by Sector',
    description: 'Congressional stock trading grouped by market sector — see which sectors Congress is buying and selling.',
    alternates: { canonical: '/sectors' },
  }
}

// ── SVG Donut ─────────────────────────────────────────────────────────────────
// Pure SVG — no library. Two arcs on the same circle: buys (emerald) then sells (orange).

function DonutChart({ buyPct }: { buyPct: number }) {
  const R = 36          // radius
  const stroke = 9      // ring thickness
  const cx = 46         // viewBox center
  const circumference = 2 * Math.PI * R

  const buyDash  = (buyPct / 100) * circumference
  const sellDash = circumference - buyDash
  const gap = 2         // small gap between arcs

  // We rotate so the chart starts at the top (−90°)
  const sellOffset = -(buyDash + gap / 2)

  return (
    <svg viewBox="0 0 92 92" width="92" height="92" className="shrink-0">
      {/* Track */}
      <circle cx={cx} cy={cx} r={R} fill="none" stroke="currentColor"
        strokeWidth={stroke} className="text-muted/30" />
      {/* Sells arc (orange) — drawn first, behind buys */}
      {buyPct < 100 && (
        <circle
          cx={cx} cy={cx} r={R} fill="none"
          stroke="#f97316"
          strokeWidth={stroke}
          strokeDasharray={`${sellDash - gap} ${circumference - (sellDash - gap)}`}
          strokeDashoffset={sellOffset}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cx}px` }}
        />
      )}
      {/* Buys arc (emerald) */}
      {buyPct > 0 && (
        <circle
          cx={cx} cy={cx} r={R} fill="none"
          stroke="#34d399"
          strokeWidth={stroke}
          strokeDasharray={`${buyDash - gap} ${circumference - (buyDash - gap)}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cx}px` }}
        />
      )}
      {/* Center label */}
      <text x={cx} y={cx - 5} textAnchor="middle" dominantBaseline="middle"
        className="fill-foreground" style={{ fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}>
        {buyPct}%
      </text>
      <text x={cx} y={cx + 11} textAnchor="middle" dominantBaseline="middle"
        className="fill-muted-foreground" style={{ fontSize: 9, fontFamily: 'inherit' }}>
        buys
      </text>
    </svg>
  )
}

// ── Sector Icon mapping ───────────────────────────────────────────────────────
const SECTOR_EMOJI: Record<string, string> = {
  Technology:           '💻',
  Healthcare:           '🏥',
  Financials:           '🏦',
  'Consumer Discretionary': '🛍️',
  'Consumer Staples':   '🛒',
  Energy:               '⚡',
  Industrials:          '🏭',
  Materials:            '⛏️',
  'Real Estate':        '🏘️',
  Utilities:            '💡',
  'Communication Services': '📡',
  Defense:              '🛡️',
}

// ── Card ──────────────────────────────────────────────────────────────────────

function SectorCard({ sector }: { sector: SectorEntry }) {
  const total = sector.buy_count + sector.sell_count
  const buyPct = total > 0 ? Math.round((sector.buy_count / total) * 100) : 50

  const sentimentConfig = {
    bullish: { label: 'Bullish', cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20', ring: 'hover:border-emerald-400/40' },
    bearish: { label: 'Bearish', cls: 'bg-red-500/15 text-red-400 border border-red-500/20',           ring: 'hover:border-red-400/40' },
    mixed:   { label: 'Mixed',   cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',     ring: 'hover:border-amber-400/40' },
  }
  const sent = sentimentConfig[sector.sentiment]
  const emoji = SECTOR_EMOJI[sector.sector] ?? '📊'

  return (
    <Link
      href={`/sectors/${sector.sector_slug}`}
      className={`group flex flex-col rounded-xl border border-border/60 bg-card p-5 transition-all hover:shadow-md ${sent.ring}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl leading-none">{emoji}</span>
          <h2 className="font-semibold text-base leading-tight group-hover:text-primary transition-colors">
            {sector.sector}
          </h2>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {sector.is_trending && (
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/20">
              🔥 hot
            </span>
          )}
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${sent.cls}`}>
            {sent.label}
          </span>
        </div>
      </div>

      {/* Donut + stats side by side */}
      <div className="flex items-center gap-4 flex-1">
        <DonutChart buyPct={buyPct} />

        {/* Stats */}
        <div className="flex-1 space-y-3">
          <div>
            <p className="text-2xl font-bold tabular-nums">{sector.total_trades.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">total trades</p>
          </div>
          <div className="flex gap-4">
            <div>
              <p className="text-sm font-semibold tabular-nums text-emerald-400">{sector.buy_count.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">buys</p>
            </div>
            <div>
              <p className="text-sm font-semibold tabular-nums text-orange-400">{sector.sell_count.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">sells</p>
            </div>
          </div>
          {sector.last_trade_date && (
            <p className="text-xs text-muted-foreground">
              Last:{' '}
              {new Date(sector.last_trade_date + 'T12:00:00Z').toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
            </p>
          )}
        </div>
      </div>

      {/* Footer bar */}
      <div className="mt-4 h-1.5 rounded-full overflow-hidden bg-muted/30">
        <div
          className="h-full bg-emerald-400 rounded-full transition-all"
          style={{ width: `${buyPct}%` }}
        />
      </div>
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function SectorsPage() {
  const { userId } = await auth()
  const isSignedIn = !!userId

  const data = await apiFetch<SectorOverviewResponse>('/sectors', {
    tags: ['sectors-overview'],
    revalidate: 600,
  })

  const totalTrades = data.sectors.reduce((s, sec) => s + sec.total_trades, 0)
  const bullishCount = data.sectors.filter(s => s.sentiment === 'bullish').length
  const trendingCount = data.sectors.filter(s => s.is_trending).length

  const content = (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sector Activity</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Congressional trading grouped by market sector. Click any card to explore top stocks and members.
          </p>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-2xl font-bold tabular-nums">{data.sectors.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Sectors tracked</p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-2xl font-bold tabular-nums">{totalTrades.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total trades</p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-2xl font-bold tabular-nums">
            <span className="text-emerald-400">{bullishCount}</span>
            <span className="text-muted-foreground/40 text-base mx-1">/</span>
            <span className="text-orange-400">{trendingCount}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Bullish / Hot</p>
        </div>
      </div>

      {data.sectors.length === 0 ? (
        <p className="text-muted-foreground">No sector data available yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.sectors.map((sector) => (
            <SectorCard key={sector.sector_slug} sector={sector} />
          ))}
        </div>
      )}
    </div>
  )

  if (!isSignedIn) {
    return (
      <PaywallGate locked size="page" message="Sign in to see which sectors Congress is buying and selling">
        {content}
      </PaywallGate>
    )
  }

  return content
}
