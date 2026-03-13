// app/api/revalidate/route.ts
import { revalidateTag } from 'next/cache'
import { NextRequest } from 'next/server'

const ALLOWED_TAGS = new Set(['feed', 'leaderboard-returns', 'leaderboard-volume', 'politicians', 'tickers'])

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { tag?: string; secret?: string }
  const { tag, secret } = body

  if (!secret || secret !== process.env.REVALIDATE_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!tag || !ALLOWED_TAGS.has(tag)) {
    return Response.json({ error: `Unknown tag: ${tag}` }, { status: 400 })
  }

  revalidateTag(tag, 'default')
  return Response.json({ revalidated: true, tag, at: new Date().toISOString() })
}
