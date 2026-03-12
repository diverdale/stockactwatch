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

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from app.config import settings
from app.db import AsyncSessionLocal
from app.ingestion.normalizer import normalize_quiver_trade
from app.ingestion.quiver import fetch_congress_trades
from app.models.ingestion_log import IngestionLog
from app.models.politician import Politician
from app.models.trade import Trade

logger = logging.getLogger(__name__)

# Chunk size for batch upserts.
# PostgreSQL bind parameter limit is 32,767 per statement.
# Trade upsert has ~20 columns → 500 rows × 20 = 10,000 params — safely under the limit.
BATCH_SIZE = 500


async def upsert_trades_batch(session: AsyncSession, trades: list[dict]) -> int:
    """Upsert a list of trade dicts into the trades table in chunks of BATCH_SIZE.

    Uses INSERT ... ON CONFLICT (external_id) DO UPDATE so that amended records
    overwrite stale versions automatically.

    Returns the total number of records processed (not distinct upserts).
    """
    if not trades:
        return 0

    total = 0
    for i in range(0, len(trades), BATCH_SIZE):
        chunk = trades[i : i + BATCH_SIZE]
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
    return total


async def _upsert_politician(
    session: AsyncSession, politician_name: str, source: str
) -> uuid.UUID:
    """Upsert a politician by external_id and return their UUID.

    external_id is keyed as "{source}:{politician_name.lower().strip()}" to ensure
    stable identity across ingestion runs.
    """
    ext_id = f"{source}:{politician_name.lower().strip()}"

    stmt = pg_insert(Politician).values(
        external_id=ext_id,
        full_name=politician_name,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["external_id"],
        set_={"full_name": stmt.excluded.full_name},
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

    return uuid.UUID(str(row[0]))


async def run_ingestion_pipeline() -> None:
    """Fetch all available congress trades, normalize, upsert, and write an ingestion log.

    Called by APScheduler on the interval trigger, or directly by POST /internal/ingest.
    The caller (APScheduler AsyncIOScheduler) invokes this coroutine directly on the
    existing event loop — do not wrap it with the asyncio run helper.

    # Price fetching and returns computation wired in Plan 01-04
    """
    started_at = datetime.now(timezone.utc)
    trades_fetched = 0
    trades_upserted = 0
    errors: dict = {}
    status = "success"

    async with AsyncSessionLocal() as session:
        try:
            raw_records = await fetch_congress_trades()
            trades_fetched = len(raw_records)

            trade_dicts: list[dict] = []
            for raw in raw_records:
                try:
                    trade_in = normalize_quiver_trade(raw)
                    politician_id = await _upsert_politician(
                        session, trade_in.politician_name, trade_in.source
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
                    trade_dicts.append(trade_dict)
                except Exception as record_exc:
                    logger.warning("Skipping record due to normalization error: %s", record_exc)
                    errors.setdefault("records", []).append(str(record_exc))

            trades_upserted = await upsert_trades_batch(session, trade_dicts)
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

    # Price fetching and returns computation wired in Plan 01-04
    """
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

            trade_dicts: list[dict] = []
            for raw in raw_records:
                try:
                    trade_in = normalize_quiver_trade(raw)
                    politician_id = await _upsert_politician(
                        session, trade_in.politician_name, trade_in.source
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
                    trade_dicts.append(trade_dict)
                except Exception as record_exc:
                    logger.warning(
                        "Amendment recheck: skipping record due to error: %s", record_exc
                    )
                    errors.setdefault("records", []).append(str(record_exc))

            trades_upserted = await upsert_trades_batch(session, trade_dicts)
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
