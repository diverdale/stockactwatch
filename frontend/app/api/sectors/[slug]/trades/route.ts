import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const upstream = `${process.env.API_URL}/sectors/${encodeURIComponent(slug)}/trades`
  const res = await fetch(upstream, { cache: 'no-store' })
  if (!res.ok) {
    return NextResponse.json({ trades: [], total: 0 }, { status: res.status })
  }
  return NextResponse.json(await res.json())
}
