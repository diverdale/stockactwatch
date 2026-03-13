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

function formatPct(n: number): string {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

export function ReturnsLeaderboardTable({ entries, methodologyLabel }: ReturnsLeaderboardTableProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        No return data available yet.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">
        Methodology: {methodologyLabel}
      </p>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Member</TableHead>
              <TableHead className="text-right">Avg Return</TableHead>
              <TableHead className="text-right">Range</TableHead>
              <TableHead className="text-right">Trades</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry, idx) => (
              <TableRow key={entry.politician_id}>
                <TableCell className="text-muted-foreground font-mono text-sm">
                  {idx + 1}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/politicians/${entry.politician_id}`}
                    className="font-medium hover:underline"
                  >
                    {entry.full_name}
                  </Link>
                </TableCell>
                <TableCell
                  className={`text-right font-mono font-semibold ${
                    entry.avg_return_pct >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {formatPct(entry.avg_return_pct)}
                </TableCell>
                <TableCell className="text-muted-foreground text-right text-sm font-mono">
                  {formatPct(entry.return_low)} / {formatPct(entry.return_high)}
                </TableCell>
                <TableCell className="text-right text-sm">{entry.trade_count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
