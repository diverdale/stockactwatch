// lib/types.ts
export interface FeedEntry {
  trade_id: string
  politician_id: string
  full_name: string
  chamber: string
  party: string
  ticker: string
  asset_type: string
  transaction_type: string
  trade_date: string
  disclosure_date: string
  amount_range_raw: string
  amount_lower: number | null
  amount_upper: number | null
  return_calculable: boolean
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
  chamber: string
  party: string
  state: string
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
