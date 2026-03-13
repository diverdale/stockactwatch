'use client'
import Link from 'next/link'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { ReturnLeaderboardEntry } from '@/lib/types'

interface ReturnsLeaderboardTableProps {
  entries: ReturnLeaderboardEntry[]
  methodologyLabel: string
}

function formatPct(n: number | string): string {
  const v = Number(n)
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(1)}%`
}

const rankStyle: Record<number, string> = {
  1: 'bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/30',
  2: 'bg-slate-400/15 text-slate-400 ring-1 ring-slate-400/30',
  3: 'bg-orange-400/15 text-orange-400 ring-1 ring-orange-400/30',
}

const partyAbbr = (party?: string | null) => {
  if (!party) return null
  if (party.toLowerCase().startsWith('rep')) return { abbr: 'R', cls: 'bg-red-500/15 text-red-400' }
  if (party.toLowerCase().startsWith('dem')) return { abbr: 'D', cls: 'bg-blue-500/15 text-blue-400' }
  if (party.toLowerCase().startsWith('ind')) return { abbr: 'I', cls: 'bg-purple-500/15 text-purple-400' }
  return null
}

export function ReturnsLeaderboardTable({ entries, methodologyLabel }: ReturnsLeaderboardTableProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-border/50 p-10 text-center text-muted-foreground">
        No return data available yet.
      </div>
    )
  }

  const avgOfAvgs = entries.reduce((s, e) => s + Number(e.avg_return_pct), 0) / entries.length
  const best = entries[0]
  const maxAbs = Math.max(...entries.map(e => Math.abs(Number(e.avg_return_pct))))

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-2xl font-bold tabular-nums">{entries.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Members ranked</p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className={`text-2xl font-bold tabular-nums ${avgOfAvgs >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatPct(avgOfAvgs)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Avg return (all)</p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-2xl font-bold tabular-nums text-emerald-400">
            {formatPct(best.avg_return_pct)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">Best: {best.full_name.split(' ').pop()}</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">Methodology: {methodologyLabel}</p>

      <div className="overflow-x-auto rounded-xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border/60 bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-14 text-center">Rank</TableHead>
              <TableHead>Member</TableHead>
              <TableHead className="text-right w-36">Return</TableHead>
              <TableHead className="text-right hidden md:table-cell w-40">Range (low / high)</TableHead>
              <TableHead className="text-right w-20">Trades</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry, idx) => {
              const rank = idx + 1
              const val = Number(entry.avg_return_pct)
              const isPos = val >= 0
              const barWidth = maxAbs > 0 ? Math.round((Math.abs(val) / maxAbs) * 100) : 0
              const party = partyAbbr((entry as ReturnLeaderboardEntry & { party?: string }).party)

              return (
                <TableRow key={entry.politician_id} className="border-b border-border/60 hover:bg-muted/20 transition-colors">
                  <TableCell className="text-center">
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${rankStyle[rank] ?? 'text-muted-foreground'}`}>
                      {rank}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link href={`/politicians/${entry.politician_id}`} className="font-medium hover:text-primary transition-colors">
                        {entry.full_name}
                      </Link>
                      {party && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${party.cls}`}>{party.abbr}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className={`font-mono font-bold tabular-nums text-sm ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatPct(val)}
                      </span>
                      {/* Visual return bar */}
                      <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isPos ? 'bg-emerald-400' : 'bg-red-400'}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground font-mono hidden md:table-cell">
                    <span className="text-red-400/70">{formatPct(entry.return_low)}</span>
                    <span className="text-muted-foreground/40 mx-1">→</span>
                    <span className="text-emerald-400/70">{formatPct(entry.return_high)}</span>
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{entry.trade_count}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
