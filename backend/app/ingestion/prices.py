"""
Price fetching abstraction: PriceClient abstract base and YFinancePriceClient implementation.

# PRODUCTION: swap YFinancePriceClient for FMPPriceClient before launch (see INGEST-04 research)
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class PriceClient(ABC):
    @abstractmethod
    async def get_daily_close(self, ticker: str, as_of_date: date) -> Decimal | None:
        """Return closing price for ticker on as_of_date, or None if unavailable."""
        ...


class YFinancePriceClient(PriceClient):
    """yfinance-backed price client for local dev.

    NOTE: yfinance is for LOCAL DEV ONLY — rate limited in production.
    FMP implementation will be added before launch.
    """

    async def get_daily_close(self, ticker: str, as_of_date: date) -> Decimal | None:
        """Fetch closing price for ticker on as_of_date via yfinance.

        Returns Decimal on success, None on any error (never raises to caller).
        """
        try:
            import yfinance as yf

            # Download a small window around the target date to handle weekends/holidays
            start = as_of_date
            end = as_of_date + timedelta(days=5)
            df = yf.download(
                ticker,
                start=start.isoformat(),
                end=end.isoformat(),
                auto_adjust=True,
                progress=False,
            )
            if df.empty:
                return None

            # Take the first row (closest trading day on or after as_of_date)
            close = df["Close"].iloc[0]
            if hasattr(close, "item"):
                close = close.item()  # numpy scalar → Python float
            return Decimal(str(close))
        except Exception as exc:
            logger.warning("YFinancePriceClient: failed to fetch %s on %s: %s", ticker, as_of_date, exc)
            return None


async def fetch_and_store_prices(
    session: AsyncSession,
    tickers: list[str],
    *,
    price_client: PriceClient | None = None,
    days: int = 30,
) -> None:
    """Fetch last `days` days of daily closes for `tickers` and upsert into price_snapshots.

    The S&P 500 benchmark (^GSPC) is always fetched regardless of the tickers list —
    benchmark data is required for all returns computations.

    Uses INSERT ... ON CONFLICT (ticker, snapshot_date) DO UPDATE to make this idempotent.

    Parameters
    ----------
    session:
        Active async SQLAlchemy session.
    tickers:
        List of equity tickers to fetch. ^GSPC is appended automatically if not present.
    price_client:
        Optional PriceClient injection (default: YFinancePriceClient()). Used in tests.
    days:
        Number of trailing calendar days to fetch. Default 30.
    """
    from app.models.price_snapshot import PriceSnapshot

    if price_client is None:
        price_client = YFinancePriceClient()

    # Always include ^GSPC for S&P 500 benchmark data
    all_tickers = list(dict.fromkeys([*tickers, "^GSPC"]))

    today = date.today()
    dates_to_fetch = [today - timedelta(days=i) for i in range(days)]

    for ticker in all_tickers:
        for as_of_date in dates_to_fetch:
            close_price = await price_client.get_daily_close(ticker, as_of_date)
            if close_price is None:
                continue

            stmt = pg_insert(PriceSnapshot).values(
                ticker=ticker,
                snapshot_date=as_of_date,
                close_price=close_price,
                source="yfinance",
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=["ticker", "snapshot_date"],
                set_={"close_price": stmt.excluded.close_price, "source": stmt.excluded.source},
            )
            await session.execute(stmt)

    await session.commit()


async def fetch_and_store_ticker_info(
    session: AsyncSession,
    tickers: list[str],
) -> None:
    """Fetch company names from yfinance and upsert into ticker_info.

    Only fetches for tickers not yet in the table (INSERT OR IGNORE pattern).
    Runs synchronous yfinance I/O in a thread to avoid blocking the event loop.
    """
    import asyncio

    from app.models.ticker_info import TickerInfo
    from sqlalchemy import select

    if not tickers:
        return

    # Only look up tickers we don't have yet
    existing = await session.execute(select(TickerInfo.ticker))
    known = {row[0] for row in existing.fetchall()}
    to_fetch = [t for t in dict.fromkeys(tickers) if t not in known and t != "^GSPC"]

    for ticker in to_fetch:
        try:
            import yfinance as yf

            def _get_name(t: str) -> str | None:
                info = yf.Ticker(t).info
                return info.get("longName") or info.get("shortName")

            company_name = await asyncio.to_thread(_get_name, ticker)
            if company_name:
                stmt = pg_insert(TickerInfo).values(ticker=ticker, company_name=company_name)
                stmt = stmt.on_conflict_do_update(
                    index_elements=["ticker"],
                    set_={"company_name": stmt.excluded.company_name},
                )
                await session.execute(stmt)
        except Exception as exc:
            logger.warning("ticker_info: failed to fetch name for %s: %s", ticker, exc)

    await session.commit()


async def fetch_and_store_ticker_meta(
    session: AsyncSession,
    tickers: list[str],
) -> None:
    """Fetch sector/industry from yfinance and upsert into ticker_meta.

    Only fetches for tickers not yet in ticker_meta (INSERT OR IGNORE pattern).
    ETFs and options return sector=None — stored as NULL, not skipped.
    Runs synchronous yfinance I/O in a thread to avoid blocking the event loop.
    """
    import asyncio
    import re

    from app.models.ticker_meta import TickerMeta
    from sqlalchemy import select

    def slugify(text: str) -> str:
        text = text.lower().strip()
        text = re.sub(r'[^\w\s-]', '', text)
        text = re.sub(r'[\s_]+', '-', text)
        return re.sub(r'-+', '-', text)

    if not tickers:
        return

    existing = await session.execute(select(TickerMeta.ticker))
    known = {row[0] for row in existing.fetchall()}
    to_fetch = [t for t in dict.fromkeys(tickers) if t not in known and t != "^GSPC"]

    for ticker in to_fetch:
        try:
            import yfinance as yf

            def _get_meta(t: str) -> dict:
                info = yf.Ticker(t).info
                sector = info.get("sector")   # None for ETFs/options
                industry = info.get("industry")
                quote_type = info.get("quoteType")
                return {
                    "sector": sector,
                    "industry": industry,
                    "sector_slug": slugify(sector) if sector else None,
                    "quote_type": quote_type,
                }

            meta = await asyncio.to_thread(_get_meta, ticker)
            stmt = pg_insert(TickerMeta).values(ticker=ticker, **meta)
            stmt = stmt.on_conflict_do_update(
                index_elements=["ticker"],
                set_={
                    "sector": stmt.excluded.sector,
                    "industry": stmt.excluded.industry,
                    "sector_slug": stmt.excluded.sector_slug,
                    "quote_type": stmt.excluded.quote_type,
                },
            )
            await session.execute(stmt)
        except Exception as exc:
            logger.warning("ticker_meta: failed to fetch meta for %s: %s", ticker, exc)

    await session.commit()
