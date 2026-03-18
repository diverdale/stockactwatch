import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'How It Works — Stock Act Watch',
  description: 'A guide to reading and using Stock Act Watch — congressional stock disclosure data explained.',
  alternates: { canonical: '/guide' },
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold mb-3">{title}</h2>
      <div className="text-muted-foreground leading-relaxed space-y-3 text-sm">{children}</div>
    </section>
  )
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-500/5 px-4 py-3 text-amber-800 dark:text-amber-300/90 text-sm leading-relaxed">
      {children}
    </div>
  )
}

function AiCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-violet-500/30 bg-gradient-to-br from-violet-950/40 via-card/40 to-indigo-950/30 px-4 py-3 text-sm leading-relaxed shadow-[0_0_16px_-6px_rgba(139,92,246,0.2)]">
      {children}
    </div>
  )
}

export default function GuidePage() {
  return (
    <div className="max-w-2xl mx-auto py-4">
      <h1 className="text-3xl font-bold tracking-tight mb-2">How It Works</h1>
      <p className="text-muted-foreground mb-10 text-sm">
        A plain-English guide to what this site tracks, how to read the data, and what the numbers actually mean.
      </p>

      <Section title="What is the STOCK Act?">
        <p>
          The Stop Trading on Congressional Knowledge (STOCK) Act (2012) requires all sitting US
          Senators and Representatives to publicly disclose personal stock trades within 45 days of
          execution. These filings are public record and form the raw data behind everything on this site.
        </p>
        <Callout>
          Trading on material non-public information is prohibited for Congress members. The STOCK Act
          adds a disclosure requirement — it does not ban trading in stocks related to their legislative work.
        </Callout>
      </Section>

      <Section title="Where does the data come from?">
        <p>
          Trade records are sourced from{' '}
          <a href="https://quiverquant.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
            Quiver Quantitative
          </a>
          , which aggregates and normalises raw STOCK Act disclosures. Committee membership data
          comes from{' '}
          <a href="https://congress.gov" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
            Congress.gov
          </a>{' '}
          and the{' '}
          <a href="https://unitedstates.github.io" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
            @unitedstates project
          </a>
          .
        </p>
        <p>
          Data is refreshed every 15 minutes for recent trades and nightly for historical records.
          There is typically a lag between when a trade occurs and when it appears here — disclosures
          can take up to 45 days to be filed and a further 1–2 days to process.
        </p>
      </Section>

      <Section title="Understanding trade amounts">
        <p>
          Congress members report trades in <strong className="text-foreground">ranges</strong>, not
          exact dollar amounts (e.g. "$15,001–$50,000"). We display the raw range as filed. Where
          we calculate estimated volume or returns, we use the midpoint of the reported range.
        </p>
        <p>
          The dollar tier indicator (<span className="font-mono text-primary">$</span> to{' '}
          <span className="font-mono text-primary">$$$$</span>) maps to:
        </p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li><span className="font-mono">$</span> — under $15,000</li>
          <li><span className="font-mono">$$</span> — $15,001–$100,000</li>
          <li><span className="font-mono">$$$</span> — $100,001–$500,000</li>
          <li><span className="font-mono">$$$$</span> — over $500,000</li>
        </ul>
      </Section>

      <Section title="Estimated returns">
        <p>
          Where a stock has been traded and we have historical price data, we calculate an
          illustrative estimated return by comparing the trade-day closing price to the current
          (or last available) price.
        </p>
        <Callout>
          Estimated returns are <strong>illustrative only</strong>. They do not account for
          partial sales, position sizing, options complexity, dividends, or taxes. They should
          not be used as investment signals.
        </Callout>
      </Section>

      <Section title="Committee Conflicts">
        <p>
          The <Link href="/conflicts" className="underline underline-offset-2 hover:text-foreground">Conflicts</Link>{' '}
          page flags trades where a member sits on a congressional committee that oversees the
          sector they traded in — for example, a member of the Senate Banking Committee buying
          bank stocks.
        </p>
        <p>
          This is <strong className="text-foreground">not evidence of wrongdoing</strong>. It is a
          transparency signal highlighting potential conflicts of interest as defined by the
          member's oversight responsibilities. The STOCK Act permits these trades as long as they
          are disclosed.
        </p>
      </Section>

      <Section title="Leaderboard rankings">
        <p>
          The <Link href="/leaderboard" className="underline underline-offset-2 hover:text-foreground">Leaderboard</Link>{' '}
          ranks members by two metrics you can toggle between:
        </p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li><strong className="text-foreground">Top Returns</strong> — sorted by average estimated return across all disclosed equity trades</li>
          <li><strong className="text-foreground">Most Active</strong> — sorted by total number of disclosed trades</li>
        </ul>
        <p>
          Members who have not filed any trades, or whose filings lack price data, may not appear
          in return rankings.
        </p>
      </Section>

      <Section title="AI Features">
        <p>
          Each politician profile includes two AI-powered features generated by{' '}
          <strong className="text-foreground">Claude</strong> (Anthropic):
        </p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>
            <strong className="text-foreground">✦ AI Trading Profile</strong> — a plain-English paragraph
            summarising a member's trading patterns, volume, compliance record, and most-traded stocks.
            Generated on first visit and cached for 7 days.
          </li>
          <li>
            <strong className="text-foreground">✦ Suspicion Score</strong> — every trade is scored 1–10
            based on rule-based signals: committee-sector overlap, filing lag, proximity to a committee
            hearing, trade size, and whether it was an options trade. Scores are computed automatically
            and displayed as a colour-coded badge on each trade row.
          </li>
        </ul>
        <AiCallout>
          <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent font-semibold">
            Suspicion scores are not accusations.
          </span>
          <span className="text-muted-foreground/90">
            {' '}A high score means a trade has characteristics statistically associated with potential
            conflicts of interest — committee oversight of the traded sector, late disclosure, large
            size. It is a transparency signal, not a legal finding.
          </span>
        </AiCallout>
      </Section>

      <Section title="Disclosure Grade">
        <p>
          Each member profile shows a <strong className="text-foreground">Disclosure Grade</strong> (A–F)
          based on how promptly they file trades relative to the 45-day STOCK Act deadline.
          Members with fewer than 5 trades on record do not receive a grade.
        </p>
        <p>The grade is a weighted composite of two components:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>
            <strong className="text-foreground">On-time % (65%)</strong> — percentage of trades
            disclosed within 45 days of execution
          </li>
          <li>
            <strong className="text-foreground">Lag score (35%)</strong> — how far below the
            45-day limit the average filing falls (lower average lag = higher score)
          </li>
        </ul>
        <p>The composite score maps to letter grades:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li><strong className="text-foreground">A</strong> — 85 and above</li>
          <li><strong className="text-foreground">B</strong> — 70–84</li>
          <li><strong className="text-foreground">C</strong> — 55–69</li>
          <li><strong className="text-foreground">D</strong> — 40–54</li>
          <li><strong className="text-foreground">F</strong> — below 40</li>
        </ul>
      </Section>

      <Section title="Data limitations">
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Filings can be amended — older records may differ from the original disclosure.</li>
          <li>Spousal and dependent trades are included in disclosures but not always clearly attributed.</li>
          <li>Options trades are shown but return calculations are marked non-applicable.</li>
          <li>Some members file late or with errors — data quality varies by politician.</li>
        </ul>
      </Section>

      <div className="mt-10 rounded-xl border border-border/60 bg-card/30 px-6 py-5 text-sm text-muted-foreground leading-relaxed">
        <p className="font-semibold text-foreground mb-1">Have a question not covered here?</p>
        <p>
          API access and developer documentation are coming soon. See our{' '}
          <Link href="/pricing" className="underline underline-offset-2 hover:text-foreground">pricing page</Link>{' '}
          for details on data subscriptions.
        </p>
      </div>
    </div>
  )
}
