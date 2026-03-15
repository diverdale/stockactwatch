"""GET /cluster — stocks traded by multiple congress members in a rolling window."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.politician import Politician
from app.models.ticker_info import TickerInfo
from app.models.trade import Trade

# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class ClusterMember(BaseModel):
    politician_id: str
    full_name: str
    party: str | None
    chamber: str | None
    transaction_type: str
    trade_date: date
    amount_lower: int | None
    amount_upper: int | None


class ClusterEntry(BaseModel):
    ticker: str
    company_name: str | None
    member_count: int      # distinct politicians
    trade_count: int       # total trades
    buy_count: int
    sell_count: int
    last_trade_date: date
    net_sentiment: str     # "bullish" | "bearish" | "mixed"
    members: list[ClusterMember]


class ClusterResponse(BaseModel):
    entries: list[ClusterEntry]
    window_days: int
    total: int


# ---------------------------------------------------------------------------
# Sentiment helper
# ---------------------------------------------------------------------------


def _net_sentiment(buy_count: int, sell_count: int) -> str:
    if buy_count > sell_count * 1.5:
        return "bullish"
    if sell_count > buy_count * 1.5:
        return "bearish"
    return "mixed"


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/cluster", tags=["cluster"])


@router.get("", response_model=ClusterResponse)
async def get_cluster(
    days: Annotated[int, Query(ge=0, description="Rolling window in days; 0 = all-time")] = 30,
    min_members: Annotated[int, Query(ge=1, description="Minimum distinct politicians")] = 2,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    db: AsyncSession = Depends(get_db),
) -> ClusterResponse:
    # ------------------------------------------------------------------
    # Query 1: find tickers with COUNT(DISTINCT politician_id) >= min_members
    # and collect per-ticker aggregates.
    # ------------------------------------------------------------------
    cutoff: date | None = None
    if days > 0:
        cutoff = date.today() - timedelta(days=days)

    agg_stmt = (
        select(
            Trade.ticker,
            func.count(Trade.id.distinct()).label("trade_count"),
            func.count(Trade.politician_id.distinct()).label("member_count"),
            func.max(Trade.trade_date).label("last_trade_date"),
        )
        .group_by(Trade.ticker)
        .having(func.count(Trade.politician_id.distinct()) >= min_members)
        .order_by(
            func.count(Trade.politician_id.distinct()).desc(),
            func.count(Trade.id.distinct()).desc(),
        )
        .limit(limit)
    )
    if cutoff is not None:
        agg_stmt = agg_stmt.where(Trade.trade_date >= cutoff)

    agg_result = await db.execute(agg_stmt)
    agg_rows = agg_result.all()

    if not agg_rows:
        return ClusterResponse(entries=[], window_days=days, total=0)

    qualifying_tickers = [row.ticker for row in agg_rows]

    # Build a lookup for aggregate values keyed by ticker
    agg_by_ticker: dict[str, tuple] = {row.ticker: row for row in agg_rows}

    # ------------------------------------------------------------------
    # Query 2: fetch individual trade rows joined with politician info
    # and outer-joined with TickerInfo for company names.
    # ------------------------------------------------------------------
    detail_stmt = (
        select(
            Trade.ticker,
            Trade.transaction_type,
            Trade.trade_date,
            Trade.amount_lower,
            Trade.amount_upper,
            Politician.id.label("politician_id"),
            Politician.full_name,
            Politician.party,
            Politician.chamber,
            TickerInfo.company_name,
        )
        .join(Politician, Trade.politician_id == Politician.id)
        .outerjoin(TickerInfo, TickerInfo.ticker == Trade.ticker)
        .where(Trade.ticker.in_(qualifying_tickers))
        .order_by(Trade.trade_date.desc())
    )
    if cutoff is not None:
        detail_stmt = detail_stmt.where(Trade.trade_date >= cutoff)

    detail_result = await db.execute(detail_stmt)
    detail_rows = detail_result.all()

    # ------------------------------------------------------------------
    # Group detail rows by ticker in Python
    # ------------------------------------------------------------------
    company_name_by_ticker: dict[str, str | None] = {}
    members_by_ticker: dict[str, list[ClusterMember]] = defaultdict(list)
    buy_counts: dict[str, int] = defaultdict(int)
    sell_counts: dict[str, int] = defaultdict(int)

    for row in detail_rows:
        ticker = row.ticker

        # Track company name (same for all rows of same ticker)
        if ticker not in company_name_by_ticker:
            company_name_by_ticker[ticker] = row.company_name

        # Classify transaction as buy or sell
        tx_lower = row.transaction_type.lower()
        if "purchase" in tx_lower or "buy" in tx_lower:
            buy_counts[ticker] += 1
        elif "sale" in tx_lower or "sell" in tx_lower:
            sell_counts[ticker] += 1

        members_by_ticker[ticker].append(
            ClusterMember(
                politician_id=str(row.politician_id),
                full_name=row.full_name,
                party=row.party,
                chamber=row.chamber,
                transaction_type=row.transaction_type,
                trade_date=row.trade_date,
                amount_lower=row.amount_lower,
                amount_upper=row.amount_upper,
            )
        )

    # ------------------------------------------------------------------
    # Assemble ClusterEntry list preserving aggregate query order
    # ------------------------------------------------------------------
    entries: list[ClusterEntry] = []
    for ticker in qualifying_tickers:
        agg = agg_by_ticker[ticker]
        buy_c = buy_counts[ticker]
        sell_c = sell_counts[ticker]
        entries.append(
            ClusterEntry(
                ticker=ticker,
                company_name=company_name_by_ticker.get(ticker),
                member_count=agg.member_count,
                trade_count=agg.trade_count,
                buy_count=buy_c,
                sell_count=sell_c,
                last_trade_date=agg.last_trade_date,
                net_sentiment=_net_sentiment(buy_c, sell_c),
                members=members_by_ticker.get(ticker, []),
            )
        )

    return ClusterResponse(entries=entries, window_days=days, total=len(entries))
