// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Congress Trades — Track Congressional Stock Disclosures',
  description:
    'Publicly disclosed stock trades by US Congress members under the STOCK Act. Leaderboards, politician profiles, and ticker activity.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <NuqsAdapter>
          <SiteNav />
          <main className="mx-auto max-w-7xl px-4 py-10 pb-14">{children}</main>
          <SiteFooter />
        </NuqsAdapter>
      </body>
    </html>
  )
}
