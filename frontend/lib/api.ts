// lib/api.ts
const BASE = process.env.API_URL!

if (!BASE && process.env.NODE_ENV !== 'test') {
  throw new Error('API_URL environment variable is not set')
}

export async function apiFetch<T>(
  path: string,
  opts: { tags?: string[]; revalidate?: number } = {}
): Promise<T> {
  const url = `${BASE}${path}`
  const res = await fetch(url, {
    next: {
      tags: opts.tags,
      revalidate: opts.revalidate ?? 300,
    },
  })
  if (!res.ok) {
    throw new Error(`API error ${res.status} fetching ${path}`)
  }
  return res.json() as Promise<T>
}
