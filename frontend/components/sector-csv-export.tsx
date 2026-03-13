'use client'
import { useState } from 'react'
import type { SectorTrade } from '@/lib/types'

function escapeCsv(val: unknown): string {
  if (val == null) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function toCSV(trades: SectorTrade[]): string {
  const headers = [
    'trade_id', 'politician', 'chamber', 'party', 'state',
    'ticker', 'company', 'asset_type', 'transaction_type',
    'trade_date', 'disclosure_date', 'amount_range',
    'amount_lower', 'amount_upper', 'price_at_trade',
  ]
  const rows = trades.map(t => [
    t.trade_id, t.full_name, t.chamber, t.party, t.state,
    t.ticker, t.company_name, t.asset_type, t.transaction_type,
    t.trade_date, t.disclosure_date, t.amount_range_raw,
    t.amount_lower, t.amount_upper, t.price_at_trade,
  ].map(escapeCsv).join(','))
  return [headers.join(','), ...rows].join('\n')
}

interface Props {
  slug: string
}

export function SectorCsvExport({ slug }: Props) {
  const [loading, setLoading] = useState(false)

  async function download() {
    setLoading(true)
    try {
      const res = await fetch(`/api/sectors/${encodeURIComponent(slug)}/trades`)
      if (!res.ok) throw new Error('Failed to fetch trades')
      const data = await res.json()
      const csv = toCSV(data.trades ?? [])
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${slug}-trades-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={download}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-50"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      {loading ? 'Preparing\u2026' : 'Download CSV'}
    </button>
  )
}
