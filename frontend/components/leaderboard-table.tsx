'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { ReturnLeaderboardEntry, VolumeLeaderboardEntry } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MergedEntry {
  politician_id: string
  full_name: string
  chamber: string | null
  party: string | null
  trade_count: number
  avg_return_pct: number | null
  return_low: number | null
  return_high: number | null
}

type SortMode = 'returns' | 'activity'

// ── Helpers ───────────────────────────────────────────────────────────────────

const rankCircleStyle: Record<number, string> = {
  1: 'bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/30',
  2: 'bg-slate-400/15 text-slate-400 ring-1 ring-slate-400/30',
  3: 'bg-orange-600/15 text-orange-500 ring-1 ring-orange-600/30',
}

const chamberStyle: Record<string, string> = {
  House:  'bg-emerald-400/10 text-emerald-400',
  Senate: 'bg-amber-400/10 text-amber-400',
}

// Podium card accent config
interface PodiumAccent {
  border: string
  bg: string
  shadow: string
  rankColor: string
  rankNumber: string
}

const podiumAccents: Record<number, PodiumAccent> = {
  1: {
    border: 'border-amber-400/50',
    bg: 'bg-amber-400/5',
    shadow: 'shadow-amber-400/10',
    rankColor: 'text-amber-400',
    rankNumber: '#1',
  },
  2: {
    border: 'border-slate-400/40',
    bg: 'bg-slate-400/5',
    shadow: 'shadow-slate-400/10',
    rankColor: 'text-slate-400',
    rankNumber: '#2',
  },
  3: {
    border: 'border-orange-600/40',
    bg: 'bg-orange-600/5',
    shadow: 'shadow-orange-600/10',
    rankColor: 'text-orange-500',
    rankNumber: '#3',
  },
}

