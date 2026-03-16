import type { MetadataRoute } from 'next'

const BASE = 'https://stockactwatch.com'
const API = process.env.API_URL ?? 'http://localhost:8000'

async function safeFetch<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } })
    if (!res.ok) return null
    return res.json() as Promise<T>
  } catch {
    return null
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE,                             lastModified: now, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE}/feed`,                   lastModified: now, changeFrequency: 'hourly',  priority: 0.9 },
    { url: `${BASE}/leaderboard`,            lastModified: now, changeFrequency: 'daily',   priority: 0.8 },
    { url: `${BASE}/politicians`,            lastModified: now, changeFrequency: 'daily',   priority: 0.8 },
    { url: `${BASE}/tickers`,               lastModified: now, changeFrequency: 'daily',   priority: 0.8 },
    { url: `${BASE}/sectors`,               lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE}/conflicts`,             lastModified: now, changeFrequency: 'daily',   priority: 0.7 },
    { url: `${BASE}/cluster`,               lastModified: now, changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${BASE}/ask`,                   lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/guide`,                 lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ]

  // Dynamic politician pages
  const politicians = await safeFetch<{ politicians: { politician_id: string }[] }>(
    `${API}/politicians`
  )
  const politicianRoutes: MetadataRoute.Sitemap =
    politicians?.politicians?.map(p => ({
      url: `${BASE}/politicians/${p.politician_id}`,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })) ?? []

  // Dynamic ticker pages
  const tickers = await safeFetch<{ tickers: { ticker: string }[] }>(
    `${API}/tickers?limit=2000`
  )
  const tickerRoutes: MetadataRoute.Sitemap =
    tickers?.tickers?.map(t => ({
      url: `${BASE}/tickers/${t.ticker}`,
      changeFrequency: 'daily' as const,
      priority: 0.6,
    })) ?? []

  return [...staticRoutes, ...politicianRoutes, ...tickerRoutes]
}
