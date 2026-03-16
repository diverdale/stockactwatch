'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import ReactMarkdown from 'react-markdown'
import {
  Users,
  TrendingUp,
  Activity,
  Sparkles,
  Bell,
  BookmarkPlus,
  ArrowRight,
  X,
  MessageSquare,
  ChevronDown,
} from 'lucide-react'

interface WatchlistEntry {
  type: string
  ref_id: string
  name: string | null
  party: string | null
  chamber: string | null
  created_at: string | null
}

interface AiHistoryEntry {
  id: string
  question: string
  answer: string
  tool_used: string | null
  result_count: number
  created_at: string
}

interface Props {
  firstName: string | null
  imageUrl: string
}

function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
  href,
}: {
  icon: React.ElementType
  title: string
  description: string
  cta: string
  href: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/60 mb-4">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">{title}</p>
      <p className="text-xs text-muted-foreground mb-5 max-w-xs leading-relaxed">{description}</p>
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary/15 text-primary px-3 py-1.5 text-xs font-medium hover:bg-primary/25 transition-colors"
      >
        {cta} <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  )
}

function SectionCard({
  title,
  icon: Icon,
  badge,
  children,
}: {
  title: string
  icon: React.ElementType
  badge?: number
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        {badge !== undefined && badge > 0 && (
          <span className="ml-auto text-[10px] font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function WatchlistRow({
  entry,
  onUnfollow,
}: {
  entry: WatchlistEntry
  onUnfollow: (entry: WatchlistEntry) => void
}) {
  const [removing, startTransition] = useTransition()

  const href =
    entry.type === 'politician'
      ? `/politicians/${entry.ref_id}`
      : `/tickers/${entry.ref_id}`

  const label = entry.name ?? entry.ref_id

  function handleUnfollow(e: React.MouseEvent) {
    e.preventDefault()
    startTransition(async () => {
      await fetch(`/api/watchlist/${entry.type}/${encodeURIComponent(entry.ref_id)}`, {
        method: 'DELETE',
      })
      onUnfollow(entry)
    })
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 border-b border-border/40 last:border-0 transition-opacity ${removing ? 'opacity-40' : ''}`}>
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted/50 shrink-0">
        {entry.type === 'politician'
          ? <Users className="h-3.5 w-3.5 text-muted-foreground" />
          : <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <Link href={href} className="text-sm font-medium hover:text-primary transition-colors truncate block">
          {label}
        </Link>
        {(entry.party || entry.chamber) && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {[entry.chamber, entry.party].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
      <button
        onClick={handleUnfollow}
        disabled={removing}
        className="p-1 rounded text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
        title="Unfollow"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

function AiHistoryItem({ entry }: { entry: AiHistoryEntry }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-border/40 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-4 py-3 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-start gap-2">
          <MessageSquare className="h-3 w-3 text-violet-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground leading-snug">
              {entry.question}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {entry.result_count > 0 && (
                <span className="text-[10px] text-muted-foreground/60">
                  {entry.result_count} result{entry.result_count !== 1 ? 's' : ''}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground/40 ml-auto">
                {new Date(entry.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-0.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-border/30 bg-muted/10">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="text-xs leading-relaxed text-foreground/90 mb-2 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="space-y-0.5 my-1.5">{children}</ul>,
              ol: ({ children }) => <ol className="space-y-0.5 my-1.5 list-decimal list-inside">{children}</ol>,
              li: ({ children }) => (
                <li className="flex items-start gap-1.5 text-xs leading-relaxed text-foreground/90">
                  <span className="text-violet-400 shrink-0 select-none">•</span>
                  <span>{children}</span>
                </li>
              ),
              strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
              code: ({ children }) => <code className="font-mono text-primary text-[11px] bg-primary/10 px-1 py-0.5 rounded">{children}</code>,
            }}
          >
            {entry.answer}
          </ReactMarkdown>
        </div>
      )}
    </div>
  )
}

function AiHistoryList({ entries }: { entries: AiHistoryEntry[] }) {
  return (
    <div className="max-h-[520px] overflow-y-auto">
      {entries.map(entry => (
        <AiHistoryItem key={entry.id} entry={entry} />
      ))}
    </div>
  )
}

export function DashboardClient({ firstName, imageUrl }: Props) {
  const [watchlistTab, setWatchlistTab] = useState<'politicians' | 'tickers'>('politicians')
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([])
  const [aiHistory, setAiHistory] = useState<AiHistoryEntry[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/watchlist').then(r => r.json()).catch(() => []),
      fetch('/api/ai-history').then(r => r.json()).catch(() => []),
    ]).then(([wl, ai]) => {
      setWatchlist(Array.isArray(wl) ? wl : [])
      setAiHistory(Array.isArray(ai) ? ai : [])
      setLoaded(true)
    })
  }, [])

  const politicians = watchlist.filter(e => e.type === 'politician')
  const tickers = watchlist.filter(e => e.type === 'ticker')

  function removeEntry(entry: WatchlistEntry) {
    setWatchlist(prev => prev.filter(e => !(e.type === entry.type && e.ref_id === entry.ref_id)))
  }

  const greeting = firstName ? `Welcome back, ${firstName}` : 'Welcome back'
  const followingCount = watchlist.length

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center gap-4">
        {imageUrl && (
          <Image
            src={imageUrl}
            alt={firstName ?? 'User'}
            width={48}
            height={48}
            className="rounded-full ring-2 ring-border"
          />
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{greeting}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your personal view of congressional trading activity.
          </p>
        </div>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Following', value: loaded ? String(followingCount) : '—', icon: BookmarkPlus },
          { label: 'Tickers', value: loaded ? String(tickers.length) : '—', icon: TrendingUp },
          { label: 'AI Queries', value: loaded ? String(aiHistory.length) : '—', icon: Sparkles },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-border/60 bg-card/40 px-4 py-4 flex items-center gap-3">
            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xl font-bold tabular-nums">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Watchlist (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">

          <SectionCard title="My Watchlist" icon={BookmarkPlus} badge={followingCount}>
            {/* Tabs */}
            <div className="flex border-b border-border/60">
              {(['politicians', 'tickers'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setWatchlistTab(tab)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors capitalize ${
                    watchlistTab === tab
                      ? 'border-b-2 border-primary text-primary -mb-px'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab === 'politicians' ? <Users className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                  {tab}
                  {tab === 'politicians' && politicians.length > 0 && (
                    <span className="ml-1 text-[10px] bg-muted/60 text-muted-foreground px-1 rounded-full">{politicians.length}</span>
                  )}
                  {tab === 'tickers' && tickers.length > 0 && (
                    <span className="ml-1 text-[10px] bg-muted/60 text-muted-foreground px-1 rounded-full">{tickers.length}</span>
                  )}
                </button>
              ))}
            </div>

            {watchlistTab === 'politicians' ? (
              politicians.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No politicians followed yet"
                  description="Follow Congress members to track their trades and get notified of new activity."
                  cta="Browse politicians"
                  href="/politicians"
                />
              ) : (
                <div>
                  {politicians.map(entry => (
                    <WatchlistRow key={entry.ref_id} entry={entry} onUnfollow={removeEntry} />
                  ))}
                </div>
              )
            ) : (
              tickers.length === 0 ? (
                <EmptyState
                  icon={TrendingUp}
                  title="No tickers followed yet"
                  description="Follow stocks to see every time a Congress member buys or sells them."
                  cta="Browse tickers"
                  href="/tickers"
                />
              ) : (
                <div>
                  {tickers.map(entry => (
                    <WatchlistRow key={entry.ref_id} entry={entry} onUnfollow={removeEntry} />
                  ))}
                </div>
              )
            )}
          </SectionCard>

          {/* Activity feed */}
          <SectionCard title="Watchlist Activity" icon={Activity}>
            <EmptyState
              icon={Bell}
              title="No activity yet"
              description="Trades from politicians and tickers you follow will appear here as they're filed."
              cta="Start following"
              href="/politicians"
            />
          </SectionCard>

        </div>

        {/* Right: AI history (1/3 width) */}
        <div className="space-y-6">
          <SectionCard title="Ask AI History" icon={Sparkles} badge={aiHistory.length}>
            {aiHistory.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="No queries yet"
                description="Your Ask AI questions and answers will be saved here for easy reference."
                cta="Ask a question"
                href="/ask"
              />
            ) : (
              <AiHistoryList entries={aiHistory} />
            )}
            {aiHistory.length > 0 && (
              <div className="px-4 py-2.5 border-t border-border/40">
                <Link
                  href="/ask"
                  className="inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  <Sparkles className="h-3 w-3" /> Ask another question
                </Link>
              </div>
            )}
          </SectionCard>
        </div>

      </div>
    </div>
  )
}