function partyInfo(party: string | null): { abbr: string; cls: string } | null {
  if (!party) return null
  const p = party.toLowerCase()
  if (p.startsWith('rep')) return { abbr: 'R', cls: 'bg-red-500/15 text-red-400' }
  if (p.startsWith('dem')) return { abbr: 'D', cls: 'bg-blue-500/15 text-blue-400' }
  return { abbr: 'I', cls: 'bg-purple-500/15 text-purple-400' }
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

function fmtCount(n: number): string {
  return n.toLocaleString()
}

// ── Podium Card ───────────────────────────────────────────────────────────────

function PodiumCard({ entry, rank, mode }: { entry: MergedEntry; rank: number; mode: SortMode }) {
  const accent = podiumAccents[rank]
  if (!accent) return null
  const party = partyInfo(entry.party)
  const ret = entry.avg_return_pct
  const isPos = ret !== null && ret >= 0

  return (
    <div
      className={`rounded-xl border ${accent.border} ${accent.bg} shadow-lg ${accent.shadow} px-5 py-5 flex flex-col gap-3`}
    >
      {/* Rank + badges row */}
      <div className="flex items-start justify-between gap-2">
        <span className={`text-4xl font-black tabular-nums ${accent.rankColor}`}>
          {accent.rankNumber}
        </span>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {party && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${party.cls}`}>
              {party.abbr}
            </span>
          )}
          {entry.chamber && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${chamberStyle[entry.chamber] ?? 'bg-muted/30 text-muted-foreground'}`}>
              {entry.chamber}
            </span>
          )}
        </div>
      </div>

      {/* Name */}
      <Link
        href={`/politicians/${entry.politician_id}`}
        className="font-bold text-base leading-snug hover:text-primary transition-colors"
      >
        {entry.full_name}
      </Link>

      {mode === 'activity' ? (
        <>
          {/* Primary: trade count */}
          <div>
            <span className={`text-2xl font-black tabular-nums ${accent.rankColor}`}>
              {fmtCount(entry.trade_count)}
            </span>
            <p className="text-xs text-muted-foreground mt-0.5">total trades</p>
          </div>

          {/* Secondary: avg return if available */}
          {ret !== null && (
            <p className={`text-sm font-semibold tabular-nums ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmtPct(ret)} avg return
            </p>
          )}
        </>
      ) : (
        <>
          {/* Primary: avg return */}
          <div>
            {ret !== null ? (
              <span className={`text-2xl font-black tabular-nums ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmtPct(ret)}
              </span>
            ) : (
              <span className="text-2xl font-black text-muted-foreground">—</span>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">avg return</p>
          </div>

          {/* Secondary: trade count */}
          <p className="text-xs text-muted-foreground">
            {fmtCount(entry.trade_count)} trade{entry.trade_count !== 1 ? 's' : ''}
          </p>

          {/* Return range */}
          {entry.return_low !== null && entry.return_high !== null && (
            <p className="text-[11px] font-mono text-muted-foreground">
              <span className="text-red-400/70">{fmtPct(entry.return_low)}</span>
              <span className="text-muted-foreground/40 mx-1">→</span>
              <span className="text-emerald-400/70">{fmtPct(entry.return_high)}</span>
            </p>
          )}
        </>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  returns: ReturnLeaderboardEntry[]
  volume: VolumeLeaderboardEntry[]
  methodologyLabel: string
}

export function LeaderboardTable({ returns: returnsData, volume: volumeData, methodologyLabel }: Props) {
  const [sortMode, setSortMode] = useState<SortMode>('returns')

  // Merge by politician_id
  const merged = useMemo<MergedEntry[]>(() => {
    const map = new Map<string, MergedEntry>()

    volumeData.forEach(v => {
      map.set(v.politician_id, {
        politician_id: v.politician_id,
        full_name: v.full_name,
        chamber: v.chamber ?? null,
        party: v.party ?? null,
        trade_count: v.trade_count,
        avg_return_pct: null,
        return_low: null,
        return_high: null,
      })
    })

    returnsData.forEach(r => {
      const existing = map.get(r.politician_id)
      if (existing) {
        existing.avg_return_pct = Number(r.avg_return_pct)
        existing.return_low = Number(r.return_low)
        existing.return_high = Number(r.return_high)
        // Fill in chamber/party from returns data if volume didn't have them
        if (!existing.chamber) existing.chamber = r.chamber ?? null
        if (!existing.party) existing.party = r.party ?? null
      } else {
        map.set(r.politician_id, {
          politician_id: r.politician_id,
          full_name: r.full_name,
          chamber: r.chamber ?? null,
          party: r.party ?? null,
          trade_count: r.trade_count,
          avg_return_pct: Number(r.avg_return_pct),
          return_low: Number(r.return_low),
          return_high: Number(r.return_high),
        })
      }
    })

    return Array.from(map.values())
  }, [returnsData, volumeData])

  // Sort
  const sorted = useMemo(() => {
    return [...merged].sort((a, b) => {
      if (sortMode === 'returns') {
        const ar = a.avg_return_pct ?? -Infinity
        const br = b.avg_return_pct ?? -Infinity
        return br - ar
      }
      return b.trade_count - a.trade_count
    })
  }, [merged, sortMode])

  // Stat cards
  const totalTrades = useMemo(() => merged.reduce((s, e) => s + e.trade_count, 0), [merged])
  const withReturns = merged.filter(e => e.avg_return_pct !== null)
  const avgReturn = withReturns.length
    ? withReturns.reduce((s, e) => s + (e.avg_return_pct ?? 0), 0) / withReturns.length
    : null
  const houseCount = merged.filter(e => e.chamber === 'House').length
  const senateCount = merged.filter(e => e.chamber === 'Senate').length
  const maxTrades = sorted[0]?.trade_count ?? 1
  const maxAbsReturn = Math.max(...withReturns.map(e => Math.abs(e.avg_return_pct ?? 0)), 1)

  // Podium: show top-3 for both modes (returns requires ≥3 with return data)
  const showPodium =
    sortMode === 'activity'
      ? sorted.length >= 3
      : sorted.filter(e => e.avg_return_pct !== null).length >= 3

  const podiumEntries = showPodium
    ? sortMode === 'activity'
      ? sorted.slice(0, 3)
      : sorted.filter(e => e.avg_return_pct !== null).slice(0, 3)
    : []

  // Table rows: skip the podium entries when podium is shown
  const podiumIds = new Set(podiumEntries.map(e => e.politician_id))
  const tableRows = showPodium
    ? sorted.filter(e => !podiumIds.has(e.politician_id))
    : sorted

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/60 bg-card/30 px-4 py-3">
          <p className="text-2xl font-black tabular-nums">{merged.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Members ranked</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card/30 px-4 py-3">
          <p className="text-2xl font-black tabular-nums">{totalTrades.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total trades</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card/30 px-4 py-3">
          <p className={`text-2xl font-black tabular-nums ${avgReturn !== null ? (avgReturn >= 0 ? 'text-emerald-400' : 'text-red-400') : ''}`}>
            {avgReturn !== null ? fmtPct(avgReturn) : '—'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Avg return</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card/30 px-4 py-3">
          <p className="text-2xl font-black tabular-nums">
            <span className="text-emerald-400">{houseCount}</span>
            <span className="text-muted-foreground/40 text-base mx-1">/</span>
            <span className="text-amber-400">{senateCount}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">House / Senate</p>
        </div>
      </div>

      {/* Toggle + methodology note */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex rounded-lg border border-border/60 bg-muted/20 p-1 text-sm gap-1">
          {([
            { mode: 'returns' as SortMode, label: 'Top Returns' },
            { mode: 'activity' as SortMode, label: 'Most Active' },
          ]).map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => setSortMode(mode)}
              className={`px-4 py-1.5 rounded-md transition-colors font-medium ${
                sortMode === mode
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Returns: {methodologyLabel}
        </p>
      </div>

      {/* Podium */}
      {showPodium && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {podiumEntries.map((entry, i) => (
            <PodiumCard key={entry.politician_id} entry={entry} rank={i + 1} mode={sortMode} />
          ))}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border/60 bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-14 text-center">Rank</TableHead>
              <TableHead>Member</TableHead>
              <TableHead className="hidden sm:table-cell w-24">Chamber</TableHead>
              <TableHead className="text-right w-20">Trades</TableHead>
              <TableHead className="text-right w-32">Avg Return</TableHead>
              <TableHead className="hidden md:table-cell text-right w-40">Range (low → high)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableRows.map((entry, idx) => {
              // Rank number continues from podium count
              const rank = idx + 1 + (showPodium ? podiumEntries.length : 0)
              const party = partyInfo(entry.party)
              const ret = entry.avg_return_pct
              const isPos = ret !== null && ret >= 0
              const tradeBarWidth = Math.round((entry.trade_count / maxTrades) * 100)
              const retBarWidth = ret !== null
                ? Math.round((Math.abs(ret) / maxAbsReturn) * 100)
                : 0

              // Accent border for top 10 overall (including podium slots)
              const overallRank = idx + 1 + (showPodium ? podiumEntries.length : 0)
              const isTop10 = overallRank <= 10

              // Rank circle color for 4-10 vs rest
              const rankCircleClass =
                rankCircleStyle[rank] ??
                (rank <= 10
                  ? 'text-primary/60 ring-1 ring-primary/20'
                  : 'text-muted-foreground')

              return (
                <TableRow
                  key={entry.politician_id}
                  className={`border-b border-border/60 hover:bg-muted/20 transition-colors ${isTop10 ? 'border-l-2 border-l-primary/20' : ''}`}
                >
                  {/* Rank */}
                  <TableCell className="text-center">
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${rankCircleClass}`}>
                      {rank}
                    </span>
                  </TableCell>

                  {/* Member */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/politicians/${entry.politician_id}`}
                        className="font-semibold hover:text-primary transition-colors"
                      >
                        {entry.full_name}
                      </Link>
                      {party && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${party.cls}`}>
                          {party.abbr}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Chamber */}
                  <TableCell className="hidden sm:table-cell">
                    {entry.chamber ? (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${chamberStyle[entry.chamber] ?? 'bg-muted/30 text-muted-foreground'}`}>
                        {entry.chamber}
                      </span>
                    ) : <span className="text-muted-foreground text-sm">—</span>}
                  </TableCell>

                  {/* Trades */}
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-mono font-bold tabular-nums text-sm">
                        {fmtCount(entry.trade_count)}
                      </span>
                      <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/50"
                          style={{ width: `${tradeBarWidth}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>

                  {/* Avg Return */}
                  <TableCell className="text-right">
                    {ret !== null ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className={`font-mono font-bold tabular-nums text-sm ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fmtPct(ret)}
                        </span>
                        <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isPos ? 'bg-emerald-400' : 'bg-red-400'}`}
                            style={{ width: `${retBarWidth}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>

                  {/* Return range */}
                  <TableCell className="hidden md:table-cell text-right text-xs font-mono text-muted-foreground">
                    {entry.return_low !== null && entry.return_high !== null ? (
                      <>
                        <span className="text-red-400/70">{fmtPct(entry.return_low)}</span>
                        <span className="text-muted-foreground/40 mx-1">→</span>
                        <span className="text-emerald-400/70">{fmtPct(entry.return_high)}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
