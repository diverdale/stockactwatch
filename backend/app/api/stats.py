"""GET /stats — aggregate platform statistics for the landing page."""
from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.trade import Trade

router = APIRouter(tags=["stats"])


class PlatformStats(BaseModel):
    total_trades: int
    total_politicians: int
    total_tickers: int
    latest_trade_date: date | None


@router.get("/stats", response_model=PlatformStats)
async def platform_stats(db: AsyncSession = Depends(get_db)) -> PlatformStats:
    """Aggregate counts for landing page display. Lightweight — no cache needed at ISR TTL."""
    result = await db.execute(
        select(
            func.count(Trade.id).label("total_trades"),
            func.count(func.distinct(Trade.politician_id)).label("total_politicians"),
            func.count(func.distinct(Trade.ticker)).label("total_tickers"),
            func.max(Trade.trade_date).label("latest_trade_date"),
        )
    )
    row = result.one()
    return PlatformStats(
        total_trades=row.total_trades,
        total_politicians=row.total_politicians,
        total_tickers=row.total_tickers,
        latest_trade_date=row.latest_trade_date,
    )
