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
  BarChart2,
  Landmark,
  Clock,
  Flame,
} from 'lucide-react'
import {
  AreaChart, Area, ResponsiveContainer, Tooltip as ReTooltip,
} from 'recharts'

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

interface SiteStats {
  total_trades: number
  total_politicians: number
  total_tickers: number
  latest_trade_date: string
}

interface FeedEntry {
  trade_id: string
  politician_id: string
  full_name: string
  chamber: string | null
  party: string | null
  state: string | null
  photo_url: string | null
  ticker: string
  company_name: string | null
  transaction_type: string
  trade_date: string
  amount_range_raw: string | null
}

interface TopTicker {
  ticker: string
  company_name: string | null
  total: number
  buys: number
  sells: number
}

interface MonthlyActivity {
  month: string
  trades: number
}

interface DashboardStats {
  sentiment_buys: number
  sentiment_sells: number
  top_tickers: TopTicker[]
  monthly_activity: MonthlyActivity[]
}

interface EnrichedPolitician {
  ref_id: string
  name: string
  party: string | null
  chamber: string | null
  state: string | null
  photo_url: string | null
  total_trades: number
  recent_trades: number
  last_trade_date: string | null
  buy_pct: number | null
}

interface EnrichedTicker {
  ref_id: string
  name: string | null
  sector: string | null
  sector_slug: string | null
  recent_trades: number
  last_trade_date: string | null
  buy_pct: number | null
}

interface EnrichedWatchlist {
  politicians: EnrichedPolitician[]
  tickers: EnrichedTicker[]
}

interface Props {
  firstName: string | null
  imageUrl: string
}

