"""GET /feed — paginated trade disclosures with optional ticker filter."""
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, asc, desc, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.politician import Politician
from app.models.price_snapshot import PriceSnapshot
from app.models.ticker_info import TickerInfo
from app.models.trade import Trade
from app.schemas.feed import FeedEntry, FeedResponse

BIOGUIDE_PHOTO_URL = "https://bioguide.congress.gov/bioguide/photo/{letter}/{bio_id}.jpg"

# Columns that can be sorted — maps param value → SQLAlchemy column expression
_SORT_COLS = {
    "trade_date":       lambda: Trade.trade_date,
    "disclosure_date":  lambda: Trade.disclosure_date,
    "company_name":     lambda: TickerInfo.company_name,
    "full_name":        lambda: Politician.full_name,
    "amount_lower":     lambda: Trade.amount_lower,
    "transaction_type": lambda: Trade.transaction_type,
    "asset_type":       lambda: Trade.asset_type,
    "lag":              lambda: text("(trades.disclosure_date - trades.trade_date)"),
}

router = APIRouter(prefix="/feed", tags=["feed"])


@router.get("", response_model=FeedResponse)
async def recent_trades_feed(
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    ticker: Annotated[str | None, Query(max_length=10)] = None,
    chamber: Annotated[str | None, Query(max_length=20)] = None,
    party: Annotated[str | None, Query(max_length=30)] = None,
    sort_by: Annotated[str | None, Query(max_length=30)] = None,
    sort_dir: Annotated[Literal["asc", "desc"], Query()] = "desc",
    db: AsyncSession = Depends(get_db),
) -> FeedResponse:
    # Base join: Trade → Politician (inner), → PriceSnapshot (outer), → TickerInfo (outer)
    base_join = (
        select(Trade, Politician, PriceSnapshot.close_price, TickerInfo.company_name)
        .join(Politician, Trade.politician_id == Politician.id)
        .outerjoin(
            PriceSnapshot,
            (PriceSnapshot.ticker == Trade.ticker)
            & (PriceSnapshot.snapshot_date == Trade.trade_date),
        )
        .outerjoin(TickerInfo, TickerInfo.ticker == Trade.ticker)
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

    # Build ORDER BY — validated sort_by, fall back to trade_date desc
    dir_fn = asc if sort_dir == "asc" else desc
    if sort_by and sort_by in _SORT_COLS:
        col_expr = _SORT_COLS[sort_by]()
        order_clause = [dir_fn(col_expr), desc(Trade.trade_date)]
    else:
        order_clause = [desc(Trade.trade_date), desc(Trade.disclosure_date)]

    # Data query — ordered, paginated
    data_stmt = base_join.order_by(*order_clause).limit(limit).offset(offset)
    rows = (await db.execute(data_stmt)).all()  # each row: (Trade, Politician, close_price, company_name)

    entries = [
        FeedEntry(
            trade_id=str(trade.id),
            politician_id=str(trade.politician_id),
            full_name=pol.full_name,
            chamber=pol.chamber,
            party=pol.party,
            state=pol.state,
            photo_url=(
                BIOGUIDE_PHOTO_URL.format(
                    letter=pol.bio_guide_id[0].upper(),
                    bio_id=pol.bio_guide_id,
                )
                if pol.bio_guide_id
                else None
            ),
            ticker=trade.ticker,
            company_name=company_name,
            asset_type=trade.asset_type,
            transaction_type=trade.transaction_type,
            trade_date=trade.trade_date,
            disclosure_date=trade.disclosure_date,
            amount_range_raw=trade.amount_range_raw,
            amount_lower=trade.amount_lower,
            amount_upper=trade.amount_upper,
            return_calculable=trade.return_calculable,
            price_at_trade=price,
        )
        for trade, pol, price, company_name in rows
    ]

    return FeedResponse(entries=entries, total=total, limit=limit, offset=offset)
