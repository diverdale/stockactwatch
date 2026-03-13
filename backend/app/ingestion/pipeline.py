"""
Ingestion pipeline: fetch → normalize → upsert → log.

run_ingestion_pipeline() is the entry point called by APScheduler or POST /internal/ingest.
run_amendment_recheck() re-fetches recent filings to overwrite amended records.

Neither function uses the asyncio run helper — APScheduler AsyncIOScheduler invokes
coroutines directly on the existing event loop.
"""
from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from app.config import settings
from app.db import AsyncSessionLocal
from app.ingestion.normalizer import normalize_quiver_trade
from app.ingestion.quiver import fetch_congress_trades, fetch_congress_trades_bulk
from app.models.computed_return import ComputedReturn
from app.models.ingestion_log import IngestionLog
from app.models.politician import Politician
from app.models.price_snapshot import PriceSnapshot
from app.models.trade import Trade

logger = logging.getLogger(__name__)

# Chunk size for batch upserts.
# PostgreSQL bind parameter limit is 32,767 per statement.
# Trade upsert has ~20 columns → 500 rows × 20 = 10,000 params — safely under the limit.
BATCH_SIZE = 500


async def get_price_snapshot(
    session: AsyncSession, ticker: str, as_of_date: date
) -> PriceSnapshot | None:
    """SELECT from price_snapshots WHERE ticker=ticker AND snapshot_date=as_of_date."""
    result = await session.execute(
        select(PriceSnapshot).where(
            PriceSnapshot.ticker == ticker,
            PriceSnapshot.snapshot_date == as_of_date,
        )
    )
    return result.scalar_one_or_none()


