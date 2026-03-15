'use client'

import { useQueryState } from 'nuqs'
import { cn } from '@/lib/utils'

const PERIODS = [
  { label: '30D', value: '30' },
  { label: '60D', value: '60' },
  { label: '90D', value: '90' },
  { label: '1Y', value: '365' },
  { label: 'All', value: '9999' },
]

export function PeriodSelector() {
  const [days, setDays] = useQueryState('days', {
    defaultValue: '30',
    shallow: false,
  })

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/20 p-1">
      {PERIODS.map((period) => (
        <button
          key={period.value}
          onClick={() => setDays(period.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-all',
            days === period.value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          {period.label}
        </button>
      ))}
    </div>
  )
}
