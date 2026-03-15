'use client'
import { useState, useRef, useTransition } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { Sparkles, Send, RotateCcw, ExternalLink } from 'lucide-react'
import { SuspicionBadge } from '@/components/suspicion-badge'

// ── Types ──────────────────────────────────────────────────────────────────

interface AskResult {
  answer: string
  results: Record<string, unknown>[] | null
  tool_used: string | null
}

// ── Suggested questions ────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Which politicians have a suspicion score higher than 7?',
  'Who bought NVDA stock in the last year?',
  'Show me trades near committee hearings',
  'Which senators have the best trading returns?',
  'Who are the most active traders in the House?',
  'Show me Republican trades with committee conflicts',
  'Which Democrats sold tech stocks in 2024?',
  'Who filed trades late after the 45-day deadline?',
]

// ── Helpers ────────────────────────────────────────────────────────────────

const PARTY_COLORS: Record<string, string> = {
  Republican: 'text-red-400',
  Democrat: 'text-blue-400',
  Independent: 'text-violet-400',
}


function inferColumns(rows: Record<string, unknown>[]): string[] {
  if (!rows.length) return []
  // Preferred display order
  const preferred = [
    'politician', 'party', 'chamber', 'ticker', 'type',
    'date', 'amount', 'suspicion_score', 'avg_return_pct', 'trade_count', 'trades',
  ]
  const keys = Object.keys(rows[0])
  const ordered = preferred.filter(k => keys.includes(k))
  const HIDDEN = new Set(['politician_id', 'suspicion_flags'])
  const rest = keys.filter(k => !preferred.includes(k) && !HIDDEN.has(k))
  return [...ordered, ...rest]
}

