'use client'
import type { FeedEntry } from '@/lib/types'

function escapeCsv(val: unknown): string {
  if (val == null) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function toCSV(entries: FeedEntry[]): string {
  const headers = [
    'trade_id', 'politician', 'chamber', 'party', 'state',
    'ticker', 'company', 'asset_type', 'transaction_type',
    'trade_date', 'disclosure_date', 'amount_range',
    'amount_lower', 'amount_upper', 'price_at_trade',
  ]
  const rows = entries.map(e => [
    e.trade_id, e.full_name, e.chamber, e.party, e.state,
    e.ticker, e.company_name, e.asset_type, e.transaction_type,
    e.trade_date, e.disclosure_date, e.amount_range_raw,
    e.amount_lower, e.amount_upper, e.price_at_trade,
  ].map(escapeCsv).join(','))
  return [headers.join(','), ...rows].join('\n')
}

export function FeedCsvExport({ entries }: { entries: FeedEntry[] }) {
  function download() {
    const csv = toCSV(entries)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stockactwatch-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={download}
      className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Export CSV
    </button>
  )
}
