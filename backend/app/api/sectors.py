"""
Sector API endpoints.

GET /sectors            — overview list of all sectors with trade aggregates
GET /sectors/{slug}     — detail for a single sector with top tickers, politicians, trend
"""
from __future__ import annotations

import json
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from redis.asyncio import Redis
from sqlalchemy import case, func, literal_column, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache import get_redis
from app.db import get_db
from app.models.politician import Politician
from app.models.ticker_info import TickerInfo
from app.models.ticker_meta import TickerMeta
from app.models.trade import Trade


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class SectorEntry(BaseModel):
    sector: str
    sector_slug: str
    total_trades: int
    buy_count: int
    sell_count: int
    sentiment: str  # "bullish" | "bearish" | "mixed"
    last_trade_date: str | None
    is_trending: bool = False


class SectorOverviewResponse(BaseModel):
    sectors: list[SectorEntry]
    total: int
    cached: bool


class TopTicker(BaseModel):
    ticker: str
    company_name: str | None
    total_trades: int
    buy_count: int
    sell_count: int


class TopPolitician(BaseModel):
    politician_id: str
    full_name: str
    party: str | None
    chamber: str | None
    trade_count: int


class SectorTrendPoint(BaseModel):
    month: str  # "2024-03"
    buy_count: int
    sell_count: int
    total_trades: int


class SectorDetailResponse(BaseModel):
    sector: str
    sector_slug: str
    total_trades: int
    buy_count: int
    sell_count: int
    sentiment: str
    top_tickers: list[TopTicker]
    top_politicians: list[TopPolitician]
    trend: list[SectorTrendPoint]
    cached: bool


class IndustryEntry(BaseModel):
    industry: str
    total_trades: int
    buy_count: int
    sell_count: int


class IndustryBreakdownResponse(BaseModel):
    sector: str
    sector_slug: str
    industries: list[IndustryEntry]
    cached: bool


class SectorTrade(BaseModel):
    trade_id: str
    politician_id: str
    full_name: str
    chamber: str | None
    party: str | None
    state: str | None
    ticker: str
    company_name: str | None
    asset_type: str
    transaction_type: str
    trade_date: str
    disclosure_date: str
    amount_range_raw: str
    amount_lower: float | None
    amount_upper: float | None
    price_at_trade: float | None


class SectorTradesResponse(BaseModel):
    sector: str
    sector_slug: str
    trades: list[SectorTrade]
    total: int
    cached: bool


# ---------------------------------------------------------------------------
# Sentiment helper
# ---------------------------------------------------------------------------


def _net_sentiment(buy_count: int, sell_count: int) -> str:
    if buy_count > sell_count * 1.5:
        return "bullish"
    if sell_count > buy_count * 1.5:
        return "bearish"
    return "mixed"


def _is_trending(count_30d: int, count_90d: int) -> bool:
    """True when 30d rate is at least 80% of the 90d monthly average (sector is actively trading)."""
    monthly_avg_90d = count_90d / 3.0
    return monthly_avg_90d > 0 and count_30d >= 0.8 * monthly_avg_90d


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/sectors", tags=["sectors"])