const PARTY_RING: Record<string, string> = {
  Republican: 'ring-red-400/40',
  Democrat:   'ring-blue-400/40',
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function StatBar({ stats }: { stats: SiteStats | null }) {
  const items = [
    { icon: BarChart2,  label: 'Total Trades',    value: stats ? stats.total_trades.toLocaleString() : '—' },
    { icon: Landmark,   label: 'Members Tracked', value: stats ? stats.total_politicians.toLocaleString() : '—' },
    { icon: TrendingUp, label: 'Tickers',          value: stats ? stats.total_tickers.toLocaleString() : '—' },
    { icon: Clock,      label: 'Latest Trade',     value: stats ? new Date(stats.latest_trade_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map(({ icon: Icon, label, value }) => (
        <div key={label} className="rounded-xl border border-border/60 bg-card/40 px-4 py-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums leading-tight">{value}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function RecentTradeRow({ entry }: { entry: FeedEntry }) {
  const isBuy = entry.transaction_type === 'Purchase'
  const ring = PARTY_RING[entry.party ?? ''] ?? 'ring-border/40'

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors">
      {/* Avatar */}
      <div className={`relative shrink-0 h-8 w-8 rounded-full ring-2 ${ring} overflow-hidden bg-muted`}>
        {entry.photo_url ? (
          <Image src={entry.photo_url} alt={entry.full_name} width={32} height={32}
            className="object-cover object-top w-full h-full"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-[9px] font-bold text-muted-foreground">{initials(entry.full_name)}</span>
          </div>
        )}
      </div>

      {/* Member + ticker */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link href={`/politicians/${entry.politician_id}`}
            className="text-sm font-medium hover:text-primary transition-colors truncate">
            {entry.full_name}
          </Link>
          {entry.state && <span className="text-[10px] text-muted-foreground shrink-0">{entry.state}</span>}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Link href={`/tickers/${entry.ticker}`}
            className="font-mono text-xs font-bold hover:text-primary transition-colors">
            {entry.ticker}
          </Link>
          {entry.company_name && (
            <span className="text-[10px] text-muted-foreground truncate">
              {entry.company_name.replace(/\s+(Inc\.?|Corp\.?|Ltd\.?|LLC\.?|Co\.?|Group|Holdings?|Technologies?|Pharmaceuticals?|Bancorp|International)$/i, '').trim()}
            </span>
          )}
        </div>
      </div>

      {/* Buy/sell + date */}
      <div className="shrink-0 text-right">
        <span className={`text-xs font-semibold ${isBuy ? 'text-emerald-400' : 'text-orange-400'}`}>
          {isBuy ? '▲ Buy' : '▼ Sell'}
        </span>
        <p className="text-[10px] text-muted-foreground mt-0.5">{entry.trade_date}</p>
      </div>
    </div>
  )
}

function SentimentBar({ buys, sells }: { buys: number; sells: number }) {
  const total = buys + sells
  if (total === 0) return null
  const buyPct = Math.round((buys / total) * 100)
  const sellPct = 100 - buyPct
  const bullish = buyPct >= 50

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Flame className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">30-Day Sentiment</span>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${bullish ? 'bg-emerald-500/15 text-emerald-400' : 'bg-orange-500/15 text-orange-400'}`}>
          {bullish ? 'Bullish' : 'Bearish'}
        </span>
      </div>
      <div className="flex rounded-full overflow-hidden h-3 mb-2">
        <div className="bg-emerald-500/70 transition-all" style={{ width: `${buyPct}%` }} />
        <div className="bg-orange-500/70 transition-all" style={{ width: `${sellPct}%` }} />
      </div>
      <div className="flex justify-between text-[11px]">
        <span className="text-emerald-400 font-semibold">{buyPct}% Buying ({buys.toLocaleString()})</span>
        <span className="text-orange-400 font-semibold">{sellPct}% Selling ({sells.toLocaleString()})</span>
      </div>
    </div>
  )
}

function TopTickersCard({ tickers }: { tickers: TopTicker[] }) {
  const max = Math.max(...tickers.map(t => t.total), 1)

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
        <Flame className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hot Tickers — 30 Days</span>
      </div>
      <div>
        {tickers.map((t) => {
          const buyPct = t.total > 0 ? Math.round((t.buys / t.total) * 100) : 0
          const barWidth = Math.round((t.total / max) * 100)
          const name = t.company_name
            ? t.company_name.replace(/\s+(Inc\.?|Corp\.?|Ltd\.?|LLC\.?|Co\.?|Group|Holdings?|Technologies?|Pharmaceuticals?|Bancorp|International)$/i, '').trim()
            : t.ticker

          return (
            <Link key={t.ticker} href={`/tickers/${t.ticker}`}
              className="flex items-center gap-3 px-4 py-2.5 border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors group">
              <div className="w-14 shrink-0">
                <span className="font-mono text-xs font-bold group-hover:text-primary transition-colors">{t.ticker}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] text-muted-foreground truncate">{name}</span>
                  <span className="text-[10px] text-muted-foreground/50 ml-auto shrink-0">{t.total}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                  <div className="h-full rounded-full flex overflow-hidden" style={{ width: `${barWidth}%` }}>
                    <div className="bg-emerald-500/70" style={{ width: `${buyPct}%` }} />
                    <div className="bg-orange-500/70" style={{ width: `${100 - buyPct}%` }} />
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function ActivitySparkline({ data }: { data: MonthlyActivity[] }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">12-Month Activity</span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {data.reduce((s, d) => s + d.trades, 0).toLocaleString()} trades
        </span>
      </div>
      <ResponsiveContainer width="100%" height={64}>
        <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="trades" stroke="var(--primary)" strokeWidth={1.5}
            fill="url(#actGrad)" dot={false} />
          <ReTooltip
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs shadow-lg">
                  <p className="text-muted-foreground">{payload[0].payload.month}</p>
                  <p className="font-mono font-semibold">{payload[0].value} trades</p>
                </div>
              ) : null
            }
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

const PARTY_BADGE: Record<string, string> = {
  Republican: 'bg-red-500/15 text-red-400',
  Democrat:   'bg-blue-500/15 text-blue-400',
}

function EnrichedPoliticianCard({ pol, onUnfollow }: { pol: EnrichedPolitician; onUnfollow: (id: string) => void }) {
  const [removing, startTransition] = useTransition()
  const bullish = pol.buy_pct !== null && pol.buy_pct >= 50
  const partyBadge = pol.party ? (PARTY_BADGE[pol.party] ?? 'bg-muted/60 text-muted-foreground') : null

  return (
    <div className={`flex items-start gap-3 px-4 py-3.5 border-b border-border/40 last:border-0 transition-opacity ${removing ? 'opacity-40' : ''}`}>
      {/* Avatar */}
      <div className={`relative shrink-0 h-10 w-10 rounded-full ring-2 overflow-hidden bg-muted ${PARTY_RING[pol.party ?? ''] ?? 'ring-border/40'}`}>
        {pol.photo_url ? (
          <Image src={pol.photo_url} alt={pol.name} width={40} height={40}
            className="object-cover object-top w-full h-full"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-[10px] font-bold text-muted-foreground">{initials(pol.name)}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link href={`/politicians/${pol.ref_id}`}
            className="text-sm font-semibold hover:text-primary transition-colors truncate">
            {pol.name}
          </Link>
          {partyBadge && (
            <span className={`text-[9px] font-bold px-1.5 py-px rounded ${partyBadge}`}>
              {pol.party === 'Republican' ? 'R' : pol.party === 'Democrat' ? 'D' : pol.party}
            </span>
          )}
          {pol.state && <span className="text-[10px] text-muted-foreground">{pol.state}</span>}
        </div>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <span className="text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">{pol.total_trades.toLocaleString()}</span> total trades
          </span>
          {pol.recent_trades > 0 && (
            <span className="text-[11px] text-primary font-medium">
              {pol.recent_trades} in last 30d
            </span>
          )}
          {pol.buy_pct !== null && (
            <span className={`text-[11px] font-semibold ${bullish ? 'text-emerald-400' : 'text-orange-400'}`}>
              {bullish ? '▲' : '▼'} {pol.buy_pct}% buy
            </span>
          )}
          {pol.last_trade_date && (
            <span className="text-[10px] text-muted-foreground/60">
              Last: {pol.last_trade_date}
            </span>
          )}
        </div>
      </div>

      <button onClick={() => startTransition(async () => {
        await fetch(`/api/watchlist/politician/${pol.ref_id}`, { method: 'DELETE' })
        onUnfollow(pol.ref_id)
      })} disabled={removing} className="p-1 rounded text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50 transition-colors shrink-0 mt-0.5" title="Unfollow">
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

function EnrichedTickerCard({ ticker, onUnfollow }: { ticker: EnrichedTicker; onUnfollow: (id: string) => void }) {
  const [removing, startTransition] = useTransition()
  const bullish = ticker.buy_pct !== null && ticker.buy_pct >= 50

  return (
    <div className={`flex items-start gap-3 px-4 py-3.5 border-b border-border/40 last:border-0 transition-opacity ${removing ? 'opacity-40' : ''}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50 shrink-0 ring-1 ring-border/40">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/tickers/${ticker.ref_id}`}
            className="font-mono text-sm font-bold hover:text-primary transition-colors">
            {ticker.ref_id}
          </Link>
          {ticker.name && ticker.name !== ticker.ref_id && (
            <span className="text-[11px] text-muted-foreground truncate">
              {ticker.name.replace(/\s+(Inc\.?|Corp\.?|Ltd\.?|LLC\.?|Co\.?|Group|Holdings?|Technologies?|Pharmaceuticals?|Bancorp|International)$/i, '').trim()}
            </span>
          )}
          {ticker.sector && (
            <span className="text-[9px] px-1.5 py-px rounded bg-muted/60 text-muted-foreground">{ticker.sector}</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {ticker.recent_trades > 0 ? (
            <span className="text-[11px] text-primary font-medium">{ticker.recent_trades} trades in 30d</span>
          ) : (
            <span className="text-[11px] text-muted-foreground/60">No recent trades</span>
          )}
          {ticker.buy_pct !== null && (
            <span className={`text-[11px] font-semibold ${bullish ? 'text-emerald-400' : 'text-orange-400'}`}>
              {bullish ? '▲' : '▼'} {ticker.buy_pct}% buy
            </span>
          )}
          {ticker.last_trade_date && (
            <span className="text-[10px] text-muted-foreground/60">Last: {ticker.last_trade_date}</span>
          )}
        </div>
      </div>

      <button onClick={() => startTransition(async () => {
        await fetch(`/api/watchlist/ticker/${ticker.ref_id}`, { method: 'DELETE' })
        onUnfollow(ticker.ref_id)
      })} disabled={removing} className="p-1 rounded text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50 transition-colors shrink-0 mt-0.5" title="Unfollow">
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

function AiHistoryCollapsible({ aiHistory }: { aiHistory: AiHistoryEntry[] }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/20 transition-colors"
      >
        <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex-1 text-left">
          Ask AI History
        </span>
        {aiHistory.length > 0 && (
          <span className="text-[10px] font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
            {aiHistory.length}
          </span>
        )}
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/50 transition-transform ml-1 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {aiHistory.length === 0 ? (
            <div className="border-t border-border/60">
              <EmptyStateInline
                icon={Sparkles}
                title="No queries yet"
                description="Your Ask AI questions and answers will be saved here."
                cta="Ask a question"
                href="/ask"
              />
            </div>
          ) : (
            <>
              <div className="border-t border-border/60">
                <AiHistoryList entries={aiHistory} />
              </div>
              <div className="px-4 py-2.5 border-t border-border/40">
                <Link href="/ask" className="inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                  <Sparkles className="h-3 w-3" /> Ask another question
                </Link>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function EmptyStateInline({ icon: Icon, title, description, cta, href }: {
  icon: React.ElementType; title: string; description: string; cta: string; href: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-6 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/60 mb-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">{title}</p>
      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{description}</p>
      <Link href={href} className="inline-flex items-center gap-1.5 rounded-lg bg-primary/15 text-primary px-3 py-1.5 text-xs font-medium hover:bg-primary/25 transition-colors">
        {cta} <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  )
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
  const [enriched, setEnriched] = useState<EnrichedWatchlist>({ politicians: [], tickers: [] })
  const [aiHistory, setAiHistory] = useState<AiHistoryEntry[]>([])
  const [siteStats, setSiteStats] = useState<SiteStats | null>(null)
  const [recentTrades, setRecentTrades] = useState<FeedEntry[]>([])
  const [dashStats, setDashStats] = useState<DashboardStats | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/watchlist/enriched').then(r => r.json()).catch(() => ({ politicians: [], tickers: [] })),
      fetch('/api/ai-history').then(r => r.json()).catch(() => []),
      fetch('/api/stats').then(r => r.json()).catch(() => null),
      fetch('/api/recent-trades').then(r => r.json()).catch(() => ({ entries: [] })),
      fetch('/api/dashboard-stats').then(r => r.json()).catch(() => null),
    ]).then(([wl, ai, stats, feed, dash]) => {
      setEnriched(wl ?? { politicians: [], tickers: [] })
      setAiHistory(Array.isArray(ai) ? ai : [])
      setSiteStats(stats)
      setRecentTrades(Array.isArray(feed.entries) ? feed.entries : [])
      setDashStats(dash)
      setLoaded(true)
    })
  }, [])

  const { politicians, tickers } = enriched

  function removePolitician(id: string) {
    setEnriched(prev => ({ ...prev, politicians: prev.politicians.filter(p => p.ref_id !== id) }))
  }
  function removeTicker(id: string) {
    setEnriched(prev => ({ ...prev, tickers: prev.tickers.filter(t => t.ref_id !== id) }))
  }

  const greeting = firstName ? `Welcome back, ${firstName}` : 'Welcome back'
  const followingCount = politicians.length + tickers.length

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

      {/* Site-wide stats */}
      <StatBar stats={siteStats} />

      {/* Quick stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Following', value: loaded ? String(politicians.length) : '—', icon: BookmarkPlus },
          { label: 'Tickers Watched', value: loaded ? String(tickers.length) : '—', icon: TrendingUp },
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
                  {politicians.map(pol => (
                    <EnrichedPoliticianCard key={pol.ref_id} pol={pol} onUnfollow={removePolitician} />
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
                  {tickers.map(ticker => (
                    <EnrichedTickerCard key={ticker.ref_id} ticker={ticker} onUnfollow={removeTicker} />
                  ))}
                </div>
              )
            )}
          </SectionCard>

          {/* Recent trades feed */}
          <SectionCard title="Recent Trades" icon={Activity}>
            {recentTrades.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="No recent trades"
                description="The latest congressional trade disclosures will appear here."
                cta="Browse feed"
                href="/feed"
              />
            ) : (
              <>
                <div>
                  {recentTrades.map(entry => (
                    <RecentTradeRow key={entry.trade_id} entry={entry} />
                  ))}
                </div>
                <div className="px-4 py-2.5 border-t border-border/40">
                  <Link href="/feed" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    View full feed <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </>
            )}
          </SectionCard>

        </div>

        {/* Right: AI history (collapsed) + sentiment + sparkline + top tickers */}
        <div className="space-y-6">
          {/* Ask AI History — collapsible */}
          <AiHistoryCollapsible aiHistory={aiHistory} />

          {dashStats && (
            <>
              <SentimentBar buys={dashStats.sentiment_buys} sells={dashStats.sentiment_sells} />
              <ActivitySparkline data={dashStats.monthly_activity} />
              <TopTickersCard tickers={dashStats.top_tickers} />
            </>
          )}
        </div>

      </div>
    </div>
  )
}
