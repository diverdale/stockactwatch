'use client'
import Link from 'next/link'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { TickerTradeEntry } from '@/lib/types'

interface TickerTradesTableProps {
  trades: TickerTradeEntry[]
}

export function TickerTradesTable({ trades }: TickerTradesTableProps) {
  if (trades.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        No congressional trades found for this ticker.
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Chamber / Party</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Trade Date</TableHead>
            <TableHead>Disclosed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map((trade) => (
            <TableRow key={trade.trade_id}>
              <TableCell>
                <Link
                  href={`/politicians/${trade.politician_id}`}
                  className="font-medium hover:underline"
                >
                  {trade.full_name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {trade.chamber} · {trade.party}
              </TableCell>
              <TableCell>
                <Badge
                  variant={trade.transaction_type === 'Purchase' ? 'default' : 'secondary'}
                >
                  {trade.transaction_type}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">{trade.amount_range_raw}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{trade.trade_date}</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {trade.disclosure_date}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
