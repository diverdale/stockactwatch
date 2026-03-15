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
  suspicion_score: number | null
  suspicion_flags: string | null
}

export interface PoliticianProfile {
  politician_id: string
  full_name: string
  chamber: string | null
  party: string | null
  state: string | null
  district: number | null
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
  sector: string | null
  sector_slug: string | null
  total_trades: number
  trades: TickerTradeEntry[]
}

export interface ReturnLeaderboardEntry {
  politician_id: string
  full_name: string
  chamber: string | null
  party: string | null
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
  is_trending: boolean
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

export interface PoliticianSectorEntry {
  sector: string
  sector_slug: string
  trade_count: number
}

export interface PoliticianSectorsResponse {
  politician_id: string
  sectors: PoliticianSectorEntry[]
  cached: boolean
}

// Phase 6 additions
export interface IndustryEntry {
  industry: string
  total_trades: number
  buy_count: number
  sell_count: number
}

export interface IndustryBreakdownResponse {
  sector: string
  sector_slug: string
  industries: IndustryEntry[]
  cached: boolean
}

export interface SectorTrade {
  trade_id: string
  politician_id: string
  full_name: string
  chamber: string | null
  party: string | null
  state: string | null
  ticker: string
  company_name: string | null
  asset_type: string
  transaction_type: string
  trade_date: string
  disclosure_date: string
  amount_range_raw: string
  amount_lower: number | null
  amount_upper: number | null
  price_at_trade: number | null
}

export interface SectorTradesResponse {
  sector: string
  sector_slug: string
  trades: SectorTrade[]
  total: number
  cached: boolean
}

export interface PoliticianListEntry {
  politician_id: string
  full_name: string
  chamber: string | null
  party: string | null
  state: string | null
  photo_url: string | null
  trade_count: number
  buy_count: number
  sell_count: number
}

export interface PoliticianListResponse {
  politicians: PoliticianListEntry[]
  total: number
  cached: boolean
}

export interface TickerListEntry {
  ticker: string
  company_name: string | null
  sector: string | null
  sector_slug: string | null
  asset_types: string[]
  total_trades: number
  buy_count: number
  sell_count: number
  member_count: number
  last_trade_date: string | null
  amount_vol_est: number | null
  sparkline: number[]
}

export interface TickerListResponse {
  tickers: TickerListEntry[]
  total_tickers: number
  total_trades: number
  total_members: number
  dollar_vol_est: number
  cached: boolean
}

// Committee conflict detector types
export interface ConflictTrade {
  trade_id: string
  politician_id: string
  full_name: string
  chamber: string | null
  party: string | null
  state: string | null
  photo_url: string | null
  committee_name: string
  committee_code: string
  role: string | null
  ticker: string
  company_name: string | null
  sector: string | null
  transaction_type: string
  trade_date: string
  disclosure_date: string
  amount_range_raw: string
  amount_lower: number | null
  amount_upper: number | null
  conflict_reason: string
}

export interface ConflictsResponse {
  trades: ConflictTrade[]
  total: number
  cached: boolean
}

export interface CommitteeScorecard {
  committee_code: string
  committee_name: string
  chamber: string
  sector: string | null
  total_trades: number
  buy_count: number
  sell_count: number
  member_count: number
  chair_trades: number
  ranking_member_trades: number
  dollar_vol_est: number
  sectors: string[]
}

export interface ConflictsSummaryResponse {
  committees: CommitteeScorecard[]
  total_flagged_trades: number
  total_members_implicated: number
  total_committees: number
  dollar_vol_est: number
  cached: boolean
}

export interface HearingEvent {
  committee_code: string
  committee_name: string
  hearing_date: string
  title: string | null
  meeting_type: string | null
  congress: number
}

export interface ConflictHearingsResponse {
  hearings: HearingEvent[]
  total: number
  cached: boolean
}
