"""Response schemas for feed, politician profile, and ticker endpoints.

All IDs are str (UUID stringified). Dates are date (FastAPI JSON encodes to ISO string).
Decimal fields use Decimal for precision — FastAPI serializes correctly via response_model.
"""
from datetime import date
from decimal import Decimal

from pydantic import BaseModel


# ── Feed ──────────────────────────────────────────────────────────────────────

class FeedEntry(BaseModel):
    trade_id: str
    politician_id: str
    full_name: str
    chamber: str | None
    party: str | None
    state: str | None
    photo_url: str | None
    ticker: str
    company_name: str | None
    asset_type: str
    transaction_type: str
    trade_date: date
    disclosure_date: date
    amount_range_raw: str | None
    amount_lower: int | None
    amount_upper: int | None
    return_calculable: bool
    price_at_trade: Decimal | None  # close price on trade_date from price_snapshots


class FeedResponse(BaseModel):
    entries: list[FeedEntry]
    total: int        # total matching rows (for pagination UI)
    limit: int
    offset: int


# ── Politician profile ─────────────────────────────────────────────────────────

class TradeEntry(BaseModel):
    """A single trade on a politician's profile page."""
    trade_id: str
    ticker: str
    asset_type: str
    transaction_type: str
    trade_date: date
    disclosure_date: date
    amount_range_raw: str | None
    amount_lower: int | None
    amount_upper: int | None
    company_name: str | None = None
    return_calculable: bool
    avg_return_pct: Decimal | None    # from computed_returns if available
    suspicion_score: int | None = None
    suspicion_flags: str | None = None


class PoliticianProfile(BaseModel):
    politician_id: str
    full_name: str
    chamber: str | None
    party: str | None
    state: str | None
    district: int | None
    bio_guide_id: str | None
    photo_url: str | None
    total_trades: int
    trades: list[TradeEntry]


# ── Ticker page ───────────────────────────────────────────────────────────────

class TickerTradeEntry(BaseModel):
    """A single trade record on a ticker's page."""
    trade_id: str
    politician_id: str
    full_name: str
    chamber: str | None
    party: str | None
    transaction_type: str
    trade_date: date
    disclosure_date: date
    amount_range_raw: str | None
    amount_lower: int | None
    amount_upper: int | None


class TickerTrades(BaseModel):
    ticker: str
    company_name: str | None
    sector: str | None = None
    sector_slug: str | None = None
    total_trades: int
    trades: list[TickerTradeEntry]
