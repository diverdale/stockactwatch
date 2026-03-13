// lib/types.ts
export interface FeedEntry {
  trade_id: string
  politician_id: string
  full_name: string
  chamber: string | null
  party: string | null
  state: string | null
  photo_url: string | null
  ticker: string
  company_name: string | null
  asset_type: string
  transaction_type: string
  trade_date: string
  disclosure_date: string
  amount_range_raw: string
  amount_lower: number | null
  amount_upper: number | null
  return_calculable: boolean
  price_at_trade: number | null
}

export interface FeedResponse {
  entries: FeedEntry[]
  total: number
  limit: number
  offset: number
}

export interface TradeEntry {
  trade_id: string
  ticker: string
  asset_type: string
  transaction_type: string
  trade_date: string
  disclosure_date: string
  amount_range_raw: string
  amount_lower: number | null
  amount_upper: number | null
  return_calculable: boolean
  avg_return_pct: number | null
}

export interface PoliticianProfile {
  politician_id: string
  full_name: string
  chamber: string | null
  party: string | null
  state: string | null
  bio_guide_id: string | null
  photo_url: string | null
  total_trades: number
  trades: TradeEntry[]
}

export interface TickerTradeEntry {
  trade_id: string
  politician_id: string
  full_name: string
  chamber: string
  party: string
  transaction_type: string
  trade_date: string
  disclosure_date: string
  amount_range_raw: string
  amount_lower: number | null
  amount_upper: number | null
}

export interface TickerTrades {
  ticker: string
  company_name: string | null
  total_trades: number
  trades: TickerTradeEntry[]
}

export interface ReturnLeaderboardEntry {
  politician_id: string
  full_name: string
  avg_return_pct: number
  return_low: number
  return_high: number
  trade_count: number
  methodology_label: string
  disclaimer: boolean
}

export interface LeaderboardResponse {
  entries: ReturnLeaderboardEntry[]
  total: number
  cached: boolean
}

export interface VolumeLeaderboardEntry {
  politician_id: string
  full_name: string
  chamber: string
  party: string
  trade_count: number
}

export interface VolumeLeaderboardResponse {
  entries: VolumeLeaderboardEntry[]
  total: number
  cached: boolean
  filters_applied: Record<string, string>
}

// Sector dashboard types (Phase 5)
export interface SectorEntry {
  sector: string        // display name: "Technology"
  sector_slug: string   // URL slug: "technology"
  total_trades: number
  buy_count: number
  sell_count: number
  sentiment: 'bullish' | 'bearish' | 'mixed'
  last_trade_date: string | null
}

export interface SectorOverviewResponse {
  sectors: SectorEntry[]
  total: number
  cached: boolean
}

export interface TopTicker {
  ticker: string
  company_name: string | null
  total_trades: number
  buy_count: number
  sell_count: number
}

export interface TopPolitician {
  politician_id: string
  full_name: string
  party: string | null
  chamber: string | null
  trade_count: number
}

export interface SectorTrendPoint {
  month: string       // "2024-03"
  buy_count: number
  sell_count: number
  total_trades: number
}

export interface SectorDetailResponse {
  sector: string
  sector_slug: string
  total_trades: number
  buy_count: number
  sell_count: number
  sentiment: 'bullish' | 'bearish' | 'mixed'
  top_tickers: TopTicker[]
  top_politicians: TopPolitician[]
  trend: SectorTrendPoint[]
  cached: boolean
}
