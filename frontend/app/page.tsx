// app/page.tsx — Marketing landing page
import Link from 'next/link'
import {
  Activity,
  BarChart2,
  TrendingUp,
  Users,
  Search,
  GitPullRequest,
  ArrowRight,
  PieChart,
  Clock,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import type { FeedResponse, LeaderboardResponse } from '@/lib/types'

export const revalidate = 3600

interface PlatformStats {
  total_trades: number
  total_politicians: number
  total_tickers: number
  latest_trade_date: string | null
}

// ── helpers ───────────────────────────────────────────────────────────────────

function formatNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
}

function partyColor(party: string | null): string {
  if (party?.startsWith('D')) return 'text-blue-400'
  if (party?.startsWith('R')) return 'text-red-400'
  return 'text-muted-foreground'
}

function returnColor(v: number | string): string {
  const n = Number(v)
  if (n > 0) return 'text-emerald-400'
  if (n < 0) return 'text-red-400'
  return 'text-muted-foreground'
}

// ── sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5 text-center">
      <span className="text-3xl font-bold tracking-tight text-foreground">{value}</span>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {sub && <span className="text-xs text-muted-foreground/70">{sub}</span>}
    </div>
  )
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: React.ElementType
  title: string
  description: string
  href?: string
}) {
  const inner = (
    <div className="group relative flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-5 transition-all hover:border-primary/40 hover:bg-card/80">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
      {href && (
        <span className="mt-auto inline-flex items-center gap-1 text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
          Explore <ArrowRight className="h-3 w-3" />
        </span>
      )}
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : <div>{inner}</div>
}

function StepBadge({ n }: { n: number }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-sm font-bold text-foreground">
      {n}
    </div>
  )
}

function TradeMarqueeItem({
  name,
  ticker,
  tx,
  amount,
  party,
}: {
  name: string
  ticker: string
  tx: string
  amount: string
  party: string | null
}) {
  const isBuy = tx.toLowerCase().includes('purchase') || tx.toLowerCase().includes('buy')
  return (
    <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs mx-2">
      <span className={`font-bold ${isBuy ? 'text-emerald-400' : 'text-red-400'}`}>
        {isBuy ? '▲' : '▼'} {ticker}
      </span>
      <span className={`font-medium ${partyColor(party)}`}>{name.split(' ').slice(-1)[0]}</span>
      <span className="text-muted-foreground">{amount}</span>
    </span>
  )
}

// ── page ──────────────────────────────────────────────────────────────────────

