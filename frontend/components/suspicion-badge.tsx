'use client'

interface Props {
  score: number | null
  flags: string | null
  size?: 'sm' | 'md'
}

function scoreColor(score: number): string {
  if (score <= 3) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  if (score <= 5) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
  if (score <= 7) return 'bg-orange-500/10 text-orange-400 border-orange-500/20'
  return 'bg-red-500/10 text-red-400 border-red-500/20'
}

function scoreLabel(score: number): string {
  if (score <= 3) return 'Low'
  if (score <= 5) return 'Moderate'
  if (score <= 7) return 'Elevated'
  return 'High'
}

function flagsToTooltip(flags: string | null): string {
  if (!flags) return ''
  try {
    const parsed = JSON.parse(flags)
    const parts: string[] = []
    if (parsed.late_filing_days) parts.push(`Filed ${parsed.late_filing_days}d late`)
    if (parsed.slow_filing_days) parts.push(`Filed ${parsed.slow_filing_days}d (slow)`)
    if (parsed.committee_overlap) parts.push(`Committee: ${Array.isArray(parsed.committee_overlap) ? parsed.committee_overlap[0] : parsed.committee_overlap}`)
    if (parsed.near_hearing) parts.push(`Hearing: ${parsed.near_hearing}`)
    if (parsed.large_amount) parts.push('Large amount ($500K+)')
    if (parsed.options_trade) parts.push('Options trade')
    return parts.join(' · ')
  } catch {
    return ''
  }
}

export function SuspicionBadge({ score, flags, size = 'sm' }: Props) {
  if (score === null || score === undefined) return null

  const tooltip = flagsToTooltip(flags)
  const colorCls = scoreColor(score)
  const label = scoreLabel(score)

  return (
    <span
      title={tooltip || undefined}
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-px font-mono font-bold cursor-help ${
        size === 'sm' ? 'text-[9px]' : 'text-[11px] px-2 py-0.5'
      } ${colorCls}`}
    >
      {score}
      <span className={`font-sans font-medium ${size === 'sm' ? 'text-[8px]' : 'text-[10px]'}`}>
        {label}
      </span>
    </span>
  )
}
