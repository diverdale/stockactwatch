// components/site-nav.tsx
import Link from 'next/link'
import { BarChart2 } from 'lucide-react'
import { SearchCombobox } from '@/components/search-combobox'

const links = [
  { href: '/feed', label: 'Activity Feed' },
  { href: '/politicians', label: 'Politicians' },
  { href: '/leaderboard/returns', label: 'Returns' },
  { href: '/leaderboard/volume', label: 'Volume' },
  { href: '/cluster', label: 'Clusters' },
  { href: '/sectors', label: 'Sectors' },
]

export function SiteNav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <BarChart2 className="h-5 w-5 text-primary" />
          <span>Congress Trades</span>
        </Link>
        <div className="flex gap-1 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="ml-auto">
          <SearchCombobox />
        </div>
      </div>
    </nav>
  )
}
