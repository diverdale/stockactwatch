import { NextResponse } from 'next/server'

export async function GET() {
  const res = await fetch(`${process.env.API_URL}/feed?limit=8`, { next: { revalidate: 60 } })
  if (!res.ok) return NextResponse.json({ entries: [] }, { status: res.status })
  return NextResponse.json(await res.json())
}
