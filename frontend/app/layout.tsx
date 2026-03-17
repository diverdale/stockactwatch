// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://stockactwatch.com'),
  title: {
    default: 'Stock Act Watch — Track Congressional Stock Disclosures',
    template: '%s | Stock Act Watch',
  },
  description:
    'Publicly disclosed stock trades by US Congress members under the STOCK Act. Leaderboards, politician profiles, suspicion scoring, and ticker activity.',
  keywords: [
    'congressional stock trades', 'STOCK Act', 'Congress trading', 'politician stocks',
    'congressional disclosure', 'insider trading Congress', 'Nancy Pelosi trades',
    'congressional trading tracker',
  ],
  openGraph: {
    type: 'website',
    siteName: 'Stock Act Watch',
    title: 'Stock Act Watch — Track Congressional Stock Disclosures',
    description:
      'Every STOCK Act disclosure by US Congress members — organized by politician, ticker, and return.',
    url: 'https://stockactwatch.com',
    images: [{ url: '/stock_act_watch_logo.png', width: 512, height: 512, alt: 'Stock Act Watch' }],
  },
  twitter: {
    card: 'summary',
    title: 'Stock Act Watch',
    description: 'Track every congressional stock trade disclosed under the STOCK Act.',
    images: ['/stock_act_watch_logo.png'],
  },
  alternates: { canonical: 'https://stockactwatch.com' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <NuqsAdapter>
            <SiteNav />
            <main className="mx-auto max-w-7xl px-4 py-10 pb-14">{children}</main>
            <SiteFooter />
          </NuqsAdapter>
        </Providers>
      </body>
    </html>
  )
}
