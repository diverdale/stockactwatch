"""GET /politicians/{politician_id} and GET /tickers/{ticker} endpoints."""
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from redis.asyncio import Redis
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache import get_redis
from app.db import get_db
from app.models.computed_return import ComputedReturn
from app.models.politician import Politician
from app.models.ticker_info import TickerInfo
from app.models.ticker_meta import TickerMeta
from app.models.trade import Trade
from app.schemas.feed import PoliticianProfile, TickerTradeEntry, TickerTrades, TradeEntry

router = APIRouter(tags=["profiles", "tickers"])


class PoliticianSectorEntry(BaseModel):
    sector: str
    sector_slug: str
    trade_count: int


class PoliticianSectorsResponse(BaseModel):
    politician_id: str
    sectors: list[PoliticianSectorEntry]
    cached: bool

BIOGUIDE_PHOTO_URL = "https://bioguide.congress.gov/bioguide/photo/{letter}/{bio_id}.jpg"


@router.get("/politicians/{politician_id}", response_model=PoliticianProfile)
async def get_politician_profile(
    politician_id: str,
    db: AsyncSession = Depends(get_db),
) -> PoliticianProfile:
    # Validate UUID format
    try:
        pol_uuid = uuid.UUID(politician_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid politician_id: must be a valid UUID")

    politician = await db.get(Politician, pol_uuid)
    if politician is None:
        raise HTTPException(status_code=404, detail="Politician not found")

    # Fetch trades with computed return if available
    stmt = (
        select(Trade, ComputedReturn)
        .outerjoin(ComputedReturn, ComputedReturn.trade_id == Trade.id)
        .where(Trade.politician_id == politician.id)
        .order_by(Trade.trade_date.desc())
    )
    rows = (await db.execute(stmt)).all()

    trade_entries = [
        TradeEntry(
            trade_id=str(row[0].id),
            ticker=row[0].ticker,
            asset_type=row[0].asset_type,
            transaction_type=row[0].transaction_type,
            trade_date=row[0].trade_date,
            disclosure_date=row[0].disclosure_date,
            amount_range_raw=row[0].amount_range_raw,
            amount_lower=row[0].amount_lower,
            amount_upper=row[0].amount_upper,
            return_calculable=row[0].return_calculable,
            avg_return_pct=row[1].return_pct if row[1] else None,
        )
        for row in rows
    ]

    bio_id = politician.bio_guide_id
    photo_url = (
        BIOGUIDE_PHOTO_URL.format(letter=bio_id[0].upper(), bio_id=bio_id)
        if bio_id else None
    )

    return PoliticianProfile(
        politician_id=str(politician.id),
        full_name=politician.full_name,
        chamber=politician.chamber,
        party=politician.party,
        state=politician.state,
        bio_guide_id=bio_id,
        photo_url=photo_url,
        total_trades=len(rows),
        trades=trade_entries,
    )


@router.get("/tickers/{ticker}", response_model=TickerTrades)
async def get_ticker_trades(
    ticker: str,
    db: AsyncSession = Depends(get_db),
) -> TickerTrades:
    ticker_upper = ticker.upper()

    stmt = (
        select(Trade, Politician)
        .join(Politician, Trade.politician_id == Politician.id)
        .where(Trade.ticker == ticker_upper)
        .order_by(Trade.trade_date.desc())
    )
    rows = (await db.execute(stmt)).all()

    ticker_info = await db.get(TickerInfo, ticker_upper)
    company_name = ticker_info.company_name if ticker_info else None

    entries = [
        TickerTradeEntry(
            trade_id=str(trade.id),
            politician_id=str(trade.politician_id),
            full_name=pol.full_name,
            chamber=pol.chamber,
            party=pol.party,
            transaction_type=trade.transaction_type,
            trade_date=trade.trade_date,
            disclosure_date=trade.disclosure_date,
            amount_range_raw=trade.amount_range_raw,
            amount_lower=trade.amount_lower,
            amount_upper=trade.amount_upper,
        )
        for trade, pol in rows
    ]

    return TickerTrades(ticker=ticker_upper, company_name=company_name, total_trades=len(rows), trades=entries)


@router.get("/politicians/{politician_id}/sectors", response_model=PoliticianSectorsResponse)
async def get_politician_sectors(
    politician_id: str,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> PoliticianSectorsResponse:
    cache_key = f"politician:sectors:{politician_id}"
    cached_raw = await redis.get(cache_key)
    if cached_raw:
        data = json.loads(cached_raw)
        return PoliticianSectorsResponse(**data, cached=True)

    stmt = (
        select(
            TickerMeta.sector,
            TickerMeta.sector_slug,
            func.count(Trade.id).label("trade_count"),
        )
        .join(Trade, Trade.ticker == TickerMeta.ticker)
        .where(Trade.politician_id == politician_id)
        .where(TickerMeta.sector.is_not(None))
        .group_by(TickerMeta.sector, TickerMeta.sector_slug)
        .order_by(func.count(Trade.id).desc())
        .limit(8)
    )
    rows = (await db.execute(stmt)).all()

    # Return 200 with empty list if politician exists but has no sector data
    # (404 is reserved for unknown politician_id — we don't validate existence here
    #  since profile endpoint already handles that)
    sectors = [
        PoliticianSectorEntry(
            sector=row.sector,
            sector_slug=row.sector_slug,
            trade_count=row.trade_count,
        )
        for row in rows
    ]
    payload = {"politician_id": politician_id, "sectors": [s.model_dump() for s in sectors]}
    await redis.setex(cache_key, 600, json.dumps(payload, default=str))
    return PoliticianSectorsResponse(politician_id=politician_id, sectors=sectors, cached=False)
