import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Use — Congress Trades',
  alternates: { canonical: '/terms' },
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold mb-2">{title}</h2>
      <div className="text-muted-foreground leading-relaxed space-y-3 text-sm">{children}</div>
    </section>
  )
}

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto py-4">
      <h1 className="text-3xl font-bold tracking-tight mb-2">Terms of Use</h1>
      <p className="text-muted-foreground text-sm mb-10">Last updated: March 2025</p>

      <Section title="Acceptance of Terms">
        <p>
          By accessing or using Congress Trades ("the site"), you agree to be bound by these
          Terms of Use. If you do not agree, please do not use the site.
        </p>
      </Section>

      <Section title="Description of Service">
        <p>
          Congress Trades aggregates and displays publicly available STOCK Act disclosures filed
          by US Congress members. The site provides tools for browsing, filtering, and analysing
          this public data. It is an informational service only.
        </p>
      </Section>

      <Section title="Not Financial Advice">
        <p>
          Nothing on this site constitutes financial, investment, legal, or tax advice. All data
          is presented for informational and transparency purposes only. You should not rely on
          this site to make investment decisions. Consult a qualified financial advisor before
          making any investment.
        </p>
        <p>
          Estimated returns shown are illustrative calculations based on publicly reported
          trade ranges and historical prices. They are not predictions of future performance
          and do not account for position sizing, partial sales, dividends, taxes, or other
          factors.
        </p>
      </Section>

      <Section title="Data Accuracy">
        <p>
          We make reasonable efforts to display accurate data, but we do not guarantee the
          completeness, accuracy, or timeliness of any information on this site. Source data
          may contain errors, late filings, or amendments. Always verify against official
          government disclosures before relying on any specific figure.
        </p>
      </Section>

      <Section title="Permitted Use">
        <p>You may use this site for personal, non-commercial research and informational purposes.</p>
        <p>You may not:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Scrape or systematically extract data beyond normal browsing without a paid API plan</li>
          <li>Use the site to build a competing product that resells our curated data</li>
          <li>Attempt to circumvent any rate limiting or access controls</li>
          <li>Use the site in any way that violates applicable law</li>
        </ul>
      </Section>

      <Section title="API Access">
        <p>
          API access is provided subject to additional rate limits and terms published at the
          time of launch. Paid API plans confer a licence to use the data within the limits of
          the selected plan.
        </p>
      </Section>

      <Section title="Intellectual Property">
        <p>
          The underlying congressional trade data is public domain. Our aggregation, formatting,
          analysis, and derived metrics (estimated returns, sector conflict flags, leaderboard
          rankings) are our own work product. Reproduction of our derived datasets or substantial
          portions of our UI without permission is prohibited.
        </p>
      </Section>

      <Section title="Limitation of Liability">
        <p>
          To the maximum extent permitted by law, Congress Trades and its operators shall not
          be liable for any direct, indirect, incidental, or consequential damages arising from
          your use of the site or reliance on any data displayed. Your use is at your own risk.
        </p>
      </Section>

      <Section title="Changes to Terms">
        <p>
          We may update these terms at any time. Continued use of the site after updates
          constitutes acceptance of the revised terms.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions?{' '}
          <a href="mailto:hello@stockactwatch.com" className="underline underline-offset-2 hover:text-foreground">
            hello@stockactwatch.com
          </a>
        </p>
      </Section>
    </div>
  )
}
