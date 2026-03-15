import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_URL ?? 'http://localhost:8000'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })

  try {
    const res = await fetch(`${API_URL}/ai/politicians/${id}/summary`, {
      next: { revalidate: 60 * 60 * 24 }, // cache 24h at edge
    })
    if (!res.ok) return NextResponse.json({ summary: null })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ summary: null })
  }
}
