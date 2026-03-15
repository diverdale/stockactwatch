'use client'
// components/site-nav.tsx
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Landmark,
  Activity,
  Users,
  TrendingUp,
  Trophy,
  Network,
  Layers,
  Scale,
  Sparkles,
} from 'lucide-react'
import { SearchCombobox } from '@/components/search-combobox'

const links = [
  { href: '/feed',        label: 'Trades',      icon: Activity    },
  { href: '/politicians', label: 'Politicians',  icon: Users       },
  { href: '/tickers',     label: 'Tickers',      icon: TrendingUp  },
  { href: '/leaderboard', label: 'Leaderboard',  icon: Trophy      },
  { href: '/sectors',     label: 'Sectors',      icon: Layers      },
  { href: '/cluster',     label: 'Clusters',     icon: Network     },
  { href: '/conflicts',   label: 'Conflicts',    icon: Scale       },
]

export function SiteNav() {
  const pathname = usePathname()
  const askActive = pathname === '/ask'

  return (
    <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
      {/* subtle gradient accent line at the bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2.5">

        {/* Brand */}
        <Link
          href="/"
          className="group flex items-center gap-2.5 font-bold tracking-tight shrink-0"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/20 transition-all group-hover:bg-primary/25 group-hover:ring-primary/40">
            <Landmark className="h-4 w-4 text-primary" />
          </div>
          <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent text-sm">
            Congress Trades
          </span>
        </Link>

        <div className="mx-1 h-5 w-px bg-border/60" />

        {/* Nav links */}
        <div className="flex items-center gap-0.5 text-sm overflow-x-auto scrollbar-none">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`
                  group flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium
                  transition-all duration-150 whitespace-nowrap
                  ${active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                  }
                `}
              >
                <Icon
                  className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                    active ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-foreground'
                  }`}
                />
                {label}
              </Link>
            )
          })}

          {/* AI Ask — visually distinct */}
          <div className="mx-1 h-4 w-px bg-border/60 shrink-0" />
          <Link
            href="/ask"
            className={`
              group flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium
              transition-all duration-150 whitespace-nowrap
              ${askActive
                ? 'bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30'
                : 'text-violet-400/70 hover:bg-violet-500/10 hover:text-violet-300 ring-1 ring-transparent hover:ring-violet-500/20'
              }
            `}
          >
            <Sparkles
              className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                askActive ? 'text-violet-300' : 'text-violet-400/60 group-hover:text-violet-300'
              }`}
            />
            Ask AI
          </Link>
        </div>

        {/* Search */}
        <div className="ml-auto shrink-0">
          <SearchCombobox />
        </div>
      </div>
    </nav>
  )
}