@router.get("", response_model=SectorOverviewResponse)
async def get_sectors_overview(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> SectorOverviewResponse:
    cache_key = "sectors:overview"
    cached_raw = await redis.get(cache_key)
    if cached_raw:
        data = json.loads(cached_raw)
        return SectorOverviewResponse(
            sectors=[SectorEntry(**s) for s in data["sectors"]],
            total=data["total"],
            cached=True,
        )

    stmt = (
        select(
            TickerMeta.sector,
            TickerMeta.sector_slug,
            func.count(Trade.id).label("total_trades"),
            func.count(
                case((Trade.transaction_type.ilike("%purchase%"), Trade.id))
            ).label("buy_count"),
            func.count(
                case((Trade.transaction_type.ilike("%sale%"), Trade.id))
            ).label("sell_count"),
            func.max(Trade.trade_date).label("last_trade_date"),
            func.count(
                case((Trade.trade_date >= (date.today() - timedelta(days=30)), Trade.id))
            ).label("count_30d"),
            func.count(
                case((Trade.trade_date >= (date.today() - timedelta(days=90)), Trade.id))
            ).label("count_90d"),
        )
        .join(TickerMeta, TickerMeta.ticker == Trade.ticker)
        .where(TickerMeta.sector.is_not(None))
        .group_by(TickerMeta.sector, TickerMeta.sector_slug)
        .order_by(func.count(Trade.id).desc())
    )
    rows = (await db.execute(stmt)).all()
    entries = [
        SectorEntry(
            sector=row.sector,
            sector_slug=row.sector_slug,
            total_trades=row.total_trades,
            buy_count=row.buy_count,
            sell_count=row.sell_count,
            sentiment=_net_sentiment(row.buy_count, row.sell_count),
            last_trade_date=str(row.last_trade_date) if row.last_trade_date else None,
            is_trending=_is_trending(row.count_30d, row.count_90d),
        )
        for row in rows
    ]
    payload = {"sectors": [e.model_dump() for e in entries], "total": len(entries)}
    await redis.setex(cache_key, 600, json.dumps(payload, default=str))
    return SectorOverviewResponse(sectors=entries, total=len(entries), cached=False)


@router.get("/{slug}/industries", response_model=IndustryBreakdownResponse)
async def get_sector_industries(
    slug: str,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> IndustryBreakdownResponse:
    cache_key = f"sectors:industries:{slug}"
    cached_raw = await redis.get(cache_key)
    if cached_raw:
        data = json.loads(cached_raw)
        return IndustryBreakdownResponse(**data, cached=True)

    stmt = (
        select(
            TickerMeta.industry,
            func.count(Trade.id).label("total_trades"),
            func.count(case((Trade.transaction_type.ilike("%purchase%"), Trade.id))).label("buy_count"),
            func.count(case((Trade.transaction_type.ilike("%sale%"), Trade.id))).label("sell_count"),
        )
        .join(TickerMeta, TickerMeta.ticker == Trade.ticker)
        .where(TickerMeta.sector_slug == slug)
        .where(TickerMeta.industry.is_not(None))
        .group_by(TickerMeta.industry)
        .order_by(func.count(Trade.id).desc())
    )
    rows = (await db.execute(stmt)).all()
    if not rows:
        raise HTTPException(status_code=404, detail=f"Sector '{slug}' not found or has no industry data")

    sector_name_stmt = select(TickerMeta.sector).where(TickerMeta.sector_slug == slug).limit(1)
    sector_row = (await db.execute(sector_name_stmt)).one_or_none()
    sector_name = sector_row.sector if sector_row else slug

    industries = [
        IndustryEntry(
            industry=row.industry,
            total_trades=row.total_trades,
            buy_count=row.buy_count,
            sell_count=row.sell_count,
        )
        for row in rows
    ]
    payload = {"sector": sector_name, "sector_slug": slug, "industries": [i.model_dump() for i in industries]}
    await redis.setex(cache_key, 600, json.dumps(payload, default=str))
    return IndustryBreakdownResponse(sector=sector_name, sector_slug=slug, industries=industries, cached=False)


@router.get("/{slug}/trades", response_model=SectorTradesResponse)
async def get_sector_trades(
    slug: str,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> SectorTradesResponse:
    cache_key = f"sectors:trades:{slug}"
    cached_raw = await redis.get(cache_key)
    if cached_raw:
        data = json.loads(cached_raw)
        return SectorTradesResponse(**data, cached=True)

    sector_name_stmt = select(TickerMeta.sector).where(TickerMeta.sector_slug == slug).limit(1)
    sector_row = (await db.execute(sector_name_stmt)).one_or_none()
    if sector_row is None:
        raise HTTPException(status_code=404, detail=f"Sector '{slug}' not found")
    sector_name = sector_row.sector

    stmt = (
        select(
            Trade.id.label("trade_id"),
            Politician.id.label("politician_id"),
            Politician.full_name,
            Politician.chamber,
            Politician.party,
            Politician.state,
            Trade.ticker,
            TickerInfo.company_name,
            Trade.asset_type,
            Trade.transaction_type,
            Trade.trade_date,
            Trade.disclosure_date,
            Trade.amount_range_raw,
            Trade.amount_lower,
            Trade.amount_upper,
            Trade.price_at_trade,
        )
        .join(TickerMeta, TickerMeta.ticker == Trade.ticker)
        .join(Politician, Politician.id == Trade.politician_id)
        .outerjoin(TickerInfo, TickerInfo.ticker == Trade.ticker)
        .where(TickerMeta.sector_slug == slug)
        .order_by(Trade.trade_date.desc())
    )
    rows = (await db.execute(stmt)).all()

    trades = [
        SectorTrade(
            trade_id=str(row.trade_id),
            politician_id=str(row.politician_id),
            full_name=row.full_name,
            chamber=row.chamber,
            party=row.party,
            state=row.state,
            ticker=row.ticker,
            company_name=row.company_name,
            asset_type=row.asset_type,
            transaction_type=row.transaction_type,
            trade_date=str(row.trade_date),
            disclosure_date=str(row.disclosure_date),
            amount_range_raw=row.amount_range_raw or "",
            amount_lower=row.amount_lower,
            amount_upper=row.amount_upper,
            price_at_trade=row.price_at_trade,
        )
        for row in rows
    ]
    payload = {
        "sector": sector_name,
        "sector_slug": slug,
        "trades": [t.model_dump() for t in trades],
        "total": len(trades),
    }
    await redis.setex(cache_key, 600, json.dumps(payload, default=str))
    return SectorTradesResponse(sector=sector_name, sector_slug=slug, trades=trades, total=len(trades), cached=False)


@router.get("/{slug}", response_model=SectorDetailResponse)
async def get_sector_detail(
    slug: str,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> SectorDetailResponse:
    cache_key = f"sectors:detail:{slug}"
    cached_raw = await redis.get(cache_key)
    if cached_raw:
        data = json.loads(cached_raw)
        return SectorDetailResponse(**data, cached=True)

    # Aggregate totals for this sector
    totals_stmt = (
        select(
            TickerMeta.sector,
            func.count(Trade.id).label("total_trades"),
            func.count(
                case((Trade.transaction_type.ilike("%purchase%"), Trade.id))
            ).label("buy_count"),
            func.count(
                case((Trade.transaction_type.ilike("%sale%"), Trade.id))
            ).label("sell_count"),
        )
        .join(TickerMeta, TickerMeta.ticker == Trade.ticker)
        .where(TickerMeta.sector_slug == slug)
        .group_by(TickerMeta.sector)
    )
    totals_row = (await db.execute(totals_stmt)).one_or_none()
    if totals_row is None:
        raise HTTPException(status_code=404, detail=f"Sector '{slug}' not found")

    # Top 10 tickers for this sector
    top_tickers_stmt = (
        select(
            Trade.ticker,
            TickerInfo.company_name,
            func.count(Trade.id).label("total_trades"),
            func.count(
                case((Trade.transaction_type.ilike("%purchase%"), Trade.id))
            ).label("buy_count"),
            func.count(
                case((Trade.transaction_type.ilike("%sale%"), Trade.id))
            ).label("sell_count"),
        )
        .join(TickerMeta, TickerMeta.ticker == Trade.ticker)
        .outerjoin(TickerInfo, TickerInfo.ticker == Trade.ticker)
        .where(TickerMeta.sector_slug == slug)
        .group_by(Trade.ticker, TickerInfo.company_name)
        .order_by(func.count(Trade.id).desc())
        .limit(10)
    )
    top_ticker_rows = (await db.execute(top_tickers_stmt)).all()
    top_tickers = [
        TopTicker(
            ticker=row.ticker,
            company_name=row.company_name,
            total_trades=row.total_trades,
            buy_count=row.buy_count,
            sell_count=row.sell_count,
        )
        for row in top_ticker_rows
    ]

    # Top 10 politicians for this sector
    top_pols_stmt = (
        select(
            Politician.id,
            Politician.full_name,
            Politician.party,
            Politician.chamber,
            func.count(Trade.id).label("trade_count"),
        )
        .join(Trade, Trade.politician_id == Politician.id)
        .join(TickerMeta, TickerMeta.ticker == Trade.ticker)
        .where(TickerMeta.sector_slug == slug)
        .group_by(Politician.id, Politician.full_name, Politician.party, Politician.chamber)
        .order_by(func.count(Trade.id).desc())
        .limit(10)
    )
    top_pol_rows = (await db.execute(top_pols_stmt)).all()
    top_politicians = [
        TopPolitician(
            politician_id=str(row.id),
            full_name=row.full_name,
            party=row.party,
            chamber=row.chamber,
            trade_count=row.trade_count,
        )
        for row in top_pol_rows
    ]

    # Monthly trend (DATE_TRUNC)
    trend_stmt = (
        select(
            func.date_trunc(literal_column("'month'"), Trade.trade_date).label("month"),
            func.count(
                case((Trade.transaction_type.ilike("%purchase%"), Trade.id))
            ).label("buy_count"),
            func.count(
                case((Trade.transaction_type.ilike("%sale%"), Trade.id))
            ).label("sell_count"),
            func.count(Trade.id).label("total_trades"),
        )
        .join(TickerMeta, TickerMeta.ticker == Trade.ticker)
        .where(TickerMeta.sector_slug == slug)
        .group_by(func.date_trunc(literal_column("'month'"), Trade.trade_date))
        .order_by(func.date_trunc(literal_column("'month'"), Trade.trade_date).asc())
    )
    trend_rows = (await db.execute(trend_stmt)).all()
    # date_trunc returns datetime via asyncpg — format as "YYYY-MM"
    trend = [
        SectorTrendPoint(
            month=row.month.strftime("%Y-%m"),
            buy_count=row.buy_count,
            sell_count=row.sell_count,
            total_trades=row.total_trades,
        )
        for row in trend_rows
    ]

    result = SectorDetailResponse(
        sector=totals_row.sector,
        sector_slug=slug,
        total_trades=totals_row.total_trades,
        buy_count=totals_row.buy_count,
        sell_count=totals_row.sell_count,
        sentiment=_net_sentiment(totals_row.buy_count, totals_row.sell_count),
        top_tickers=top_tickers,
        top_politicians=top_politicians,
        trend=trend,
        cached=False,
    )
    await redis.setex(cache_key, 600, json.dumps(result.model_dump(), default=str))
    return result
