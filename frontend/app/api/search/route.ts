import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const type = searchParams.get('type') ?? 'politicians'

  if (q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const validTypes = ['politicians', 'tickers']
  if (!validTypes.includes(type)) {
    return NextResponse.json({ results: [] })
  }

  const upstream = `${process.env.API_URL}/search/${type}?q=${encodeURIComponent(q)}`
  const res = await fetch(upstream, { cache: 'no-store' })
  // cache: 'no-store' is required — do NOT use next.revalidate here.
  // Next.js Route Handlers cache fetch() calls by default; no-store ensures fresh results.
  // The 30s Redis cache on FastAPI is the appropriate short-term cache layer.

  if (!res.ok) {
    return NextResponse.json({ results: [] })
  }

  return NextResponse.json(await res.json())
}
