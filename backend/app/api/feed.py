"""GET /feed — paginated trade disclosures with optional ticker filter."""
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.politician import Politician
from app.models.trade import Trade
from app.schemas.feed import FeedEntry, FeedResponse

router = APIRouter(prefix="/feed", tags=["feed"])


@router.get("", response_model=FeedResponse)
async def recent_trades_feed(
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    ticker: Annotated[str | None, Query(max_length=10)] = None,
    chamber: Annotated[str | None, Query(max_length=20)] = None,
    party: Annotated[str | None, Query(max_length=30)] = None,
    db: AsyncSession = Depends(get_db),
) -> FeedResponse:
    # Base join condition
    base_join = select(Trade, Politician).join(
        Politician, Trade.politician_id == Politician.id
    )
    if ticker:
        base_join = base_join.where(Trade.ticker == ticker.upper())
    if chamber:
        base_join = base_join.where(Politician.chamber == chamber)
    if party:
        base_join = base_join.where(Politician.party == party)

    # Count query — count matching Trade rows
    count_stmt = select(func.count(Trade.id)).join(
        Politician, Trade.politician_id == Politician.id
    )
    if ticker:
        count_stmt = count_stmt.where(Trade.ticker == ticker.upper())
    if chamber:
        count_stmt = count_stmt.where(Politician.chamber == chamber)
    if party:
        count_stmt = count_stmt.where(Politician.party == party)
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()

    # Data query — ordered, paginated
    data_stmt = base_join.order_by(
        Trade.trade_date.desc(), Trade.disclosure_date.desc()
    ).limit(limit).offset(offset)
    rows = (await db.execute(data_stmt)).all()

    entries = [
        FeedEntry(
            trade_id=str(trade.id),
            politician_id=str(trade.politician_id),
            full_name=pol.full_name,
            chamber=pol.chamber,
            party=pol.party,
            ticker=trade.ticker,
            asset_type=trade.asset_type,
            transaction_type=trade.transaction_type,
            trade_date=trade.trade_date,
            disclosure_date=trade.disclosure_date,
            amount_range_raw=trade.amount_range_raw,
            amount_lower=trade.amount_lower,
            amount_upper=trade.amount_upper,
            return_calculable=trade.return_calculable,
        )
        for trade, pol in rows
    ]

    return FeedResponse(entries=entries, total=total, limit=limit, offset=offset)
