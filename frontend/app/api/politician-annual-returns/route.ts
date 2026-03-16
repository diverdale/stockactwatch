import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_URL ?? 'http://localhost:8000'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const res = await fetch(`${API_URL}/politicians/${id}/annual-returns`, { cache: 'no-store' })
  if (!res.ok) return NextResponse.json({ entries: [] }, { status: res.status })
  return NextResponse.json(await res.json())
}
