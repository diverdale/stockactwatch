import Link from 'next/link'
import { BarChart2 } from 'lucide-react'

const PRODUCT = [
  { href: '/guide',   label: 'How It Works' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/api',     label: 'API (coming soon)', soon: true },
]

const DATA = [
  { href: '/feed',       label: 'Trades' },
  { href: '/politicians', label: 'Politicians' },
  { href: '/tickers',    label: 'Tickers' },
  { href: '/sectors',    label: 'Sectors' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/conflicts',  label: 'Conflicts' },
]

const LEGAL = [
  { href: '/privacy',     label: 'Privacy Policy' },
  { href: '/terms',       label: 'Terms of Use' },
  { href: '/disclaimer',  label: 'Disclaimer' },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border/40 bg-background mt-16">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">

          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 font-bold text-base mb-3">
              <BarChart2 className="h-4 w-4 text-primary" />
              Congress Trades
            </Link>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-[220px]">
              Congressional stock trade disclosures made transparent. Data sourced from public
              STOCK Act filings.
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              Not financial advice.
            </p>
          </div>

          {/* Explore */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Explore
            </p>
            <ul className="space-y-2">
              {DATA.map(l => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Product */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Product
            </p>
            <ul className="space-y-2">
              {PRODUCT.map(l => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className={`text-sm transition-colors ${
                      l.soon
                        ? 'text-muted-foreground/50 pointer-events-none'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <span className="text-sm text-muted-foreground/50">
                  Sign In (coming soon)
                </span>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Legal
            </p>
            <ul className="space-y-2">
              {LEGAL.map(l => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border/40 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Congress Trades. All rights reserved.</p>
          <p className="text-center">
            Data sourced from public STOCK Act disclosures via{' '}
            <a
              href="https://quiverquant.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors underline underline-offset-2"
            >
              Quiver Quantitative
            </a>
            {' '}and{' '}
            <a
              href="https://congress.gov"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors underline underline-offset-2"
            >
              Congress.gov
            </a>
            . Estimated returns are illustrative only.
          </p>
        </div>
      </div>
    </footer>
  )
}
