"""GET /politicians/{politician_id} and GET /tickers/{ticker} endpoints."""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.computed_return import ComputedReturn
from app.models.politician import Politician
from app.models.trade import Trade
from app.schemas.feed import PoliticianProfile, TickerTradeEntry, TickerTrades, TradeEntry

router = APIRouter(tags=["profiles", "tickers"])


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

    return PoliticianProfile(
        politician_id=str(politician.id),
        full_name=politician.full_name,
        chamber=politician.chamber,
        party=politician.party,
        state=politician.state,
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

    return TickerTrades(ticker=ticker_upper, total_trades=len(rows), trades=entries)
