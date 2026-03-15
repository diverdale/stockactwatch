'use client'
import { useQueryState } from 'nuqs'

const CHAMBER_TABS = [
  { label: 'All',    value: '' },
  { label: 'House',  value: 'House' },
  { label: 'Senate', value: 'Senate' },
]

const PARTY_TABS = [
  { label: 'All', value: '', cls: '' },
  {
    label: 'R', value: 'Republican',
    cls: 'data-[active=true]:bg-red-500/20 data-[active=true]:text-red-400 data-[active=true]:border-red-500/30 hover:bg-red-500/10',
  },
  {
    label: 'D', value: 'Democrat',
    cls: 'data-[active=true]:bg-blue-500/20 data-[active=true]:text-blue-400 data-[active=true]:border-blue-500/30 hover:bg-blue-500/10',
  },
  {
    label: 'I', value: 'Independent',
    cls: 'data-[active=true]:bg-purple-500/20 data-[active=true]:text-purple-400 data-[active=true]:border-purple-500/30 hover:bg-purple-500/10',
  },
]

export function FeedFilters() {
  const [chamber, setChamber] = useQueryState('chamber', { defaultValue: '', shallow: false })
  const [party,   setParty]   = useQueryState('party',   { defaultValue: '', shallow: false })

  return (
    <div className="flex flex-wrap gap-2">
      {/* Chamber tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/20 p-1">
        {CHAMBER_TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setChamber(t.value || null)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              chamber === t.value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Party tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/20 p-1">
        {PARTY_TABS.map(t => (
          <button
            key={t.value}
            data-active={party === t.value}
            onClick={() => setParty(t.value || null)}
            className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all border border-transparent ${t.cls} ${
              party === t.value && t.value === ''
                ? 'bg-primary text-primary-foreground shadow-sm'
                : party !== t.value ? 'text-muted-foreground' : ''
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
