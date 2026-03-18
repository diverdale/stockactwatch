import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Disclaimer — Stock Act Watch',
  alternates: { canonical: '/disclaimer' },
}

export default function DisclaimerPage() {
  return (
    <div className="max-w-2xl mx-auto py-4">
      <h1 className="text-3xl font-bold tracking-tight mb-2">Disclaimer</h1>
      <p className="text-muted-foreground text-sm mb-10">Effective date: March 2025</p>

      <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 text-amber-300/90">
          <p className="font-semibold text-amber-300 mb-1">Not investment advice</p>
          <p>
            Stock Act Watch is an informational transparency tool. Nothing on this site should
            be construed as a recommendation to buy, sell, or hold any security. Past performance
            of any politician's disclosed trades is not indicative of future results.
          </p>
        </div>

        <div>
          <h2 className="text-base font-bold text-foreground mb-2">Data Sources & Accuracy</h2>
          <p>
            All trade data is sourced from publicly available STOCK Act disclosures filed with
            the House and Senate. We aggregate this data via{' '}
            <a href="https://quiverquant.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
              Quiver Quantitative
            </a>
            . We do not independently verify individual filings. Errors, late filings, and
            amendments in source data may result in inaccuracies on this site.
          </p>
        </div>

        <div>
          <h2 className="text-base font-bold text-foreground mb-2">Estimated Returns</h2>
          <p>
            Where shown, estimated returns are calculated using the midpoint of the reported
            dollar range and historical price data. They are illustrative only and do not
            account for partial sales, position sizing, options complexity, dividends, taxes,
            or any other factor that would affect actual investment outcomes. They must not
            be used as investment signals.
          </p>
        </div>

        <div>
          <h2 className="text-base font-bold text-foreground mb-2">Committee Conflicts</h2>
          <p>
            Trades flagged as potential "committee conflicts" indicate that a member traded in
            a sector their committee oversees. This is a transparency signal — it is{' '}
            <strong className="text-foreground">not evidence of wrongdoing or illegal trading</strong>.
            The STOCK Act permits these trades provided they are properly disclosed. Our flags
            are based on sector-committee mapping and should not be interpreted as legal
            conclusions.
          </p>
        </div>

        <div>
          <h2 className="text-base font-bold text-foreground mb-2">No Affiliation</h2>
          <p>
            Stock Act Watch is an independent service. We are not affiliated with, endorsed by,
            or in any way connected to the US Congress, any government agency, or any political
            party or politician whose trades appear on this site.
          </p>
        </div>

        <div>
          <h2 className="text-base font-bold text-foreground mb-2">Limitation of Liability</h2>
          <p>
            Stock Act Watch and its operators accept no liability for decisions made based on
            information displayed on this site. Use of this site is subject to our{' '}
            <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
              Terms of Use
            </Link>
            .
          </p>
        </div>

        <p className="pt-2 border-t border-border/40">
          Questions?{' '}
          <a href="mailto:hello@stockactwatch.com" className="underline underline-offset-2 hover:text-foreground">
            hello@stockactwatch.com
          </a>
        </p>
      </div>
    </div>
  )
}
