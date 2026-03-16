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
    """yfinance-backed price client.

    NOTE: yfinance is rate limited — all blocking calls run in a thread pool
    via asyncio.to_thread so they never block the uvicorn event loop.
    """

    # Limit concurrent yfinance requests to avoid rate limiting and thread explosion
    _semaphore: "asyncio.Semaphore | None" = None

    def _get_semaphore(self) -> "asyncio.Semaphore":
        import asyncio
        if self._semaphore is None:
            YFinancePriceClient._semaphore = asyncio.Semaphore(3)
        return self._semaphore  # type: ignore[return-value]

    async def get_daily_close(self, ticker: str, as_of_date: date) -> Decimal | None:
        """Fetch closing price for ticker on as_of_date via yfinance.

        Returns Decimal on success, None on any error (never raises to caller).
        Runs the blocking yfinance call in a thread so it doesn't block the event loop.
        """
        import asyncio

        async with self._get_semaphore():
            try:
                import yfinance as yf

                start = as_of_date
                end = as_of_date + timedelta(days=5)

                def _download() -> "object":
                    return yf.download(
                        ticker,
                        start=start.isoformat(),
                        end=end.isoformat(),
                        auto_adjust=True,
                        progress=False,
                    )

                df = await asyncio.to_thread(_download)
                if df.empty:  # type: ignore[union-attr]
                    return None

                close = df["Close"].iloc[0]  # type: ignore[union-attr]
                if hasattr(close, "item"):
                    close = close.item()
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

    Makes ONE yfinance batch download per ticker (not one per day) and skips
    ticker+date pairs already present in the DB to avoid redundant API calls.

    The S&P 500 benchmark (^GSPC) is always fetched regardless of the tickers list.
    Uses INSERT ... ON CONFLICT (ticker, snapshot_date) DO UPDATE to make this idempotent.
    """
    import asyncio

    from sqlalchemy import select
    from app.models.price_snapshot import PriceSnapshot

    # Always include ^GSPC for S&P 500 benchmark data
    all_tickers = list(dict.fromkeys([*tickers, "^GSPC"]))

    today = date.today()
    start_date = today - timedelta(days=days)

    # Load existing (ticker, snapshot_date) pairs so we skip already-fetched data
    existing_result = await session.execute(
        select(PriceSnapshot.ticker, PriceSnapshot.snapshot_date)
        .where(PriceSnapshot.ticker.in_(all_tickers))
        .where(PriceSnapshot.snapshot_date >= start_date)
    )
    existing_set: set[tuple] = {(row.ticker, row.snapshot_date) for row in existing_result}

    for ticker in all_tickers:
        # Determine which dates are missing for this ticker
        missing_dates = {
            start_date + timedelta(days=i)
            for i in range(days + 1)
            if (ticker, start_date + timedelta(days=i)) not in existing_set
        }
        if not missing_dates:
            continue  # All dates already in DB — nothing to fetch

        try:
            import yfinance as yf

            def _download() -> "object":
                return yf.download(
                    ticker,
                    start=start_date.isoformat(),
                    end=(today + timedelta(days=1)).isoformat(),
                    auto_adjust=True,
                    progress=False,
                )

            df = await asyncio.to_thread(_download)
            if df.empty:  # type: ignore[union-attr]
                continue

            # Flatten MultiIndex columns if present (yfinance ≥0.2 single-ticker wraps)
            if hasattr(df.columns, "levels"):  # type: ignore[union-attr]
                df.columns = df.columns.droplevel(1)  # type: ignore[union-attr]

            for idx_date, row in df.iterrows():  # type: ignore[union-attr]
                snap_date = idx_date.date() if hasattr(idx_date, "date") else idx_date
                if snap_date not in missing_dates:
                    continue  # Already in DB
                close = row["Close"]
                if hasattr(close, "item"):
                    close = close.item()
                if close is None or close != close:  # NaN check
                    continue
                stmt = pg_insert(PriceSnapshot).values(
                    ticker=ticker,
                    snapshot_date=snap_date,
                    close_price=Decimal(str(close)),
                    source="yfinance",
                )
                stmt = stmt.on_conflict_do_update(
                    index_elements=["ticker", "snapshot_date"],
                    set_={"close_price": stmt.excluded.close_price, "source": stmt.excluded.source},
                )
                await session.execute(stmt)

        except Exception as exc:
            logger.warning("fetch_and_store_prices: failed for %s: %s", ticker, exc)

    await session.commit()


async def backfill_price_history(
    session: AsyncSession,
    since_date: date,
) -> dict:
    """Bulk-download full price history for all distinct trade tickers since `since_date`.

    Uses yfinance's multi-ticker bulk download (one HTTP call per ticker) rather than
    one call per ticker-date combination — orders of magnitude faster for historical backfill.
    Also re-runs compute_return_for_trade for every trade that gains an entry price.

    Returns a summary dict with counts of tickers fetched, snapshots inserted, and returns computed.
    """
    import yfinance as yf
    from sqlalchemy import select, text
    from app.models.price_snapshot import PriceSnapshot
    from app.models.trade import Trade

    # Collect all distinct equity tickers with trades on or after since_date
    result = await session.execute(
        text(
            "SELECT DISTINCT t.ticker FROM trades t "
            "WHERE t.return_calculable = true AND t.trade_date >= :since "
            "ORDER BY t.ticker"
        ),
        {"since": since_date},
    )
    tickers = [row[0] for row in result]
    all_tickers = list(dict.fromkeys([*tickers, "^GSPC"]))

    snapshots_inserted = 0
    tickers_fetched = 0

    for ticker in all_tickers:
        try:
            df = yf.download(
                ticker,
                start=since_date.isoformat(),
                end=(date.today() + timedelta(days=1)).isoformat(),
                auto_adjust=True,
                progress=False,
            )
            if df.empty:
                continue

            # Flatten MultiIndex columns if present (yfinance ≥0.2 with single ticker still wraps)
            if hasattr(df.columns, "levels"):
                df.columns = df.columns.droplevel(1)

            for idx_date, row in df.iterrows():
                snap_date = idx_date.date() if hasattr(idx_date, "date") else idx_date
                close = row["Close"]
                if hasattr(close, "item"):
                    close = close.item()
                if close is None or close != close:  # NaN check
                    continue
                stmt = pg_insert(PriceSnapshot).values(
                    ticker=ticker,
                    snapshot_date=snap_date,
                    close_price=Decimal(str(close)),
                    source="yfinance_backfill",
                )
                stmt = stmt.on_conflict_do_update(
                    index_elements=["ticker", "snapshot_date"],
                    set_={"close_price": stmt.excluded.close_price, "source": stmt.excluded.source},
                )
                await session.execute(stmt)
                snapshots_inserted += 1

            tickers_fetched += 1
        except Exception as exc:
            logger.warning("backfill_price_history: failed for %s: %s", ticker, exc)

    await session.commit()
    logger.info(
        "backfill_price_history: fetched %d tickers, inserted/updated %d snapshots",
        tickers_fetched, snapshots_inserted,
    )

    # Re-run return computation for all trades that now have price data
    from app.ingestion.pipeline import compute_return_for_trade
    trades_result = await session.execute(
        select(Trade).where(Trade.return_calculable == True, Trade.trade_date >= since_date)  # noqa: E712
    )
    trades = list(trades_result.scalars().all())
    returns_computed = 0
    for trade in trades:
        try:
            await compute_return_for_trade(session, trade)
            returns_computed += 1
        except Exception as exc:
            logger.warning("backfill_price_history: return compute failed for trade %s: %s", trade.id, exc)

    logger.info("backfill_price_history: computed returns for %d trades", returns_computed)
    return {
        "tickers_fetched": tickers_fetched,
        "snapshots_inserted": snapshots_inserted,
        "returns_computed": returns_computed,
    }


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
                sector = info.get("sector") or None    # coerce "" to None
                industry = info.get("industry") or None
                quote_type = info.get("quoteType")
                slug = slugify(sector) if sector else None
                return {
                    "sector": sector,
                    "industry": industry,
                    "sector_slug": slug if slug else None,  # coerce "" slug to None
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
