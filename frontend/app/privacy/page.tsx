import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Congress Trades',
  alternates: { canonical: '/privacy' },
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold mb-2">{title}</h2>
      <div className="text-muted-foreground leading-relaxed space-y-3 text-sm">{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto py-4">
      <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
      <p className="text-muted-foreground text-sm mb-10">Last updated: March 2025</p>

      <Section title="Overview">
        <p>
          Congress Trades ("we", "our", "us") is committed to protecting your privacy. This policy
          explains what information we collect, how we use it, and your rights regarding that
          information.
        </p>
        <p>
          This site primarily displays publicly available government data (STOCK Act disclosures).
          We do not sell your personal information to third parties.
        </p>
      </Section>

      <Section title="Information We Collect">
        <p>
          <strong className="text-foreground">Anonymous usage data:</strong> We collect standard
          server logs including IP addresses, browser type, pages visited, and referral URLs. This
          data is used solely to understand site performance and fix errors.
        </p>
        <p>
          <strong className="text-foreground">Account information (coming soon):</strong> When
          paid plans launch, we will collect email addresses and billing information (processed
          securely via Stripe — we do not store card details).
        </p>
        <p>
          <strong className="text-foreground">Cookies:</strong> We use minimal session cookies
          for site functionality. We do not use third-party advertising cookies.
        </p>
      </Section>

      <Section title="How We Use Your Information">
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>To operate and improve the site</li>
          <li>To send transactional emails (account confirmations, billing receipts)</li>
          <li>To notify you of plan updates if you opted in</li>
          <li>To comply with legal obligations</li>
        </ul>
      </Section>

      <Section title="Data Sources">
        <p>
          All congressional trade data displayed on this site is sourced from public STOCK Act
          filings. We do not own or control this data — it is public record available from the
          House and Senate disclosure offices.
        </p>
      </Section>

      <Section title="Data Retention">
        <p>
          Server logs are retained for 90 days. Account data is retained for the duration of
          your subscription and up to 30 days after cancellation unless deletion is requested.
        </p>
      </Section>

      <Section title="Your Rights">
        <p>
          You may request access to, correction of, or deletion of any personal data we hold
          about you by contacting us at{' '}
          <a href="mailto:hello@congresstrades.io" className="underline underline-offset-2 hover:text-foreground">
            hello@congresstrades.io
          </a>
          .
        </p>
      </Section>

      <Section title="Changes to This Policy">
        <p>
          We may update this policy as the site evolves. Material changes will be communicated
          via email to registered users. Continued use of the site after changes constitutes
          acceptance of the updated policy.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about this policy?{' '}
          <a href="mailto:hello@congresstrades.io" className="underline underline-offset-2 hover:text-foreground">
            hello@congresstrades.io
          </a>
        </p>
      </Section>
    </div>
  )
}
