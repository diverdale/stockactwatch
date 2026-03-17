'use client'
// components/site-nav.tsx
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
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
  Zap,
  Menu,
  X,
  LayoutDashboard,
} from 'lucide-react'
import { SearchCombobox } from '@/components/search-combobox'
import { ThemeToggle } from '@/components/theme-toggle'

const AuthNav = dynamic(() => import('./auth-nav').then(m => m.AuthNav), { ssr: false })

const links = [
  { href: '/feed',        label: 'Trades',      icon: Activity    },
  { href: '/politicians', label: 'Politicians',  icon: Users       },
  { href: '/tickers',     label: 'Tickers',      icon: TrendingUp  },
  { href: '/leaderboard', label: 'Leaderboard',  icon: Trophy      },
  { href: '/sectors',     label: 'Sectors',      icon: Layers      },
  { href: '/cluster',     label: 'Clusters',     icon: Network     },
  { href: '/conflicts',   label: 'Conflicts',    icon: Scale       },
  { href: '/pricing',     label: 'Pricing',      icon: Zap         },
  { href: '/ask',         label: 'Ask AI',       icon: Sparkles    },
]

function NavLink({ href, label, icon: Icon, onClick }: { href: string; label: string; icon: React.ElementType; onClick?: () => void }) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(href + '/')
  const isAsk = href === '/ask'

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`
        group flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium
        transition-all duration-150 whitespace-nowrap
        ${isAsk
          ? active
            ? 'bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30'
            : 'text-violet-400/70 hover:bg-violet-500/10 hover:text-violet-300 ring-1 ring-transparent hover:ring-violet-500/20'
          : active
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
        }
      `}
    >
      <Icon className={`h-4 w-4 shrink-0 ${
        isAsk
          ? active ? 'text-violet-300' : 'text-violet-400/60 group-hover:text-violet-300'
          : active ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-foreground'
      }`} />
      {label}
    </Link>
  )
}

export function SiteNav() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  // Close mobile menu on navigation
  const closeMobile = () => setMobileOpen(false)

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
        {/* gradient accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        <div className="flex w-full items-center gap-3 px-4 py-2.5">

          {/* Brand */}
          <Link
            href="/"
            onClick={closeMobile}
            className="group flex items-center gap-2.5 font-bold tracking-tight shrink-0"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/20 transition-all group-hover:bg-primary/25 group-hover:ring-primary/40">
              <Landmark className="h-4 w-4 text-primary" />
            </div>
            <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent text-sm">
              Congress Trades
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex flex-1 min-w-0 items-center gap-0.5 text-sm mx-1">
            <div className="h-5 w-px bg-border/60 mr-1" />
            {links.map(({ href, label, icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              const isAsk = href === '/ask'
              return (
                <Link
                  key={href}
                  href={href}
                  className={`
                    group flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium
                    transition-all duration-150 whitespace-nowrap
                    ${isAsk
                      ? active
                        ? 'bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30'
                        : 'text-violet-400/70 hover:bg-violet-500/10 hover:text-violet-300 ring-1 ring-transparent hover:ring-violet-500/20'
                      : active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                    }
                  `}
                >
                  {(() => {
                    const Icon = icon
                    return (
                      <Icon className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                        isAsk
                          ? active ? 'text-violet-300' : 'text-violet-400/60 group-hover:text-violet-300'
                          : active ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-foreground'
                      }`} />
                    )
                  })()}
                  <span className="hidden xl:inline">{label}</span>
                </Link>
              )
            })}
          </div>

          {/* Right side: search + theme + auth (desktop) + hamburger (mobile) */}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <SearchCombobox />
            <div className="hidden md:flex items-center gap-2">
              <ThemeToggle />
              <AuthNav />
            </div>
            {/* Hamburger — mobile only */}
            <button
              className="md:hidden flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
              onClick={() => setMobileOpen(o => !o)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-[49px] z-40 bg-background/95 backdrop-blur-sm border-t border-border/40 overflow-y-auto">
          <div className="px-4 py-4 space-y-1">
            {links.map(({ href, label, icon }) => (
              <NavLink key={href} href={href} label={label} icon={icon} onClick={closeMobile} />
            ))}

            <div className="my-3 border-t border-border/40" />

            <div className="flex items-center justify-between px-3 py-2">
              <ThemeToggle />
              <AuthNav />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
