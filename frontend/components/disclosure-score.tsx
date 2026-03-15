'use client'

import { useMemo } from 'react'
import type { TradeEntry } from '@/lib/types'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ScoreResult {
  composite: number
  onTimePct: number
  onTimeScore: number
  avgLagDays: number
  lagScore: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  tradeCount: number
}

// ── Scoring logic ──────────────────────────────────────────────────────────────

function daysBetween(dateA: string, dateB: string): number {
  // dateA and dateB are "YYYY-MM-DD"
  const a = new Date(dateA).getTime()
  const b = new Date(dateB).getTime()
  return Math.round((b - a) / (1000 * 60 * 60 * 24))
}

function computeScore(trades: TradeEntry[]): ScoreResult | null {
  if (trades.length < 5) return null

  const lags: number[] = []

  for (const t of trades) {
    if (!t.trade_date || !t.disclosure_date) continue
    const lag = daysBetween(t.trade_date, t.disclosure_date)
    // Discard clearly bad data (negative lags or unreasonably large)
    if (lag >= 0 && lag <= 3650) lags.push(lag)
  }

  if (lags.length < 5) return null

  const onTimeCount = lags.filter(d => d <= 45).length
  const onTimePct = Math.round((onTimeCount / lags.length) * 100)
  const avgLagDays = lags.reduce((s, d) => s + d, 0) / lags.length

  // Component scores 0–100
  const onTimeScore = onTimePct // already 0–100
  const lagScore = Math.max(0, 100 - (avgLagDays / 45) * 100)

  // Revised composite: 0.65 * on_time + 0.35 * lag (no amendment data)
  const composite = 0.65 * onTimeScore + 0.35 * lagScore

  const grade: 'A' | 'B' | 'C' | 'D' | 'F' =
    composite >= 85 ? 'A' :
    composite >= 70 ? 'B' :
    composite >= 55 ? 'C' :
    composite >= 40 ? 'D' : 'F'

  return {
    composite: Math.round(composite),
    onTimePct,
    onTimeScore,
    avgLagDays: Math.round(avgLagDays),
    lagScore: Math.round(lagScore),
    grade,
    tradeCount: lags.length,
  }
}

// ── Grade color maps ───────────────────────────────────────────────────────────

const GRADE_BADGE: Record<string, string> = {
  A: 'border-emerald-500 bg-emerald-500 text-white shadow-emerald-500/30',
  B: 'border-emerald-600 bg-emerald-600 text-white shadow-emerald-600/30',
  C: 'border-amber-500 bg-amber-500 text-white shadow-amber-500/30',
  D: 'border-orange-500 bg-orange-500 text-white shadow-orange-500/30',
  F: 'border-red-500 bg-red-500 text-white shadow-red-500/30',
}

const GRADE_TITLE: Record<string, string> = {
  A: 'text-emerald-400',
  B: 'text-emerald-500',
  C: 'text-amber-400',
  D: 'text-orange-400',
  F: 'text-red-400',
}

const GRADE_BAR: Record<string, string> = {
  A: 'bg-emerald-500',
  B: 'bg-emerald-600',
  C: 'bg-amber-500',
  D: 'bg-orange-500',
  F: 'bg-red-500',
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ScoreRow({
  label,
  barPct,
  valueLabel,
  grade,
}: {
  label: string
  barPct: number
  valueLabel: string
  grade: string
}) {
  const clampedPct = Math.min(100, Math.max(0, barPct))
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="text-[11px] font-semibold tabular-nums text-foreground">{valueLabel}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/40">
        <div
          className={`h-full rounded-full transition-all ${GRADE_BAR[grade]}`}
          style={{ width: `${clampedPct}%` }}
        />
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function DisclosureScore({ trades }: { trades: TradeEntry[] }) {
  const score = useMemo(() => computeScore(trades), [trades])

  // Not enough data
  if (!score) {
    if (trades.length === 0) return null
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/20 px-2.5 py-1 text-xs text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
        Insufficient data
      </div>
    )
  }

  const badgeClass = GRADE_BADGE[score.grade]
  const titleClass = GRADE_TITLE[score.grade]

  return (
    // group wrapper enables group-hover on descendants
    <div className="relative inline-flex group">

      {/* Badge pill */}
      <div
        className={`inline-flex cursor-default select-none items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold shadow-md transition-all ${badgeClass}`}
      >
        <span className="font-black tabular-nums text-sm leading-none">{score.grade}</span>
        <span className="font-medium opacity-90">Disclosure Grade</span>
      </div>

      {/* Popover — shown on group hover (desktop) */}
      {/*
        Positioned above the badge using bottom-full + mb-2.
        left-1/2 + -translate-x-1/2 centers it horizontally over the badge.
        min-w-[220px] prevents it from being too narrow.
        pointer-events-none on the group-hover state prevents accidental closures.
      */}
      <div
        className={`
          pointer-events-none absolute bottom-full left-1/2 z-50 mb-2
          w-[240px] -translate-x-1/2
          rounded-xl border border-border/60 bg-card shadow-xl
          opacity-0 scale-95 transition-all duration-150
          group-hover:pointer-events-auto group-hover:opacity-100 group-hover:scale-100
        `}
        role="tooltip"
        aria-label="Disclosure score breakdown"
      >
        {/* Arrow pointer */}
        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-3 w-3 rotate-45 border-b border-r border-border/60 bg-card" />

        <div className="p-3.5 space-y-3">
          {/* Header */}
          <div>
            <p className={`text-sm font-semibold leading-tight ${titleClass}`}>
              Disclosure Score — {score.grade}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
              Based on STOCK Act 45-day filing requirement
            </p>
          </div>

          {/* Composite score meter */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-border/40 overflow-hidden">
              <div
                className={`h-full rounded-full ${GRADE_BAR[score.grade]}`}
                style={{ width: `${score.composite}%` }}
              />
            </div>
            <span className={`text-xs font-bold tabular-nums ${titleClass}`}>
              {score.composite}
            </span>
          </div>

          {/* Score rows */}
          <div className="space-y-2.5">
            <ScoreRow
              label="On-time filings"
              barPct={score.onTimePct}
              valueLabel={`${score.onTimePct}%`}
              grade={score.grade}
            />
            <ScoreRow
              label="Avg filing lag"
              barPct={score.lagScore}
              valueLabel={`${score.avgLagDays} days`}
              grade={score.grade}
            />
          </div>

          {/* Footer */}
          <p className="text-[9px] leading-snug text-muted-foreground/70 border-t border-border/40 pt-2">
            Late filing does not imply wrongdoing. Reflects procedural compliance only.
            Based on {score.tradeCount} trade{score.tradeCount !== 1 ? 's' : ''}.
          </p>
        </div>
      </div>
    </div>
  )
}
