import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_URL ?? 'http://localhost:8000'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const question = (body.question ?? '').trim()
    if (!question) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    const res = await fetch(`${API_URL}/ai/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: text }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('/api/ask error:', err)
    return NextResponse.json(
      { error: 'Failed to reach the AI service. Please try again.' },
      { status: 502 },
    )
  }
}
