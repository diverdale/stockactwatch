import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

const API_URL = process.env.API_URL ?? 'http://localhost:8000'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string; refId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ following: false })

  const { type, refId } = await params
  const res = await fetch(`${API_URL}/watchlist/check/${type}/${refId}`, {
    headers: { 'X-User-Id': userId },
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({ following: false }))
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string; refId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, refId } = await params
  const res = await fetch(`${API_URL}/watchlist/${type}/${refId}`, {
    method: 'DELETE',
    headers: { 'X-User-Id': userId },
  })
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
