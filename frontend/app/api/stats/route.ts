import { NextResponse } from 'next/server'

export async function GET() {
  const res = await fetch(`${process.env.API_URL}/stats`, { next: { revalidate: 300 } })
  if (!res.ok) return NextResponse.json(null, { status: res.status })
  return NextResponse.json(await res.json())
}
