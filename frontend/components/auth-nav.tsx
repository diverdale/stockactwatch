'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard } from 'lucide-react'
import { SignInButton, SignUpButton, UserButton, useUser } from '@clerk/nextjs'

export function AuthNav() {
  const pathname = usePathname()
  const { isSignedIn, isLoaded } = useUser()

  if (!isLoaded) return null

  return (
    <>
      {isSignedIn && (
        <>
          <div className="mx-1 h-4 w-px bg-border/60 shrink-0" />
          <Link
            href="/dashboard"
            className={`
              group flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium
              transition-all duration-150 whitespace-nowrap
              ${pathname === '/dashboard' || pathname.startsWith('/dashboard/')
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              }
            `}
          >
            <LayoutDashboard className={`h-3.5 w-3.5 shrink-0 transition-colors ${
              pathname === '/dashboard' ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-foreground'
            }`} />
            <span className="hidden xl:inline">Dashboard</span>
          </Link>
        </>
      )}
      <div className="flex items-center gap-3 shrink-0">
        {!isSignedIn ? (
          <>
            <SignInButton>
              <button className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton>
              <button className="text-xs font-medium rounded-md bg-primary/15 text-primary px-2.5 py-1.5 hover:bg-primary/25 transition-colors">
                Sign up
              </button>
            </SignUpButton>
          </>
        ) : (
          <UserButton appearance={{ elements: { avatarBox: 'h-7 w-7' } }} />
        )}
      </div>
    </>
  )
}
