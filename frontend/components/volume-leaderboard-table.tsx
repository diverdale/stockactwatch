'use client'
import Link from 'next/link'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { VolumeLeaderboardEntry } from '@/lib/types'

interface VolumeLeaderboardTableProps {
  entries: VolumeLeaderboardEntry[]
}

export function VolumeLeaderboardTable({ entries }: VolumeLeaderboardTableProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        No volume data available yet.
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Member</TableHead>
            <TableHead>Chamber</TableHead>
            <TableHead>Party</TableHead>
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
              <TableCell className="text-sm">{entry.chamber}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {entry.party}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-mono font-semibold">
                {entry.trade_count}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
