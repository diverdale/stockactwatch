'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SignUpButton, useUser } from '@clerk/nextjs'
import {
  Check,
  Minus,
  Zap,
  Users,
  TrendingUp,
  Scale,
  Network,
  Sparkles,
  BookmarkPlus,
  LayoutDashboard,
  Trophy,
  Layers,
  Bell,
  Shield,
} from 'lucide-react'

// ── Feature list ───────────────────────────────────────────────────────────

interface Feature {
  label: string
  icon: React.ElementType
  free: boolean | string
  pro: boolean | string
  note?: string
}

const FEATURES: Feature[] = [
  { label: 'Trade feed',                    icon: Zap,           free: 'Last 30 days',  pro: 'Full history'     },
  { label: 'Politician profiles',           icon: Users,         free: 'Basic',         pro: 'Full detail'      },
  { label: 'Ticker pages',                  icon: TrendingUp,    free: 'Basic',         pro: 'Full detail'      },
  { label: 'Leaderboard',                   icon: Trophy,        free: false,           pro: true               },
  { label: 'Sector explorer',               icon: Layers,        free: false,           pro: true               },
  { label: 'Cluster analysis',              icon: Network,       free: false,           pro: true               },
  { label: 'Committee conflict detection',  icon: Scale,         free: false,           pro: true               },
  { label: 'Watchlist',                     icon: BookmarkPlus,  free: false,           pro: true               },
  { label: 'Personal dashboard',            icon: LayoutDashboard, free: false,         pro: true               },
  { label: 'Ask AI',                        icon: Sparkles,      free: false,           pro: '20 queries / mo'  },
  { label: 'AI query history',              icon: Sparkles,      free: false,           pro: true               },
  { label: 'Trade alerts',                  icon: Bell,          free: false,           pro: 'Coming soon'      },
]

