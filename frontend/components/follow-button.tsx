'use client'

import { useState, useEffect, useTransition } from 'react'
import { useUser } from '@clerk/nextjs'
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react'

interface Props {
  type: 'politician' | 'ticker'
  refId: string
  className?: string
}

export function FollowButton({ type, refId, className = '' }: Props) {
  const { isSignedIn, isLoaded } = useUser()
  const [following, setFollowing] = useState(false)
  const [checked, setChecked] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!isLoaded || !isSignedIn) { setChecked(true); return }
    fetch(`/api/watchlist/${type}/${encodeURIComponent(refId)}`)
      .then(r => r.json())
      .then(d => { setFollowing(d.following ?? false); setChecked(true) })
      .catch(() => setChecked(true))
  }, [type, refId, isSignedIn, isLoaded])

  if (!isLoaded || !isSignedIn) return null

  function toggle() {
    startTransition(async () => {
      if (following) {
        await fetch(`/api/watchlist/${type}/${encodeURIComponent(refId)}`, { method: 'DELETE' })
        setFollowing(false)
      } else {
        await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, ref_id: refId }),
        })
        setFollowing(true)
      }
    })
  }

  if (!checked) return null

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
        following
          ? 'border-primary/40 bg-primary/15 text-primary hover:bg-primary/25'
          : 'border-border/60 bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/10'
      } ${className}`}
    >
      {isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : following ? (
        <BookmarkCheck className="h-3 w-3" />
      ) : (
        <Bookmark className="h-3 w-3" />
      )}
      {following ? 'Following' : 'Follow'}
    </button>
  )
}
