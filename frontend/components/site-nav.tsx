// components/site-nav.tsx
import Link from 'next/link'
import { SearchCombobox } from '@/components/search-combobox'

const links = [
  { href: '/feed', label: 'Activity Feed' },
  { href: '/leaderboard/returns', label: 'Returns Leaderboard' },
  { href: '/leaderboard/volume', label: 'Volume Leaderboard' },
]

export function SiteNav() {
  return (
    <nav className="border-b bg-background">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Congress Trades
        </Link>
        <div className="flex gap-4 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
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