async def get_latest_price_snapshot(
    session: AsyncSession, ticker: str
) -> PriceSnapshot | None:
    """SELECT from price_snapshots WHERE ticker=ticker ORDER BY snapshot_date DESC LIMIT 1."""
    result = await session.execute(
        select(PriceSnapshot)
        .where(PriceSnapshot.ticker == ticker)
        .order_by(PriceSnapshot.snapshot_date.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def compute_returns_for_trade(
    session: AsyncSession, trade_id: uuid.UUID
) -> None:
    """Compute and upsert a ComputedReturn row for the given trade.

    Returns methodology (locked, methodology_ver=1):
    - Entry price: close_price from price_snapshots WHERE ticker=trade.ticker
      AND snapshot_date=trade.trade_date  (INGEST-05: entry date is trade_date, not the filing date)
    - Current price: most recent close_price for trade.ticker in price_snapshots
    - return_pct = (price_current - price_at_trade) / price_at_trade * 100
    - S&P 500 entry: close_price for '^GSPC' on trade.trade_date
    - S&P 500 current: most recent close_price for '^GSPC'
    - sp500_return_pct = (sp500_current - sp500_entry) / sp500_entry * 100
    - return_dollar_est = return_pct * amount_midpoint / 100

    LEGAL-02: Options are excluded — function returns immediately for asset_type != "equity".
    If price data is missing, returns without inserting (will retry on next pipeline run).
    """
    # Fetch trade from DB
    result = await session.execute(select(Trade).where(Trade.id == trade_id))
    trade = result.scalar_one_or_none()
    if trade is None:
        logger.warning("compute_returns_for_trade: trade not found id=%s", trade_id)
        return

    # LEGAL-02: Only equity trades get computed returns — options are excluded
    if trade.asset_type != "equity":
        return

    # Fetch price data from price_snapshots
    # INGEST-05: use trade_date as entry price date (not the filing date)
    entry_snap = await get_price_snapshot(session, trade.ticker, trade.trade_date)
    current_snap = await get_latest_price_snapshot(session, trade.ticker)
    sp500_entry_snap = await get_price_snapshot(session, "^GSPC", trade.trade_date)
    sp500_current_snap = await get_latest_price_snapshot(session, "^GSPC")

    if entry_snap is None or current_snap is None:
        # Missing price data — skip gracefully, will retry on next pipeline run
        return

    price_at_trade = Decimal(str(entry_snap.close_price))
    price_current = Decimal(str(current_snap.close_price))

    # Compute return_pct
    if price_at_trade == 0:
        return
    return_pct = (price_current - price_at_trade) / price_at_trade * Decimal("100")

    # Compute S&P 500 return (may be None if benchmark data missing)
    sp500_return_pct = None
    if sp500_entry_snap is not None and sp500_current_snap is not None:
        sp500_entry = Decimal(str(sp500_entry_snap.close_price))
        sp500_current = Decimal(str(sp500_current_snap.close_price))
        if sp500_entry != 0:
            sp500_return_pct = (sp500_current - sp500_entry) / sp500_entry * Decimal("100")

    # Compute dollar estimate using amount midpoint
    amount_lower = trade.amount_lower or 0
    amount_upper = trade.amount_upper or (amount_lower * 2)
    amount_midpoint = amount_lower + (amount_upper - amount_lower) // 2
    return_dollar_est = return_pct * Decimal(str(amount_midpoint)) / Decimal("100")

    # Upsert ComputedReturn keyed on trade_id.
    # Uses SELECT + INSERT or UPDATE to remain database-agnostic (works for both
    # PostgreSQL in production and SQLite in tests).
    existing_result = await session.execute(
        select(ComputedReturn).where(ComputedReturn.trade_id == trade_id)
    )
    existing = existing_result.scalar_one_or_none()

    if existing is None:
        cr = ComputedReturn(
            id=uuid.uuid4(),
            trade_id=trade_id,
            politician_id=trade.politician_id,
            ticker=trade.ticker,
            trade_date=trade.trade_date,
            price_at_trade=price_at_trade,
            price_current=price_current,
            return_pct=round(return_pct, 4),
            return_dollar_est=round(return_dollar_est, 2),
            sp500_return_pct=round(sp500_return_pct, 4) if sp500_return_pct is not None else None,
            methodology_ver=1,
        )
        session.add(cr)
    else:
        existing.price_current = price_current
        existing.return_pct = round(return_pct, 4)
        existing.return_dollar_est = round(return_dollar_est, 2)
        existing.sp500_return_pct = round(sp500_return_pct, 4) if sp500_return_pct is not None else None
        existing.methodology_ver = 1

    await session.commit()


async def compute_returns_for_batch(
    session: AsyncSession, external_ids: list[str]
) -> None:
    """Compute returns for all equity trades in the given list of external_ids.

    Looks up trade IDs from external_ids, then calls compute_returns_for_trade for each.
    Non-equity trades are silently skipped inside compute_returns_for_trade (LEGAL-02).
    """
    if not external_ids:
        return

    result = await session.execute(
        select(Trade.id).where(Trade.external_id.in_(external_ids))
    )
    trade_ids = [row[0] for row in result.fetchall()]

    for trade_id in trade_ids:
        try:
            await compute_returns_for_trade(session, trade_id)
        except Exception as exc:
            logger.warning("compute_returns_for_trade failed for trade_id=%s: %s", trade_id, exc)


async def upsert_trades_batch(session: AsyncSession, trades: list[dict]) -> int:
    """Upsert a list of trade dicts into the trades table in chunks of BATCH_SIZE.

    Uses INSERT ... ON CONFLICT (external_id) DO UPDATE so that amended records
    overwrite stale versions automatically.

    Returns the total number of records processed (not distinct upserts).
    """
    if not trades:
        return 0

    # Deduplicate by external_id — PostgreSQL ON CONFLICT DO UPDATE raises
    # CardinalityViolationError if two rows in the same statement share a conflict key.
    seen: dict[str, dict] = {}
    for t in trades:
        seen[t["external_id"]] = t
    deduped = list(seen.values())

    total = 0
    for i in range(0, len(deduped), BATCH_SIZE):
        chunk = deduped[i : i + BATCH_SIZE]
        stmt = pg_insert(Trade).values(chunk)
        stmt = stmt.on_conflict_do_update(
            index_elements=["external_id"],
            set_={
                "transaction_type": stmt.excluded.transaction_type,
                "trade_date": stmt.excluded.trade_date,
                "disclosure_date": stmt.excluded.disclosure_date,
                "amount_range_raw": stmt.excluded.amount_range_raw,
                "amount_lower": stmt.excluded.amount_lower,
                "amount_upper": stmt.excluded.amount_upper,
                "asset_type": stmt.excluded.asset_type,
                "amendment_version": stmt.excluded.amendment_version,
                "return_calculable": stmt.excluded.return_calculable,
                "updated_at": func.now(),
            },
        )
        await session.execute(stmt)
        total += len(chunk)

    await session.commit()
    return total  # count of deduped rows processed


async def _upsert_politician(
    session: AsyncSession,
    politician_name: str,
    source: str,
    bio_guide_id: str | None = None,
    chamber: str | None = None,
    party: str | None = None,
    state: str | None = None,
) -> uuid.UUID:
    """Upsert a politician by external_id and return their UUID.

    external_id is keyed as "{source}:{politician_name.lower().strip()}" to ensure
    stable identity across ingestion runs.
    """
    ext_id = f"{source}:{politician_name.lower().strip()}"

    values: dict = {"external_id": ext_id, "full_name": politician_name}
    if bio_guide_id is not None:
        values["bio_guide_id"] = bio_guide_id
    if chamber is not None:
        values["chamber"] = chamber
    if party is not None:
        values["party"] = party
    if state is not None:
        values["state"] = state

    stmt = pg_insert(Politician).values(**values)
    update_set: dict = {"full_name": stmt.excluded.full_name}
    if bio_guide_id is not None:
        update_set["bio_guide_id"] = stmt.excluded.bio_guide_id
    if chamber is not None:
        update_set["chamber"] = stmt.excluded.chamber
    if party is not None:
        update_set["party"] = stmt.excluded.party
    if state is not None:
        update_set["state"] = stmt.excluded.state
    stmt = stmt.on_conflict_do_update(
        index_elements=["external_id"],
        set_=update_set,
    )
    # Use RETURNING to get the id without a second SELECT.
    stmt = stmt.returning(Politician.id)
    result = await session.execute(stmt)
    row = result.fetchone()
    if row is None:
        # Fallback: query the existing row (should not happen in practice)
        existing = await session.execute(
            select(Politician.id).where(Politician.external_id == ext_id)
        )
        row = existing.fetchone()

    if row is None:
        raise RuntimeError(f"Politician upsert failed — no row returned for external_id={ext_id}")
    return uuid.UUID(str(row[0]))


async def run_ingestion_pipeline() -> None:
    """Fetch all available congress trades, normalize, upsert, fetch prices, compute returns.

    Called by APScheduler on the interval trigger, or directly by POST /internal/ingest.
    The caller (APScheduler AsyncIOScheduler) invokes this coroutine directly on the
    existing event loop — do not wrap it with the asyncio run helper.
    """
    from app.ingestion.prices import fetch_and_store_prices, fetch_and_store_ticker_info, fetch_and_store_ticker_meta

    started_at = datetime.now(timezone.utc)
    trades_fetched = 0
    trades_upserted = 0
    errors: dict = {}
    status = "success"

    async with AsyncSessionLocal() as session:
        try:
            raw_records = await fetch_congress_trades()
            trades_fetched = len(raw_records)

            normalized: list = []
            trade_dicts: list[dict] = []
            for raw in raw_records:
                try:
                    trade_in = normalize_quiver_trade(raw)
                    politician_id = await _upsert_politician(
                        session, trade_in.politician_name, trade_in.source,
                        bio_guide_id=trade_in.bio_guide_id,
                        chamber=trade_in.chamber, party=trade_in.party,
                        state=trade_in.state,
                    )
                    trade_dict = {
                        "external_id": trade_in.external_id,
                        "politician_id": politician_id,
                        "ticker": trade_in.ticker,
                        "asset_type": trade_in.asset_type.value,
                        "transaction_type": trade_in.transaction_type,
                        "trade_date": trade_in.trade_date,
                        "disclosure_date": trade_in.disclosure_date,
                        "amount_range_raw": trade_in.amount_range_raw,
                        "amount_lower": trade_in.amount_lower,
                        "amount_upper": trade_in.amount_upper,
                        "owner": trade_in.owner,
                        "amendment_version": trade_in.amendment_version,
                        "return_calculable": trade_in.return_calculable,
                        "source": trade_in.source,
                    }
                    normalized.append(trade_in)
                    trade_dicts.append(trade_dict)
                except Exception as record_exc:
                    logger.warning("Skipping record due to normalization error: %s", record_exc)
                    errors.setdefault("records", []).append(str(record_exc))

            trades_upserted = await upsert_trades_batch(session, trade_dicts)

            # Fetch prices, company names, and compute returns for this batch
            equity_tickers = [t.ticker for t in normalized if t.asset_type.value == "equity"]
            all_tickers = list(dict.fromkeys(t.ticker for t in normalized))
            await fetch_and_store_prices(session, equity_tickers)
            await fetch_and_store_ticker_info(session, all_tickers)
            await fetch_and_store_ticker_meta(session, all_tickers)
            await compute_returns_for_batch(session, [t.external_id for t in normalized])

            if errors:
                status = "partial"

        except Exception as exc:
            logger.exception("Ingestion pipeline failed: %s", exc)
            status = "failed"
            errors["pipeline"] = str(exc)

        finally:
            finished_at = datetime.now(timezone.utc)
            log_entry = IngestionLog(
                source="quiver",
                started_at=started_at,
                finished_at=finished_at,
                trades_fetched=trades_fetched,
                trades_upserted=trades_upserted,
                errors=errors if errors else None,
                status=status,
            )
            session.add(log_entry)
            await session.commit()

    logger.info(
        "Ingestion complete: fetched=%d upserted=%d status=%s",
        trades_fetched,
        trades_upserted,
        status,
    )


async def run_amendment_recheck() -> None:
    """Re-fetch all filings from the last AMENDMENT_RECHECK_DAYS days and upsert.

    Idempotent: the upsert keyed on external_id automatically overwrites amended records
    with whatever the API returns. Runs nightly at 02:00 UTC via APScheduler cron trigger.
    Invoked directly by APScheduler — no run helper wrapping needed.
    """
    from app.ingestion.prices import fetch_and_store_prices, fetch_and_store_ticker_info, fetch_and_store_ticker_meta

    started_at = datetime.now(timezone.utc)
    trades_fetched = 0
    trades_upserted = 0
    errors: dict = {}
    status = "success"

    since = (date.today() - timedelta(days=settings.AMENDMENT_RECHECK_DAYS)).isoformat()

    async with AsyncSessionLocal() as session:
        try:
            raw_records = await fetch_congress_trades(since_date=since)
            trades_fetched = len(raw_records)

            normalized: list = []
            trade_dicts: list[dict] = []
            for raw in raw_records:
                try:
                    trade_in = normalize_quiver_trade(raw)
                    politician_id = await _upsert_politician(
                        session, trade_in.politician_name, trade_in.source,
                        bio_guide_id=trade_in.bio_guide_id,
                        chamber=trade_in.chamber, party=trade_in.party,
                        state=trade_in.state,
                    )
                    trade_dict = {
                        "external_id": trade_in.external_id,
                        "politician_id": politician_id,
                        "ticker": trade_in.ticker,
                        "asset_type": trade_in.asset_type.value,
                        "transaction_type": trade_in.transaction_type,
                        "trade_date": trade_in.trade_date,
                        "disclosure_date": trade_in.disclosure_date,
                        "amount_range_raw": trade_in.amount_range_raw,
                        "amount_lower": trade_in.amount_lower,
                        "amount_upper": trade_in.amount_upper,
                        "owner": trade_in.owner,
                        "amendment_version": trade_in.amendment_version,
                        "return_calculable": trade_in.return_calculable,
                        "source": trade_in.source,
                    }
                    normalized.append(trade_in)
                    trade_dicts.append(trade_dict)
                except Exception as record_exc:
                    logger.warning(
                        "Amendment recheck: skipping record due to error: %s", record_exc
                    )
                    errors.setdefault("records", []).append(str(record_exc))

            trades_upserted = await upsert_trades_batch(session, trade_dicts)

            # Re-compute returns for amended trades
            equity_tickers = [t.ticker for t in normalized if t.asset_type.value == "equity"]
            all_tickers = list(dict.fromkeys(t.ticker for t in normalized))
            await fetch_and_store_prices(session, equity_tickers)
            await fetch_and_store_ticker_info(session, all_tickers)
            await fetch_and_store_ticker_meta(session, all_tickers)
            await compute_returns_for_batch(session, [t.external_id for t in normalized])

            if errors:
                status = "partial"

        except Exception as exc:
            logger.exception("Amendment recheck failed: %s", exc)
            status = "failed"
            errors["pipeline"] = str(exc)

        finally:
            finished_at = datetime.now(timezone.utc)
            log_entry = IngestionLog(
                source="quiver_amendment_recheck",
                started_at=started_at,
                finished_at=finished_at,
                trades_fetched=trades_fetched,
                trades_upserted=trades_upserted,
                errors=errors if errors else None,
                status=status,
            )
            session.add(log_entry)
            await session.commit()

    logger.info(
        "Amendment recheck complete: since=%s fetched=%d upserted=%d status=%s",
        since,
        trades_fetched,
        trades_upserted,
        status,
    )


async def run_full_backfill(since_date: str | None = None) -> None:
    """Fetch the full historical congress trade dataset, normalize, upsert, and compute returns.

    Uses the bulk Quiver endpoint rather than the live feed so that all historical records
    are retrieved in one call.  Pass since_date (ISO-8601 string, e.g. "2020-01-01") to
    limit the backfill window; omit it to import everything available.

    Invoked manually (CLI / admin endpoint) — not scheduled automatically.
    """
    from app.ingestion.prices import fetch_and_store_prices, fetch_and_store_ticker_info, fetch_and_store_ticker_meta

    started_at = datetime.now(timezone.utc)
    trades_fetched = 0
    trades_upserted = 0
    errors: dict = {}
    status = "success"

    logger.info("Full backfill started (since_date=%s)", since_date)

    async with AsyncSessionLocal() as session:
        try:
            raw_records = await fetch_congress_trades_bulk(since_date=since_date)
            trades_fetched = len(raw_records)
            logger.info("Full backfill: retrieved %d records from bulk endpoint", trades_fetched)

            normalized: list = []
            trade_dicts: list[dict] = []
            for raw in raw_records:
                try:
                    trade_in = normalize_quiver_trade(raw)
                    politician_id = await _upsert_politician(
                        session, trade_in.politician_name, trade_in.source,
                        bio_guide_id=trade_in.bio_guide_id,
                        chamber=trade_in.chamber, party=trade_in.party,
                        state=trade_in.state,
                    )
                    trade_dict = {
                        "external_id": trade_in.external_id,
                        "politician_id": politician_id,
                        "ticker": trade_in.ticker,
                        "asset_type": trade_in.asset_type.value,
                        "transaction_type": trade_in.transaction_type,
                        "trade_date": trade_in.trade_date,
                        "disclosure_date": trade_in.disclosure_date,
                        "amount_range_raw": trade_in.amount_range_raw,
                        "amount_lower": trade_in.amount_lower,
                        "amount_upper": trade_in.amount_upper,
                        "owner": trade_in.owner,
                        "amendment_version": trade_in.amendment_version,
                        "return_calculable": trade_in.return_calculable,
                        "source": trade_in.source,
                    }
                    normalized.append(trade_in)
                    trade_dicts.append(trade_dict)
                except Exception as record_exc:
                    logger.warning(
                        "Full backfill: skipping record due to normalization error: %s", record_exc
                    )
                    errors.setdefault("records", []).append(str(record_exc))

            trades_upserted = await upsert_trades_batch(session, trade_dicts)
            logger.info("Full backfill: upserted %d records", trades_upserted)

            # Fetch prices, company names, and compute returns for the full batch
            equity_tickers = [t.ticker for t in normalized if t.asset_type.value == "equity"]
            all_tickers = list(dict.fromkeys(t.ticker for t in normalized))
            await fetch_and_store_prices(session, equity_tickers)
            await fetch_and_store_ticker_info(session, all_tickers)
            await fetch_and_store_ticker_meta(session, all_tickers)
            await compute_returns_for_batch(session, [t.external_id for t in normalized])

            if errors:
                status = "partial"

        except Exception as exc:
            logger.exception("Full backfill failed: %s", exc)
            status = "failed"
            errors["pipeline"] = str(exc)

        finally:
            finished_at = datetime.now(timezone.utc)
            log_entry = IngestionLog(
                source="quiver_bulk_backfill",
                started_at=started_at,
                finished_at=finished_at,
                trades_fetched=trades_fetched,
                trades_upserted=trades_upserted,
                errors=errors if errors else None,
                status=status,
            )
            session.add(log_entry)
            await session.commit()

    logger.info(
        "Full backfill complete: since_date=%s fetched=%d upserted=%d status=%s",
        since_date,
        trades_fetched,
        trades_upserted,
        status,
    )
