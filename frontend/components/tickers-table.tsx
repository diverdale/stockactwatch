'use client'
import Link from 'next/link'
import { useState, useMemo } from 'react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { TickerListEntry, TickerListResponse } from '@/lib/types'

// ── Ticker logo ────────────────────────────────────────────────────────────────

function TickerLogo({ ticker }: { ticker: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return (
    <div className="h-6 w-6 rounded bg-muted/60 flex items-center justify-center shrink-0">
      <span className="text-[8px] font-bold text-muted-foreground">{ticker.slice(0, 2)}</span>
    </div>
  )
  return (
    <img
      src={`https://assets.parqet.com/logos/symbol/${ticker}?format=png`}
      alt={ticker}
      width={24}
      height={24}
      onError={() => setFailed(true)}
      className="h-6 w-6 rounded object-contain bg-white p-0.5 shrink-0 opacity-80 grayscale"
    />
  )
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1)
  const w = 60
  const h = 28
  const points = data
    .map((v, i) => {
      const x = data.length > 1 ? (i / (data.length - 1)) * w : w / 2
      const y = h - (v / max) * h
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg width={w} height={h} className="text-emerald-500/70">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

// ── Number formatting ─────────────────────────────────────────────────────────

function formatVolShort(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return d.slice(0, 10)
}

// ── Sort indicator ────────────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc'
type SortCol =
  | 'ticker'
  | 'company_name'
  | 'sector'
  | 'asset_types'
  | 'total_trades'
  | 'sentiment'
  | 'member_count'
  | 'last_trade_date'
  | 'amount_vol_est'

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 text-muted-foreground/30">↕</span>
  return <span className="ml-1">{dir === 'asc' ? '↑' : '↓'}</span>
}

// ── Sector colors ─────────────────────────────────────────────────────────────

type SectorStyle = { active: string; inactive: string; dot: string }

const SECTOR_COLORS: Record<string, SectorStyle> = {
  'All':                    { active: 'bg-primary text-primary-foreground border-primary shadow-sm', inactive: 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground', dot: 'bg-foreground/40' },
  'Technology':             { active: 'bg-violet-500/20 text-violet-300 border-violet-500/50', inactive: 'border-violet-500/20 text-violet-400/60 hover:border-violet-500/40 hover:text-violet-300', dot: 'bg-violet-400' },
  'Healthcare':             { active: 'bg-pink-500/20 text-pink-300 border-pink-500/50', inactive: 'border-pink-500/20 text-pink-400/60 hover:border-pink-500/40 hover:text-pink-300', dot: 'bg-pink-400' },
  'Financial Services':     { active: 'bg-amber-500/20 text-amber-300 border-amber-500/50', inactive: 'border-amber-500/20 text-amber-400/60 hover:border-amber-500/40 hover:text-amber-300', dot: 'bg-amber-400' },
  'Financials':             { active: 'bg-amber-500/20 text-amber-300 border-amber-500/50', inactive: 'border-amber-500/20 text-amber-400/60 hover:border-amber-500/40 hover:text-amber-300', dot: 'bg-amber-400' },
  'Energy':                 { active: 'bg-orange-500/20 text-orange-300 border-orange-500/50', inactive: 'border-orange-500/20 text-orange-400/60 hover:border-orange-500/40 hover:text-orange-300', dot: 'bg-orange-400' },
  'Industrials':            { active: 'bg-slate-400/20 text-slate-300 border-slate-400/50', inactive: 'border-slate-500/20 text-slate-400/60 hover:border-slate-400/40 hover:text-slate-300', dot: 'bg-slate-400' },
  'Materials':              { active: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50', inactive: 'border-emerald-500/20 text-emerald-400/60 hover:border-emerald-500/40 hover:text-emerald-300', dot: 'bg-emerald-400' },
  'Consumer Discretionary': { active: 'bg-sky-500/20 text-sky-300 border-sky-500/50', inactive: 'border-sky-500/20 text-sky-400/60 hover:border-sky-500/40 hover:text-sky-300', dot: 'bg-sky-400' },
  'Consumer Staples':       { active: 'bg-teal-500/20 text-teal-300 border-teal-500/50', inactive: 'border-teal-500/20 text-teal-400/60 hover:border-teal-500/40 hover:text-teal-300', dot: 'bg-teal-400' },
  'Communication Services': { active: 'bg-blue-500/20 text-blue-300 border-blue-500/50', inactive: 'border-blue-500/20 text-blue-400/60 hover:border-blue-500/40 hover:text-blue-300', dot: 'bg-blue-400' },
  'Real Estate':            { active: 'bg-purple-500/20 text-purple-300 border-purple-500/50', inactive: 'border-purple-500/20 text-purple-400/60 hover:border-purple-500/40 hover:text-purple-300', dot: 'bg-purple-400' },
  'Utilities':              { active: 'bg-lime-500/20 text-lime-300 border-lime-500/50', inactive: 'border-lime-500/20 text-lime-400/60 hover:border-lime-500/40 hover:text-lime-300', dot: 'bg-lime-400' },
}

const FALLBACK_SECTOR_COLORS: SectorStyle[] = [
  { active: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50', inactive: 'border-cyan-500/20 text-cyan-400/60 hover:border-cyan-500/40 hover:text-cyan-300', dot: 'bg-cyan-400' },
  { active: 'bg-rose-500/20 text-rose-300 border-rose-500/50', inactive: 'border-rose-500/20 text-rose-400/60 hover:border-rose-500/40 hover:text-rose-300', dot: 'bg-rose-400' },
  { active: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/50', inactive: 'border-fuchsia-500/20 text-fuchsia-400/60 hover:border-fuchsia-500/40 hover:text-fuchsia-300', dot: 'bg-fuchsia-400' },
]

function getSectorColors(sector: string): SectorStyle {
  if (SECTOR_COLORS[sector]) return SECTOR_COLORS[sector]
  let hash = 0
  for (let i = 0; i < sector.length; i++) hash = (hash + sector.charCodeAt(i)) % FALLBACK_SECTOR_COLORS.length
  return FALLBACK_SECTOR_COLORS[hash]
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  data: TickerListResponse
}

const ASSET_TYPE_FILTERS = ['All', 'Stock', 'ETF', 'Options'] as const
type AssetFilter = (typeof ASSET_TYPE_FILTERS)[number]

export function TickersTable({ data }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSector, setSelectedSector] = useState<string>('All')
  const [selectedAssetType, setSelectedAssetType] = useState<AssetFilter>('All')
  const [sortColumn, setSortColumn] = useState<SortCol>('total_trades')
  const [sortDirection, setSortDirection] = useState<SortDir>('desc')
  const [pageSize, setPageSize] = useState<50 | 100 | 250>(100)
  const [page, setPage] = useState(0)

  // Extract unique sectors
  const sectors = useMemo(() => {
    const s = new Set<string>()
    data.tickers.forEach(t => { if (t.sector) s.add(t.sector) })
    return ['All', ...Array.from(s).sort()]
  }, [data.tickers])

  // Pre-filter: search + asset type (used for sector counts)
  const preFiltered = useMemo(() => {
    let rows = data.tickers
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      rows = rows.filter(t =>
        t.ticker.toLowerCase().includes(q) ||
        (t.company_name ?? '').toLowerCase().includes(q)
      )
    }
    if (selectedAssetType !== 'All') {
      const filterLower = selectedAssetType.toLowerCase()
      rows = rows.filter(t =>
        t.asset_types.some(at => {
          const lower = at.toLowerCase()
          if (filterLower === 'stock') return lower === 'equity' || lower === 'stock'
          if (filterLower === 'etf') return lower === 'etf'
          if (filterLower === 'options') return lower === 'option' || lower === 'options'
          return true
        })
      )
    }
    return rows
  }, [data.tickers, searchQuery, selectedAssetType])

  // Per-sector counts (based on pre-filtered, so counts reflect search/asset filters)
  const sectorCounts = useMemo(() => {
    const counts: Record<string, number> = { All: preFiltered.length }
    preFiltered.forEach(t => { if (t.sector) counts[t.sector] = (counts[t.sector] ?? 0) + 1 })
    return counts
  }, [preFiltered])

  // Final filter: apply sector on top of pre-filtered
  const filtered = useMemo(() => {
    setPage(0)
    if (selectedSector === 'All') return preFiltered
    return preFiltered.filter(t => t.sector === selectedSector)
  }, [preFiltered, selectedSector])

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal: string | number | null
      let bVal: string | number | null

      switch (sortColumn) {
        case 'ticker': aVal = a.ticker; bVal = b.ticker; break
        case 'company_name': aVal = a.company_name ?? ''; bVal = b.company_name ?? ''; break
        case 'sector': aVal = a.sector ?? ''; bVal = b.sector ?? ''; break
        case 'asset_types': aVal = a.asset_types.join(','); bVal = b.asset_types.join(','); break
        case 'total_trades': aVal = a.total_trades; bVal = b.total_trades; break
        case 'sentiment': {
          const total_a = a.buy_count + a.sell_count
          const total_b = b.buy_count + b.sell_count
          aVal = total_a > 0 ? a.buy_count / total_a : 0
          bVal = total_b > 0 ? b.buy_count / total_b : 0
          break
        }
        case 'member_count': aVal = a.member_count; bVal = b.member_count; break
        case 'last_trade_date': aVal = a.last_trade_date ?? ''; bVal = b.last_trade_date ?? ''; break
        case 'amount_vol_est': aVal = a.amount_vol_est ?? 0; bVal = b.amount_vol_est ?? 0; break
        default: aVal = 0; bVal = 0
      }

      if (aVal === bVal) return 0
      const cmp = aVal < bVal ? -1 : 1
      return sortDirection === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortColumn, sortDirection])

  const totalPages = Math.ceil(sorted.length / pageSize)
  const paginated = sorted.slice(page * pageSize, (page + 1) * pageSize)

  function handleSort(col: SortCol) {
    setPage(0)
    if (col === sortColumn) {
      setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(col)
      setSortDirection('desc')
    }
  }

  function th(col: SortCol, label: string, extraClass = '') {
    return (
      <TableHead
        className={`cursor-pointer select-none whitespace-nowrap hover:text-foreground transition-colors ${extraClass}`}
        onClick={() => handleSort(col)}
      >
        {label}
        <SortArrow active={sortColumn === col} dir={sortDirection} />
      </TableHead>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Unique Tickers', value: data.total_tickers.toLocaleString() },
          { label: 'Total Trades', value: data.total_trades.toLocaleString() },
          { label: 'Members Trading', value: data.total_members.toLocaleString() },
          { label: 'Est. $ Volume', value: formatVolShort(data.dollar_vol_est) },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border/60 bg-card/30 px-4 py-3">
            <p className="text-2xl font-black tabular-nums">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        {/* Top row: search + asset type + page size */}
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="search"
            placeholder="Search ticker or company..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="rounded-lg border bg-background px-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 w-64"
          />

          <div className="flex gap-1">
            {ASSET_TYPE_FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setSelectedAssetType(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedAssetType === f
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border hover:bg-accent text-muted-foreground hover:text-foreground'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {sorted.length.toLocaleString()} ticker{sorted.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-muted-foreground">Show</span>
              <div className="flex rounded-md border border-border overflow-hidden">
                {([50, 100, 250] as const).map(n => (
                  <button
                    key={n}
                    onClick={() => { setPageSize(n); setPage(0) }}
                    className={`px-3 py-1.5 transition-colors ${
                      pageSize === n
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : 'bg-background text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sector pills — wrapped, color-coded */}
        <div className="flex flex-wrap gap-1.5">
          {sectors.map(s => {
            const colors = getSectorColors(s)
            const active = selectedSector === s
            const count = sectorCounts[s] ?? 0
            return (
              <button
                key={s}
                onClick={() => setSelectedSector(s)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                  active ? colors.active : colors.inactive
                }`}
              >
                {s !== 'All' && (
                  <span className={`h-1.5 w-1.5 rounded-full ${colors.dot} ${active ? 'opacity-100' : 'opacity-50'}`} />
                )}
                {s}
                <span className={`rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums leading-none ${
                  active ? 'bg-white/20 text-inherit' : 'bg-muted/60 text-muted-foreground'
                }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border/60 bg-muted/30 hover:bg-muted/30">
              {th('ticker', 'Ticker')}
              {th('company_name', 'Company')}
              {th('sector', 'Sector')}
              {th('asset_types', 'Type')}
              {th('total_trades', 'Trades', 'text-right')}
              {th('sentiment', 'Buy / Sell', 'text-right')}
              {th('member_count', 'Members', 'text-right')}
              {th('last_trade_date', 'Last Traded')}
              {th('amount_vol_est', '$ Vol', 'text-right')}
              <TableHead className="text-center">Sparkline</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map(row => (
              <TickerRow key={row.ticker} row={row} />
            ))}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                  No tickers match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-4 py-2 text-sm rounded-md border border-input bg-background disabled:opacity-40 hover:bg-accent transition-colors"
          >
            &larr; Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages} &nbsp;&middot;&nbsp; {sorted.length.toLocaleString()} total
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-4 py-2 text-sm rounded-md border border-input bg-background disabled:opacity-40 hover:bg-accent transition-colors"
          >
            Next &rarr;
          </button>
        </div>
      )}
    </div>
  )
}

function TickerRow({ row }: { row: TickerListEntry }) {
  const assetLabel = row.asset_types
    .map(a => a.charAt(0).toUpperCase() + a.slice(1).toLowerCase())
    .join(', ')

  const total = row.buy_count + row.sell_count
  const buyPct = total > 0 ? Math.round((row.buy_count / total) * 100) : 50

  return (
    <TableRow className="border-b border-border/60 hover:bg-muted/20 transition-colors">
      {/* Ticker */}
      <TableCell>
        <div className="flex items-center gap-2">
          <TickerLogo ticker={row.ticker} />
          <Link
            href={`/tickers/${row.ticker}`}
            className="font-mono font-semibold hover:text-primary transition-colors"
          >
            {row.ticker}
          </Link>
        </div>
      </TableCell>

      {/* Company */}
      <TableCell className="max-w-[180px] truncate text-sm">
        {row.company_name ?? <span className="text-muted-foreground">—</span>}
      </TableCell>

      {/* Sector */}
      <TableCell>
        {row.sector && row.sector_slug ? (
          <Link
            href={`/sectors/${row.sector_slug}`}
            className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-accent text-accent-foreground hover:bg-accent/70 transition-colors"
          >
            {row.sector}
          </Link>
        ) : row.sector ? (
          <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-accent text-accent-foreground">
            {row.sector}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Asset type */}
      <TableCell className="text-xs text-muted-foreground">
        {assetLabel || '—'}
      </TableCell>

      {/* Trades */}
      <TableCell className="text-right tabular-nums text-sm">
        {row.total_trades.toLocaleString()}
      </TableCell>

      {/* Buy / Sell combined */}
      <TableCell>
        <div className="flex flex-col gap-1 min-w-[80px]">
          <div className="flex justify-between text-xs tabular-nums">
            <span className="text-emerald-400 font-medium">{row.buy_count}</span>
            <span className="text-orange-400 font-medium">{row.sell_count}</span>
          </div>
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
            <div className="bg-emerald-500 h-full" style={{ width: `${buyPct}%` }} />
            <div className="bg-orange-500 h-full" style={{ width: `${100 - buyPct}%` }} />
          </div>
        </div>
      </TableCell>

      {/* Members */}
      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
        {row.member_count.toLocaleString()}
      </TableCell>

      {/* Last traded */}
      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
        {formatDate(row.last_trade_date)}
      </TableCell>

      {/* $ Vol */}
      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
        {formatVolShort(row.amount_vol_est)}
      </TableCell>

      {/* Sparkline */}
      <TableCell className="text-center">
        <Sparkline data={row.sparkline} />
      </TableCell>
    </TableRow>
  )
}
