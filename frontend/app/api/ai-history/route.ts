import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

const API_URL = process.env.API_URL ?? 'http://localhost:8000'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json([])

  const res = await fetch(`${API_URL}/ai/history`, {
    headers: { 'X-User-Id': userId },
    cache: 'no-store',
  })
  const data = await res.json().catch(() => [])
  return NextResponse.json(data)
}
