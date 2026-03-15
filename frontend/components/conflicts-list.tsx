'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { ConflictTrade } from '@/lib/types'

interface ConflictsListProps {
  trades: ConflictTrade[]
}

function formatAmount(lower: number | null, upper: number | null): string {
  if (lower === null && upper === null) return 'N/A'
  const fmt = (n: number) =>
    n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
      ? `$${(n / 1_000).toFixed(0)}K`
      : `$${n.toLocaleString()}`
  if (lower !== null && upper !== null) return `${fmt(lower)} – ${fmt(upper)}`
  if (lower !== null) return `${fmt(lower)}+`
  return 'N/A'
}

function partyClass(party: string | null): string {
  if (party === 'Republican') return 'bg-red-100 text-red-800'
  if (party === 'Democrat') return 'bg-blue-100 text-blue-800'
  return 'bg-gray-100 text-gray-700'
}

function partyLetter(party: string | null): string {
  if (party === 'Republican') return 'R'
  if (party === 'Democrat') return 'D'
  return party?.[0] ?? '?'
}

function isBuy(txType: string): boolean {
  return txType.toLowerCase().includes('purchase')
}

export function ConflictsList({ trades }: ConflictsListProps) {
  const [search, setSearch] = useState('')
  const [chamber, setChamber] = useState<'All' | 'House' | 'Senate'>('All')
  const [txFilter, setTxFilter] = useState<'All' | 'Purchase' | 'Sale'>('All')

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return trades.filter((t) => {
      if (q && !t.full_name.toLowerCase().includes(q) && !t.ticker.toLowerCase().includes(q)) {
        return false
      }
      if (chamber !== 'All' && t.chamber !== chamber) return false
      if (txFilter !== 'All') {
        const isBuyTx = isBuy(t.transaction_type)
        if (txFilter === 'Purchase' && !isBuyTx) return false
        if (txFilter === 'Sale' && isBuyTx) return false
      }
      return true
    })
  }, [trades, search, chamber, txFilter])

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Committee Conflict Trades</h1>
        <p className="text-muted-foreground mt-1">
          Trades where the member sits on an oversight committee for that sector
        </p>
      </div>

      {/* Info banner */}
      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>Note:</strong> These trades are not illegal. The STOCK Act requires disclosure but
        permits trading. Conflicts are based on committee oversight areas.
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or ticker..."
          className="flex-1 min-w-48 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex rounded-md border border-input overflow-hidden text-sm">
          {(['All', 'House', 'Senate'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setChamber(c)}
              className={`px-3 py-2 transition-colors ${
                chamber === c
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-accent'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex rounded-md border border-input overflow-hidden text-sm">
          {(['All', 'Purchase', 'Sale'] as const).map((tx) => (
            <button
              key={tx}
              onClick={() => setTxFilter(tx)}
              className={`px-3 py-2 transition-colors ${
                txFilter === tx
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-accent'
              }`}
            >
              {tx}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <p className="text-sm text-muted-foreground mb-4">
        {filtered.length.toLocaleString()} flagged trade{filtered.length !== 1 ? 's' : ''}
        {filtered.length !== trades.length && ` (of ${trades.length.toLocaleString()} total)`}
      </p>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          No conflicts match your filters.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((trade) => {
            const buy = isBuy(trade.transaction_type)
            return (
              <div
                key={`${trade.trade_id}-${trade.committee_code}`}
                className="rounded-lg border bg-card border-l-4 border-l-amber-400 pl-4 pr-5 py-4 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  {/* Photo */}
                  {trade.photo_url ? (
                    <div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden bg-muted">
                      <Image
                        src={trade.photo_url}
                        alt={trade.full_name}
                        width={48}
                        height={48}
                        className="object-cover w-full h-full"
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-lg font-semibold">
                      {trade.full_name[0]}
                    </div>
                  )}

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/politicians/${trade.politician_id}`}
                            className="font-semibold text-base hover:underline"
                          >
                            {trade.full_name}
                          </Link>
                          {trade.party && (
                            <span
                              className={`text-xs font-medium px-1.5 py-0.5 rounded ${partyClass(trade.party)}`}
                            >
                              {partyLetter(trade.party)}
                              {trade.state ? `-${trade.state}` : ''}
                            </span>
                          )}
                          {trade.role && (
                            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                              {trade.role}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {trade.role ? `${trade.role} of ` : 'Member of '}
                          {trade.committee_name}
                        </p>
                      </div>

                      {/* Right side: badge + amount */}
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded ${
                            buy
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {buy ? 'BUY' : 'SELL'}
                        </span>
                        <span className="text-sm font-medium">
                          {formatAmount(trade.amount_lower, trade.amount_upper)}
                        </span>
                      </div>
                    </div>

                    {/* Ticker row */}
                    <div className="mt-2 flex items-center gap-2 flex-wrap text-sm">
                      <span className="font-mono font-bold text-sm bg-muted px-1.5 py-0.5 rounded">
                        {trade.ticker}
                      </span>
                      {trade.company_name && (
                        <span className="text-muted-foreground">{trade.company_name}</span>
                      )}
                      {trade.sector && (
                        <span className="text-muted-foreground">• {trade.sector} sector</span>
                      )}
                      <span className="text-muted-foreground">
                        • Traded:{' '}
                        {new Date(trade.trade_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    {/* Conflict reason */}
                    <p className="mt-2 text-sm italic text-amber-700">
                      Conflict: {trade.conflict_reason} — traded {trade.sector} stock
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