function FeatureCell({ value }: { value: boolean | string }) {
  if (value === true)  return <Check className="h-4 w-4 text-emerald-400 mx-auto" />
  if (value === false) return <Minus className="h-4 w-4 text-muted-foreground/25 mx-auto" />
  return (
    <span className="text-xs font-medium text-primary/90 whitespace-nowrap">{value}</span>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function PricingClient() {
  const [annual, setAnnual] = useState(true)
  const { isSignedIn } = useUser()

  const monthlyPrice = 19
  const annualTotal = 190
  const annualMonthly = (annualTotal / 12).toFixed(2)
  const savings = monthlyPrice * 12 - annualTotal

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">

      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-xs font-medium text-primary mb-4">
          <Zap className="h-3 w-3" />
          2026 Midterm Election Cycle
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-3">
          Know what Congress is trading.
          <br />
          <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Before the market does.
          </span>
        </h1>
        <p className="text-muted-foreground text-sm max-w-lg mx-auto leading-relaxed">
          With midterms approaching, congressional trading activity is heating up.
          Get full access to every trade, conflict alert, and AI-powered insight —
          at the price of a few cups of coffee a month.
        </p>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <span className={`text-sm font-medium ${!annual ? 'text-foreground' : 'text-muted-foreground'}`}>
          Monthly
        </span>
        <button
          onClick={() => setAnnual(a => !a)}
          className={`relative h-6 w-11 rounded-full transition-colors ${annual ? 'bg-primary' : 'bg-muted/60'}`}
        >
          <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${annual ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
        <span className={`text-sm font-medium flex items-center gap-2 ${annual ? 'text-foreground' : 'text-muted-foreground'}`}>
          Annual
          <span className="rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold px-2 py-0.5 border border-emerald-500/20">
            2 MONTHS FREE
          </span>
        </span>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12 max-w-2xl mx-auto">

        {/* Free */}
        <div className="rounded-xl border border-border/60 bg-card/30 p-6 flex flex-col">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Free</p>
          <div className="mb-1">
            <span className="text-4xl font-bold">$0</span>
          </div>
          <p className="text-xs text-muted-foreground mb-6">No credit card required.</p>
          <ul className="space-y-2.5 mb-8 flex-1">
            {[
              'Last 30 days of trades',
              'Basic politician & ticker pages',
              'Public landing page stats',
            ].map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <Link
            href="/"
            className="w-full text-center rounded-lg border border-border/60 px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
          >
            Browse free
          </Link>
        </div>

        {/* Pro */}
        <div className="rounded-xl border border-primary/50 bg-gradient-to-b from-primary/8 to-card/40 p-6 flex flex-col shadow-lg shadow-primary/10 relative overflow-hidden">
          {/* Background glow */}
          <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-primary/10 blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Pro</p>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-primary px-2 py-0.5 rounded-full">
              Most Popular
            </span>
          </div>

          <div className="mb-1 flex items-end gap-2">
            <span className="text-4xl font-bold tabular-nums">
              ${annual ? annualMonthly : monthlyPrice}
            </span>
            <span className="text-sm text-muted-foreground mb-1">/ month</span>
          </div>

          {annual ? (
            <p className="text-xs text-emerald-400 font-medium mb-6">
              Billed ${annualTotal}/yr — you save ${savings}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mb-6">
              Billed monthly · Save ${savings} with annual
            </p>
          )}

          <ul className="space-y-2.5 mb-8 flex-1">
            {[
              'Full trade history — all time',
              'All politician & ticker profiles',
              'Leaderboard, sectors & clusters',
              'Committee conflict detection',
              'Watchlist + personal dashboard',
              'Ask AI — 20 queries/month',
              'AI query history',
              'Trade alerts (coming soon)',
            ].map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-foreground/90">
                <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          {isSignedIn ? (
            <button
              disabled
              className="w-full text-center rounded-lg bg-primary/60 text-primary-foreground px-4 py-2.5 text-sm font-semibold cursor-not-allowed opacity-60"
            >
              Coming soon
            </button>
          ) : (
            <SignUpButton>
              <button className="w-full text-center rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors">
                Get started free →
              </button>
            </SignUpButton>
          )}

          <p className="text-[10px] text-muted-foreground text-center mt-3">
            Stripe billing coming soon · Sign up now for early access
          </p>
        </div>
      </div>

      {/* Feature comparison */}
      <div className="mb-12">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 text-center">
          Full feature breakdown
        </h2>
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/20">
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Feature</th>
                <th className="px-4 py-3 font-semibold text-center text-muted-foreground w-32">Free</th>
                <th className="px-4 py-3 font-semibold text-center text-primary w-32">Pro</th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f, i) => {
                const Icon = f.icon
                return (
                  <tr
                    key={f.label}
                    className={`border-b border-border/60 last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/5'}`}
                  >
                    <td className="px-5 py-3 text-muted-foreground flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                      {f.label}
                    </td>
                    <td className="px-4 py-3 text-center"><FeatureCell value={f.free} /></td>
                    <td className="px-4 py-3 text-center"><FeatureCell value={f.pro} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trust + FAQ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        {[
          {
            icon: Shield,
            title: 'Data straight from Congress',
            body: 'All trades sourced directly from official STOCK Act disclosures filed with the House and Senate.',
          },
          {
            icon: Zap,
            title: 'Updated daily',
            body: 'New disclosures are ingested and processed every day so you\'re never looking at stale data.',
          },
          {
            icon: Sparkles,
            title: 'AI built for this data',
            body: 'Ask plain-English questions about trading patterns, suspicion scores, and committee conflicts.',
          },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-xl border border-border/60 bg-card/30 p-5">
            <Icon className="h-5 w-5 text-primary mb-3" />
            <p className="text-sm font-semibold mb-1.5">{title}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
          </div>
        ))}
      </div>

      {/* Election cycle CTA */}
      <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/8 via-primary/5 to-transparent p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">
          2026 Midterm Election Cycle
        </p>
        <h3 className="text-xl font-bold mb-2">
          Midterm trading patterns are already emerging.
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4 leading-relaxed">
          Congressional trading historically spikes in the 12 months before an election.
          Create a free account now and be ready when paid access launches.
        </p>
        {isSignedIn ? (
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Go to dashboard
          </Link>
        ) : (
          <SignUpButton>
            <button className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors">
              <Zap className="h-3.5 w-3.5" />
              Create free account
            </button>
          </SignUpButton>
        )}
      </div>

    </div>
  )
}
