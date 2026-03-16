'use client'

import { SignInButton, SignUpButton } from '@clerk/nextjs'
import { Lock, Zap } from 'lucide-react'
import Link from 'next/link'

interface Props {
  children?: React.ReactNode
  /** When true, shows blurred preview + unlock overlay */
  locked: boolean
  message?: string
  className?: string
  /** 'inline' clips to ~224px; 'page' clips to ~480px for full-page teasers */
  size?: 'inline' | 'page'
}

export function PaywallGate({ children, locked, message, className = '', size = 'inline' }: Props) {
  if (!locked) return <>{children}</>

  const previewHeight = size === 'page' ? 'max-h-[480px]' : 'max-h-56'

  return (
    <div className={`relative rounded-xl overflow-hidden ${className}`}>
      {/* Blurred preview */}
      {children && (
        <div className={`pointer-events-none select-none blur-sm opacity-30 ${previewHeight} overflow-hidden`}>
          {children}
        </div>
      )}

      {/* Overlay */}
      <div className={`${children ? 'absolute inset-0' : 'py-16'} flex flex-col items-center justify-center bg-gradient-to-t from-background via-background/90 to-transparent px-6 text-center`}>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/20 mb-3">
          <Lock className="h-4 w-4 text-primary" />
        </div>
        <p className="text-sm font-semibold mb-1">
          {message ?? 'Sign in to unlock full access'}
        </p>
        <p className="text-xs text-muted-foreground mb-5 max-w-xs leading-relaxed">
          Create a free account to access all trades, charts, AI analysis, and more.
          Pro subscription launching soon.
        </p>
        <div className="flex items-center gap-3">
          <SignInButton>
            <button className="rounded-lg border border-border/60 bg-card/60 px-4 py-2 text-xs font-medium hover:bg-accent transition-colors">
              Sign in
            </button>
          </SignInButton>
          <SignUpButton>
            <button className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5">
              <Zap className="h-3 w-3" />
              Get started free
            </button>
          </SignUpButton>
        </div>
        <Link href="/pricing" className="mt-3 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors">
          View pricing →
        </Link>
      </div>
    </div>
  )
}
