import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

const API_URL = process.env.API_URL ?? 'http://localhost:8000'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json([], { status: 200 })

  const res = await fetch(`${API_URL}/watchlist`, {
    headers: { 'X-User-Id': userId },
    cache: 'no-store',
  })
  const data = await res.json().catch(() => [])
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const res = await fetch(`${API_URL}/watchlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
