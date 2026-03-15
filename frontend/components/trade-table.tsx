'use client'
import React from 'react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { TradeEntry } from '@/lib/types'

interface TradeTableProps {
  trades: TradeEntry[]
}

const columns: ColumnDef<TradeEntry>[] = [
  {
    accessorKey: 'trade_date',
    header: 'Date',
    cell: ({ getValue }) => getValue<string>(),
  },
  {
    accessorKey: 'ticker',
    header: 'Ticker',
    cell: ({ getValue }) => (
      <span className="font-mono font-semibold">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: 'transaction_type',
    header: 'Type',
    cell: ({ getValue }) => {
      const val = getValue<string>()
      return (
        <Badge
          variant="outline"
          className={
            val === 'Purchase'
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
              : 'bg-red-500/15 text-red-400 border-red-500/20'
          }
        >
          {val === 'Purchase' ? 'Buy' : 'Sell'}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'amount_range_raw',
    header: 'Amount',
    cell: ({ getValue }) => <span className="text-sm">{getValue<string>()}</span>,
  },
  {
    accessorKey: 'avg_return_pct',
    header: 'Est. Return',
    cell: ({ row }) => {
      if (!row.original.return_calculable) {
        return (
          <Badge variant="outline" className="text-xs">
            not calculable
          </Badge>
        )
      }
      const val = row.original.avg_return_pct
      if (val === null) return <span className="text-muted-foreground text-sm">—</span>
      const sign = val >= 0 ? '+' : ''
      return (
        <span className={`font-mono text-sm tabular-nums ${val >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {sign}{val.toFixed(1)}%
        </span>
      )
    },
  },
  {
    accessorKey: 'disclosure_date',
    header: 'Disclosed',
    cell: ({ getValue }) => (
      <span className="text-muted-foreground text-sm">{getValue<string>()}</span>
    ),
  },
]

export function TradeTable({ trades }: TradeTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'trade_date', desc: true },
  ])
  const [tickerFilter, setTickerFilter] = React.useState('')

  const table = useReactTable({
    data: trades,
    columns,
    state: {
      sorting,
      columnFilters: tickerFilter ? [{ id: 'ticker', value: tickerFilter }] : [],
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="space-y-3">
      <Input
        placeholder="Filter by ticker..."
        value={tickerFilter}
        onChange={(e) => setTickerFilter(e.target.value.toUpperCase())}
        className="max-w-xs bg-muted/30 border-border/50 focus-visible:ring-primary/50"
      />
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="border-b border-border/60 bg-muted/30 hover:bg-muted/30">
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={header.column.getCanSort() ? 'cursor-pointer select-none' : ''}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc'
                      ? ' ↑'
                      : header.column.getIsSorted() === 'desc'
                      ? ' ↓'
                      : ''}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center text-muted-foreground py-10"
                >
                  No trades match the filter.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="border-b border-border/60 hover:bg-muted/20 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-muted-foreground text-xs tabular-nums">
        {table.getRowModel().rows.length} of {trades.length} trades shown
      </p>
    </div>
  )
}
