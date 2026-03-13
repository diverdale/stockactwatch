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
    cell: ({ getValue }) => (
      <Badge variant={getValue<string>() === 'Purchase' ? 'default' : 'secondary'}>
        {getValue<string>()}
      </Badge>
    ),
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
        <span className={`font-mono text-sm ${val >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {sign}
          {val.toFixed(1)}%
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
        className="max-w-xs"
      />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={header.column.getCanSort() ? 'cursor-pointer select-none' : ''}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc'
                      ? ' \u2191'
                      : header.column.getIsSorted() === 'desc'
                      ? ' \u2193'
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
                  className="text-center text-muted-foreground py-8"
                >
                  No trades match the filter.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
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
      <p className="text-muted-foreground text-xs">
        {table.getRowModel().rows.length} of {trades.length} trades shown
      </p>
    </div>
  )
}
