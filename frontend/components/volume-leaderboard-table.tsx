'use client'
import Link from 'next/link'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { VolumeLeaderboardEntry } from '@/lib/types'

interface VolumeLeaderboardTableProps {
  entries: VolumeLeaderboardEntry[]
}

const rankStyle: Record<number, string> = {
  1: 'bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/30',
  2: 'bg-slate-400/15 text-slate-400 ring-1 ring-slate-400/30',
  3: 'bg-orange-400/15 text-orange-400 ring-1 ring-orange-400/30',
}

const chamberStyle: Record<string, string> = {
  House: 'bg-emerald-400/10 text-emerald-400',
  Senate: 'bg-amber-400/10 text-amber-400',
}

const partyStyle = (party: string | null) => {
  if (!party) return 'bg-muted/30 text-muted-foreground'
  if (party.toLowerCase().startsWith('rep')) return 'bg-red-500/15 text-red-400'
  if (party.toLowerCase().startsWith('dem')) return 'bg-blue-500/15 text-blue-400'
  return 'bg-purple-500/15 text-purple-400'
}

const partyAbbr = (party: string | null) => {
  if (!party) return '?'
  if (party.toLowerCase().startsWith('rep')) return 'R'
  if (party.toLowerCase().startsWith('dem')) return 'D'
  return 'I'
}

export function VolumeLeaderboardTable({ entries }: VolumeLeaderboardTableProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-border/50 p-10 text-center text-muted-foreground">
        No volume data available yet.
      </div>
    )
  }

  const totalTrades = entries.reduce((s, e) => s + e.trade_count, 0)
  const houseCount = entries.filter(e => e.chamber === 'House').length
  const senateCount = entries.filter(e => e.chamber === 'Senate').length
  const maxTrades = entries[0]?.trade_count ?? 1

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-2xl font-bold tabular-nums">{entries.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Active traders</p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-2xl font-bold tabular-nums">{totalTrades.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Trades shown</p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-2xl font-bold tabular-nums">
            <span className="text-emerald-400">{houseCount}</span>
            <span className="text-muted-foreground/40 text-base mx-1">/</span>
            <span className="text-amber-400">{senateCount}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">House / Senate</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border/60 bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-14 text-center">Rank</TableHead>
              <TableHead>Member</TableHead>
              <TableHead className="hidden sm:table-cell w-24">Chamber</TableHead>
              <TableHead className="hidden sm:table-cell w-16">Party</TableHead>
              <TableHead className="text-right">Trades</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry, idx) => {
              const rank = idx + 1
              const barWidth = Math.round((entry.trade_count / maxTrades) * 100)

              return (
                <TableRow key={entry.politician_id} className="border-b border-border/60 hover:bg-muted/20 transition-colors">
                  <TableCell className="text-center">
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${rankStyle[rank] ?? 'text-muted-foreground'}`}>
                      {rank}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Link href={`/politicians/${entry.politician_id}`} className="font-medium hover:text-primary transition-colors">
                      {entry.full_name}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {entry.chamber ? (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${chamberStyle[entry.chamber] ?? 'bg-muted/30 text-muted-foreground'}`}>
                        {entry.chamber}
                      </span>
                    ) : <span className="text-muted-foreground text-sm">—</span>}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {entry.party ? (
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${partyStyle(entry.party)}`}>
                        {partyAbbr(entry.party)}
                      </span>
                    ) : <span className="text-muted-foreground text-sm">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-mono font-bold tabular-nums text-sm">
                        {entry.trade_count.toLocaleString()}
                      </span>
                      <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary/60" style={{ width: `${barWidth}%` }} />
                      </div>
                    </div>
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
