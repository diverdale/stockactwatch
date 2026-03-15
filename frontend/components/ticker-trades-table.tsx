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
      <div className="rounded-lg border border-border/50 p-10 text-center text-muted-foreground">
        No congressional trades found for this ticker.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border/60 bg-muted/30 hover:bg-muted/30">
            <TableHead>Member</TableHead>
            <TableHead className="hidden md:table-cell">Chamber / Party</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="hidden sm:table-cell">Amount</TableHead>
            <TableHead>Trade Date</TableHead>
            <TableHead className="hidden sm:table-cell">Disclosed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map((trade) => (
            <TableRow key={trade.trade_id} className="border-b border-border/60 hover:bg-muted/20 transition-colors">
              <TableCell>
                <Link
                  href={`/politicians/${trade.politician_id}`}
                  className="font-medium hover:text-primary transition-colors"
                >
                  {trade.full_name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm hidden md:table-cell">
                {[trade.chamber, trade.party].filter(Boolean).join(' · ') || '—'}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={
                    trade.transaction_type === 'Purchase'
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                      : 'bg-red-500/15 text-red-400 border-red-500/20'
                  }
                >
                  {trade.transaction_type === 'Purchase' ? 'Buy' : 'Sell'}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                {trade.amount_range_raw}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm tabular-nums">
                {trade.trade_date}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm tabular-nums hidden sm:table-cell">
                {trade.disclosure_date}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
