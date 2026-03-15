'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface Props {
  total: number
  limit: number
  offset: number
}

const PAGE_SIZES = [20, 50, 100] as const

export function FeedPagination({ total, limit, offset }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentPage = Math.floor(offset / limit)
  const totalPages = Math.ceil(total / limit)

  function navigate(newOffset: number, newLimit?: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('offset', String(newOffset))
    params.set('limit', String(newLimit ?? limit))
    router.push(`/feed?${params.toString()}`)
  }

  return (
    <div className="flex items-center justify-between pt-4 border-t border-border/40">
      <button
        onClick={() => navigate(Math.max(0, offset - limit))}
        disabled={offset === 0}
        className="px-4 py-2 text-sm rounded-md border border-input bg-background disabled:opacity-40 hover:bg-accent transition-colors"
      >
        ← Previous
      </button>

      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          Page {currentPage + 1} of {totalPages} &nbsp;·&nbsp; {total.toLocaleString()} total
        </span>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">Show</span>
          <div className="flex rounded-md border border-input overflow-hidden">
            {PAGE_SIZES.map(n => (
              <button
                key={n}
                onClick={() => navigate(0, n)}
                className={`px-3 py-1.5 transition-colors ${
                  limit === n
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

      <button
        onClick={() => navigate(offset + limit)}
        disabled={offset + limit >= total}
        className="px-4 py-2 text-sm rounded-md border border-input bg-background disabled:opacity-40 hover:bg-accent transition-colors"
      >
        Next →
      </button>
    </div>
  )
}
