"""GET /stats — aggregate platform statistics for the landing page."""
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import case, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.ticker_info import TickerInfo
from app.models.trade import Trade

router = APIRouter(tags=["stats"])


class PlatformStats(BaseModel):
    total_trades: int
    total_politicians: int
    total_tickers: int
    latest_trade_date: date | None


class TopTicker(BaseModel):
    ticker: str
    company_name: str | None
    total: int
    buys: int
    sells: int

class MonthlyActivity(BaseModel):
    month: str
    trades: int

class DashboardStats(BaseModel):
    sentiment_buys: int
    sentiment_sells: int
    top_tickers: list[TopTicker]
    monthly_activity: list[MonthlyActivity]


@router.get("/stats/dashboard", response_model=DashboardStats)
async def dashboard_stats(db: AsyncSession = Depends(get_db)) -> DashboardStats:
    """Extended stats for the dashboard: sentiment, top tickers, monthly activity."""
    since = date.today() - timedelta(days=30)
    since_12m = date.today() - timedelta(days=365)

    # Sentiment (last 30 days)
    sentiment_row = (await db.execute(
        select(
            func.count(case((Trade.transaction_type == "Purchase", 1))).label("buys"),
            func.count(case((Trade.transaction_type != "Purchase", 1))).label("sells"),
        ).where(Trade.trade_date >= since)
    )).one()

    # Top tickers (last 30 days)
    ticker_rows = (await db.execute(
        select(
            Trade.ticker,
            TickerInfo.company_name,
            func.count(Trade.id).label("total"),
            func.count(case((Trade.transaction_type == "Purchase", 1))).label("buys"),
            func.count(case((Trade.transaction_type != "Purchase", 1))).label("sells"),
        )
        .outerjoin(TickerInfo, TickerInfo.ticker == Trade.ticker)
        .where(Trade.trade_date >= since)
        .group_by(Trade.ticker, TickerInfo.company_name)
        .order_by(func.count(Trade.id).desc())
        .limit(8)
    )).all()

    # Monthly activity (last 12 months)
    monthly_rows = (await db.execute(
        text("""
            SELECT TO_CHAR(DATE_TRUNC('month', trade_date), 'YYYY-MM') AS month,
                   COUNT(*) AS trades
            FROM trades
            WHERE trade_date >= :since
            GROUP BY month
            ORDER BY month
        """),
        {"since": since_12m},
    )).all()

    return DashboardStats(
        sentiment_buys=sentiment_row.buys,
        sentiment_sells=sentiment_row.sells,
        top_tickers=[
            TopTicker(ticker=r.ticker, company_name=r.company_name,
                      total=r.total, buys=r.buys, sells=r.sells)
            for r in ticker_rows
        ],
        monthly_activity=[
            MonthlyActivity(month=r.month, trades=r.trades)
            for r in monthly_rows
        ],
    )


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
