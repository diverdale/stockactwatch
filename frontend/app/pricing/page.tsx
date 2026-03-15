import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, Minus } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Pricing — Congress Trades',
  description: 'Plans for accessing Congress Trades data — from free public browsing to full API access.',
  alternates: { canonical: '/pricing' },
}

interface Feature {
  label: string
  free: boolean | string
  pro: boolean | string
  enterprise: boolean | string
}

const FEATURES: Feature[] = [
  { label: 'Trade feed (recent 1,000)',          free: true,       pro: true,            enterprise: true },
  { label: 'Politician profiles',                free: true,       pro: true,            enterprise: true },
  { label: 'Sector & ticker explorer',           free: true,       pro: true,            enterprise: true },
  { label: 'Leaderboard',                        free: true,       pro: true,            enterprise: true },
  { label: 'Full historical trade archive',      free: false,      pro: true,            enterprise: true },
  { label: 'Committee conflict alerts',          free: 'preview',  pro: true,            enterprise: true },
  { label: 'Pre-hearing trade signals',          free: false,      pro: true,            enterprise: true },
  { label: 'CSV export',                         free: false,      pro: true,            enterprise: true },
  { label: 'Email / webhook alerts',             free: false,      pro: true,            enterprise: true },
  { label: 'API access',                         free: false,      pro: '1,000 req/day', enterprise: 'Unlimited' },
  { label: 'Bulk data downloads',                free: false,      pro: false,           enterprise: true },
  { label: 'Custom filtering & watchlists',      free: false,      pro: true,            enterprise: true },
  { label: 'Priority support',                   free: false,      pro: false,           enterprise: true },
  { label: 'SLA & dedicated onboarding',         free: false,      pro: false,           enterprise: true },
]

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === true)  return <Check className="h-4 w-4 text-emerald-400 mx-auto" />
  if (value === false) return <Minus className="h-4 w-4 text-muted-foreground/30 mx-auto" />
  return <span className="text-xs text-amber-400 font-medium">{value}</span>
}

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Public data, no account required.',
    highlight: false,
    cta: 'Browse now',
    ctaHref: '/',
    ctaStyle: 'border border-border text-foreground hover:bg-accent',
  },
  {
    name: 'Pro',
    price: '$19',
    period: 'per month',
    description: 'Full history, alerts, and API access for individual researchers and investors.',
    highlight: true,
    cta: 'Coming soon',
    ctaHref: '#',
    ctaStyle: 'bg-primary text-primary-foreground opacity-60 cursor-not-allowed',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'Bulk data, unlimited API, SLA, and dedicated support for teams and platforms.',
    highlight: false,
    cta: 'Contact us',
    ctaHref: 'mailto:hello@congresstrades.io',
    ctaStyle: 'border border-border text-foreground hover:bg-accent',
  },
]

export default function PricingPage() {
  return (
    <div className="max-w-4xl mx-auto py-4">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold tracking-tight mb-3">Pricing</h1>
        <p className="text-muted-foreground text-sm max-w-xl mx-auto">
          Start free. Upgrade when you need full history, alerts, or API access.
          Stripe billing coming soon — sign up below to be notified.
        </p>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-xl border p-6 flex flex-col ${
              plan.highlight
                ? 'border-primary/60 bg-primary/5 shadow-lg shadow-primary/10'
                : 'border-border/60 bg-card/30'
            }`}
          >
            {plan.highlight && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3">
                Most Popular
              </span>
            )}
            <p className="text-lg font-bold">{plan.name}</p>
            <div className="mt-2 mb-1">
              <span className="text-3xl font-bold tabular-nums">{plan.price}</span>
              {plan.period && (
                <span className="text-sm text-muted-foreground ml-1">{plan.period}</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed flex-1">
              {plan.description}
            </p>
            <Link
              href={plan.ctaHref}
              className={`w-full text-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${plan.ctaStyle}`}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>

      {/* Feature comparison table */}
      <div className="overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/20">
              <th className="text-left px-5 py-3 font-medium text-muted-foreground w-1/2">Feature</th>
              {PLANS.map(p => (
                <th key={p.name} className={`px-4 py-3 font-semibold text-center w-[17%] ${p.highlight ? 'text-primary' : ''}`}>
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((f, i) => (
              <tr
                key={f.label}
                className={`border-b border-border/60 last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/5'}`}
              >
                <td className="px-5 py-3 text-muted-foreground">{f.label}</td>
                <td className="px-4 py-3 text-center"><FeatureValue value={f.free} /></td>
                <td className="px-4 py-3 text-center"><FeatureValue value={f.pro} /></td>
                <td className="px-4 py-3 text-center"><FeatureValue value={f.enterprise} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Early access note */}
      <div className="mt-8 rounded-xl border border-border/60 bg-card/30 px-6 py-5 text-sm text-muted-foreground leading-relaxed">
        <p className="font-semibold text-foreground mb-1">Stripe integration coming soon</p>
        <p>
          Paid plans are not yet active. When billing launches, existing users who sign up
          early will receive a discounted rate. The{' '}
          <Link href="/api" className="underline underline-offset-2 hover:text-foreground">
            developer API
          </Link>{' '}
          will be documented at launch with OpenAPI / Swagger spec.
        </p>
      </div>
    </div>
  )
}
