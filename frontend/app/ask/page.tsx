import type { Metadata } from 'next'
import { auth } from '@clerk/nextjs/server'
import { AskClient } from './ask-client'
import { PaywallGate } from '@/components/paywall-gate'

export const metadata: Metadata = {
  title: 'Ask the Data — Stock Act Watch',
  description: 'Ask natural language questions about congressional stock trading activity.',
  alternates: { canonical: '/ask' },
}

// Static teaser that mimics the Ask AI UI — shown blurred to signed-out users
function AskTeaser() {
  return (
    <div className="py-4 pointer-events-none select-none">
      <div className="max-w-2xl mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/20 ring-1 ring-violet-500/30" />
          <div className="h-8 w-48 rounded-lg bg-violet-400/20" />
        </div>
        <div className="h-4 w-80 rounded bg-muted/40 ml-12 mb-6" />
        <div className="h-12 w-full rounded-xl border border-violet-500/20 bg-card/60" />
        <div className="mt-5 flex flex-wrap gap-1.5">
          {[
            'Which politicians have a suspicion score higher than 7?',
            'Who bought NVDA stock in the last year?',
            'Show me trades near committee hearings',
            'Which senators have the best trading returns?',
          ].map(s => (
            <div key={s} className="rounded-full border border-border/60 bg-card/30 px-3 py-1 text-xs text-muted-foreground">
              {s}
            </div>
          ))}
        </div>
      </div>

      {/* Fake result */}
      <div className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-950/40 via-card/40 to-indigo-950/30 px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-3.5 w-3.5 rounded bg-violet-400/40" />
          <div className="h-3 w-20 rounded bg-violet-400/30" />
          <div className="ml-auto h-3 w-24 rounded bg-muted/30" />
        </div>
        <div className="space-y-2">
          <div className="h-3.5 w-full rounded bg-muted/30" />
          <div className="h-3.5 w-5/6 rounded bg-muted/30" />
          <div className="h-3.5 w-4/6 rounded bg-muted/30" />
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border/60 bg-card/30 overflow-hidden">
        <div className="px-4 pt-3 pb-2 border-b border-border/60">
          <div className="h-3 w-20 rounded bg-muted/30" />
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-2.5 border-b border-border/40 last:border-0">
            <div className="h-3 w-32 rounded bg-muted/20" />
            <div className="h-3 w-16 rounded bg-muted/20" />
            <div className="h-3 w-12 rounded bg-muted/20" />
            <div className="h-3 w-20 rounded bg-muted/20" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default async function AskPage() {
  const { userId } = await auth()
  const isSignedIn = !!userId

  if (!isSignedIn) {
    return (
      <PaywallGate locked size="page" message="Sign in to ask plain-English questions about congressional trading data">
        <AskTeaser />
      </PaywallGate>
    )
  }

  return <AskClient />
}