function formatHeader(key: string) {
  const map: Record<string, string> = {
    politician: 'Member',
    party: 'Party',
    chamber: 'Chamber',
    ticker: 'Ticker',
    type: 'Type',
    date: 'Date',
    amount: 'Amount',
    suspicion_score: 'Suspicion',
    avg_return_pct: 'Avg Return',
    trade_count: 'Trades',
    trades: 'Trades',
  }
  return map[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function CellValue({ col, val, row }: { col: string; val: unknown; row: Record<string, unknown> }) {
  if (col === 'politician') {
    const id = row['politician_id'] as string | undefined
    const name = String(val)
    return id ? (
      <Link
        href={`/politicians/${id}`}
        className="font-medium hover:text-primary transition-colors flex items-center gap-1"
      >
        {name}
        <ExternalLink className="h-2.5 w-2.5 opacity-40" />
      </Link>
    ) : <span className="font-medium">{name}</span>
  }

  if (col === 'party') {
    const v = String(val)
    return <span className={`text-xs font-medium ${PARTY_COLORS[v] ?? ''}`}>{v}</span>
  }

  if (col === 'type') {
    const v = String(val)
    return (
      <span className={`text-xs font-semibold ${v === 'Purchase' ? 'text-emerald-400' : 'text-red-400'}`}>
        {v === 'Purchase' ? 'Buy' : 'Sell'}
      </span>
    )
  }

  if (col === 'suspicion_score') {
    const score = val as number | null
    const flags = row['suspicion_flags'] as string | null
    if (score == null) return <span className="text-muted-foreground">—</span>
    return <SuspicionBadge score={score} flags={flags} size="sm" />
  }

  if (col === 'avg_return_pct') {
    const n = val as number | null
    if (n == null) return <span className="text-muted-foreground">—</span>
    return (
      <span className={n >= 0 ? 'text-emerald-400' : 'text-red-400'}>
        {n >= 0 ? '+' : ''}{n}%
      </span>
    )
  }

  if (col === 'ticker') {
    return (
      <Link href={`/tickers/${val}`} className="font-mono text-primary hover:underline text-xs font-bold">
        {String(val)}
      </Link>
    )
  }

  if (val == null) return <span className="text-muted-foreground">—</span>
  return <span>{String(val)}</span>
}

// ── Answer renderer ───────────────────────────────────────────────────────

function AnswerText({ text }: { text: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => (
          <p className="text-sm leading-relaxed text-foreground/90 mb-2 last:mb-0">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="space-y-1 my-2">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="space-y-1 my-2 list-decimal list-inside">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="flex items-start gap-2 text-sm leading-relaxed text-foreground/90">
            <span className="text-violet-400 shrink-0 mt-px select-none">•</span>
            <span>{children}</span>
          </li>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-3">
            <table className="w-full text-sm border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="border-b border-border/60">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">{children}</th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 text-xs border-b border-border/40 text-foreground/90">{children}</td>
        ),
        tr: ({ children }) => (
          <tr className="hover:bg-muted/20 transition-colors">{children}</tr>
        ),
        code: ({ children }) => (
          <code className="font-mono text-primary text-xs bg-primary/10 px-1 py-0.5 rounded">{children}</code>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function AskClient() {
  const [question, setQuestion] = useState('')
  const [response, setResponse] = useState<AskResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  async function submit(q: string) {
    if (!q.trim() || isPending) return
    setError(null)
    setResponse(null)

    startTransition(async () => {
      try {
        const res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Something went wrong.')
          return
        }
        setResponse(data as AskResult)
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
      } catch {
        setError('Could not reach the server. Please try again.')
      }
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    submit(question)
  }

  function handleSuggestion(s: string) {
    setQuestion(s)
    submit(s)
    inputRef.current?.focus()
  }

  const cols = response?.results?.length ? inferColumns(response.results) : []

  return (
    <div className="py-4">

      {/* Header + input — constrained width for readability */}
      <div className="max-w-2xl mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 ring-1 ring-violet-500/30">
            <Sparkles className="h-4 w-4 text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            Ask the Data
          </h1>
        </div>
        <p className="text-muted-foreground text-sm ml-12 mb-6">
          Ask any question about congressional stock trading in plain English.
        </p>

        {/* Input */}
        <form onSubmit={handleSubmit} className="relative mb-5">
          <input
            ref={inputRef}
            type="text"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="Which politicians have a suspicion score higher than 7?"
            disabled={isPending}
            className="w-full rounded-xl border border-violet-500/20 bg-card/60 px-4 py-3 pr-12 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-50 transition-all shadow-[0_0_20px_-8px_rgba(139,92,246,0.3)]"
          />
          <button
            type="submit"
            disabled={!question.trim() || isPending}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 disabled:opacity-30 transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>

        {/* Suggested questions */}
        {!response && !isPending && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2.5">
              Try asking
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => handleSuggestion(s)}
                  className="rounded-full border border-border/60 bg-card/30 px-3 py-1 text-xs text-muted-foreground hover:border-violet-500/30 hover:bg-violet-500/5 hover:text-foreground transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Loading */}
      {isPending && (
        <div className="flex items-center gap-3 rounded-xl border border-violet-500/20 bg-violet-500/5 px-5 py-6">
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="h-2 w-2 rounded-full bg-violet-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <span className="text-sm text-muted-foreground">Querying the data…</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Response */}
      {response && (
        <div ref={resultRef} className="space-y-4">

          {/* AI answer */}
          <div className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-950/40 via-card/40 to-indigo-950/30 px-5 py-4 shadow-[0_0_24px_-8px_rgba(139,92,246,0.3)]">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-3.5 w-3.5 text-violet-400 shrink-0" />
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                AI Answer
              </span>
              {response.tool_used && (
                <span className="ml-auto text-[10px] text-muted-foreground/50 font-mono">
                  via {response.tool_used}
                </span>
              )}
            </div>
            <AnswerText text={response.answer} />
          </div>

          {/* Data table */}
          {response.results && response.results.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-card/30 overflow-hidden">
              <div className="px-4 pt-3 pb-2 border-b border-border/60">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {response.results.length} result{response.results.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card/95 backdrop-blur-sm">
                    <tr className="border-b border-border/60 text-left">
                      {cols.map(col => (
                        <th key={col} className="px-4 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap">
                          {formatHeader(col)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {response.results.map((row, i) => (
                      <tr key={i} className="border-b border-border/60 hover:bg-muted/20 transition-colors last:border-0">
                        {cols.map(col => (
                          <td key={col} className="px-4 py-2.5 text-xs whitespace-nowrap">
                            <CellValue col={col} val={row[col]} row={row} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Ask another */}
          <button
            onClick={() => { setResponse(null); setQuestion(''); inputRef.current?.focus() }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Ask another question
          </button>
        </div>
      )}

    </div>
  )
}