export default async function LandingPage() {
  const [stats, feed, leaderboard] = await Promise.allSettled([
    apiFetch<PlatformStats>('/stats', { revalidate: 3600 }),
    apiFetch<FeedResponse>('/feed?limit=20', { revalidate: 3600 }),
    apiFetch<LeaderboardResponse>('/leaderboard/returns?limit=5', { revalidate: 3600 }),
  ])

  const s = stats.status === 'fulfilled' ? stats.value : null
  const feedEntries = feed.status === 'fulfilled' ? feed.value.entries : []
  const topTraders = leaderboard.status === 'fulfilled' ? leaderboard.value.entries : []
  const marqueeItems = [...feedEntries, ...feedEntries]

  return (
    <div className="-mt-10 -mx-4">

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 pb-20 pt-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% -10%, oklch(0.55 0.22 255 / 18%) 0%, transparent 70%), radial-gradient(ellipse 40% 30% at 80% 60%, oklch(0.72 0.17 195 / 10%) 0%, transparent 60%)',
          }}
        />
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Updated every 15 minutes
            </div>

            <h1 className="text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              See What Congress
              <br />
              <span className="text-primary">Is Trading</span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
              Every STOCK Act disclosure — organized by politician, ticker, and return.
              Track the trades Congress members must report by law.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/feed"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/30"
              >
                View Live Feed <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/leaderboard/returns"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-all hover:border-primary/40 hover:bg-card/80"
              >
                <TrendingUp className="h-4 w-4 text-primary" />
                Returns Leaderboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ──────────────────────────────────────────────────────── */}
      {s && (
        <section className="border-y border-border/60 bg-card/40 px-4 py-10">
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
              <StatCard label="Trades Tracked" value={formatNum(s.total_trades)} />
              <StatCard label="Members Monitored" value={formatNum(s.total_politicians)} />
              <StatCard label="Tickers Covered" value={formatNum(s.total_tickers)} />
              <StatCard
                label="Latest Disclosure"
                value={
                  s.latest_trade_date
                    ? new Date(s.latest_trade_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—'
                }
                sub={
                  s.latest_trade_date
                    ? new Date(s.latest_trade_date).getFullYear().toString()
                    : undefined
                }
              />
            </div>
          </div>
        </section>
      )}

      {/* ── Scrolling ticker feed ──────────────────────────────────────────── */}
      {marqueeItems.length > 0 && (
        <section className="overflow-hidden border-b border-border/40 py-4">
          <div
            className="flex w-max"
            style={{ animation: 'marquee 60s linear infinite' }}
          >
            {marqueeItems.map((e, i) => (
              <TradeMarqueeItem
                key={`${e.trade_id}-${i}`}
                name={e.full_name}
                ticker={e.ticker}
                tx={e.transaction_type}
                amount={e.amount_range_raw}
                party={e.party}
              />
            ))}
          </div>
          <style>{`
            @keyframes marquee {
              0%   { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
          `}</style>
        </section>
      )}

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Everything you need to follow the money
            </h2>
            <p className="mt-3 text-muted-foreground">
              Built on mandatory STOCK Act disclosures. No guesswork — real reported trades.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={Activity}
              title="Live Activity Feed"
              description="See every new disclosure as it comes in — filter by party, chamber, or ticker. Refreshed every 15 minutes."
              href="/feed"
            />
            <FeatureCard
              icon={Users}
              title="Politician Profiles"
              description="Deep dive on any Congress member — full trade history, buy/sell ratio, top tickers, and estimated returns."
            />
            <FeatureCard
              icon={TrendingUp}
              title="Returns Leaderboard"
              description="Who's beating the market? Ranked by estimated average return on disclosed equity trades."
              href="/leaderboard/returns"
            />
            <FeatureCard
              icon={BarChart2}
              title="Volume Leaderboard"
              description="The most active traders in Congress — sorted by total disclosed trades across any time window."
              href="/leaderboard/volume"
            />
            <FeatureCard
              icon={Search}
              title="Ticker-Level Analysis"
              description="See congressional consensus on any stock — who bought, who sold, when, and for how much."
            />
            <FeatureCard
              icon={PieChart}
              title="Party & Chamber Breakdown"
              description="Visualize buy/sell patterns across Democrats vs Republicans, House vs Senate."
            />
            <FeatureCard
              icon={GitPullRequest}
              title="Amendment Tracking"
              description="When Congress members revise their disclosures, we capture the amendment automatically."
            />
            <FeatureCard
              icon={Clock}
              title="Disclosure Lag"
              description="See how quickly each member files — STOCK Act requires reporting within 45 days of a trade."
            />
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 p-5 text-center">
              <p className="text-sm font-medium text-muted-foreground">More coming soon</p>
              <p className="text-xs text-muted-foreground/70">
                Email alerts · API access · Portfolio overlap
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Top Performers preview ─────────────────────────────────────────── */}
      {topTraders.length > 0 && (
        <section className="border-y border-border/60 bg-card/30 px-4 py-20">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">Top Performers</h2>
                <p className="mt-2 text-muted-foreground">
                  Congress members ranked by estimated average return on public equity trades.
                </p>
              </div>
              <Link
                href="/leaderboard/returns"
                className="shrink-0 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                Full leaderboard <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="overflow-hidden rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground w-8">#</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Member</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Avg Return</th>
                    <th className="hidden px-4 py-3 text-right font-medium text-muted-foreground sm:table-cell">
                      Trades
                    </th>
                    <th className="hidden px-4 py-3 text-right font-medium text-muted-foreground md:table-cell">
                      Low / High
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topTraders.map((entry, i) => (
                    <tr
                      key={entry.politician_id}
                      className="border-b border-border/40 last:border-0 transition-colors hover:bg-muted/20"
                    >
                      <td className="px-4 py-3.5 text-muted-foreground font-mono">{i + 1}</td>
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/politicians/${entry.politician_id}`}
                          className="font-medium text-foreground hover:text-primary"
                        >
                          {entry.full_name}
                        </Link>
                      </td>
                      <td
                        className={`px-4 py-3.5 text-right font-bold tabular-nums ${returnColor(Number(entry.avg_return_pct))}`}
                      >
                        {Number(entry.avg_return_pct) > 0 ? '+' : ''}
                        {Number(entry.avg_return_pct).toFixed(1)}%
                      </td>
                      <td className="hidden px-4 py-3.5 text-right text-muted-foreground tabular-nums sm:table-cell">
                        {entry.trade_count}
                      </td>
                      <td className="hidden px-4 py-3.5 text-right text-xs text-muted-foreground tabular-nums md:table-cell">
                        {Number(entry.return_low).toFixed(1)}% / {Number(entry.return_high).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
          </div>
          <div className="mx-auto max-w-2xl space-y-6">
            {[
              {
                title: 'Congress files a STOCK Act disclosure',
                desc: 'Members of Congress are legally required to report personal trades within 45 days. These filings are public record.',
              },
              {
                title: 'We ingest and normalize every trade',
                desc: 'Our pipeline fetches disclosures continuously, normalizes them into a structured format, and calculates estimated returns for each equity trade.',
              },
              {
                title: "You explore it — free",
                desc: "Search by politician, company, or ticker. Compare members. See who's beating the market with their own disclosed trades.",
              },
            ].map((step, i) => (
              <div key={i} className="flex gap-4">
                <StepBadge n={i + 1} />
                <div className="pt-0.5">
                  <p className="font-semibold text-foreground">{step.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ─────────────────────────────────────────────────────── */}
      <section className="relative border-t border-border/60 px-4 py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-48 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl"
          style={{ background: 'oklch(0.55 0.22 255 / 40%)' }}
        />
        <div className="mx-auto max-w-7xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Start tracking congressional trades
          </h2>
          <p className="mt-3 text-muted-foreground">
            Free access. Real data. No account required.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/feed"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
            >
              View Live Feed <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/leaderboard/returns"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-3 font-semibold text-foreground transition-all hover:border-primary/40"
            >
              <TrendingUp className="h-4 w-4 text-primary" />
              See Who&apos;s Winning
            </Link>
          </div>
        </div>
      </section>

      <div className="pb-14" />
    </div>
  )
}
