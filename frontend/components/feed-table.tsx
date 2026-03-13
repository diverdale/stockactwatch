'use client'
import Link from 'next/link'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { FeedEntry } from '@/lib/types'

interface FeedTableProps {
  entries: FeedEntry[]
}

export function FeedTable({ entries }: FeedTableProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        No trades found for the selected filters.
      </div>
    )
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Chamber / Party</TableHead>
            <TableHead>Ticker</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Disclosed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.trade_id}>
              <TableCell>
                <Link
                  href={`/politicians/${entry.politician_id}`}
                  className="font-medium hover:underline"
                >
                  {entry.full_name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {entry.chamber} · {entry.party}
              </TableCell>
              <TableCell>
                <Link
                  href={`/tickers/${entry.ticker}`}
                  className="font-mono font-semibold hover:underline"
                >
                  {entry.ticker}
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant={entry.transaction_type === 'Purchase' ? 'default' : 'secondary'}>
                  {entry.transaction_type}
                </Badge>
                {!entry.return_calculable && (
                  <Badge variant="outline" className="ml-1 text-xs">
                    options
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-sm">{entry.amount_range_raw}</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {entry.disclosure_date}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
