"""
Internal API endpoints — not exposed to end users.

All routes require X-Internal-Secret header authentication.
Mounted at /internal in main.py.
"""
from __future__ import annotations

import hmac
import logging

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.leaderboard import returns_cache_key, volume_cache_key
from app.cache import get_redis
from app.config import settings
from app.db import get_db
from app.ingestion.pipeline import run_ingestion_pipeline, run_full_backfill

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/internal/ingest")
async def trigger_ingest(x_internal_secret: str = Header(...)) -> dict:
    """Trigger the ingestion pipeline immediately.

    Requires the X-Internal-Secret header to match settings.INTERNAL_SECRET.
    Returns HTTP 403 on mismatch — using timing-safe comparison to prevent timing attacks.
    """
    if not hmac.compare_digest(x_internal_secret, settings.INTERNAL_SECRET):
        raise HTTPException(status_code=403, detail="Forbidden")

    logger.info("Manual ingestion triggered via POST /internal/ingest")
    await run_ingestion_pipeline()
    return {"status": "ok", "message": "Ingestion triggered"}


@router.post("/internal/backfill")
async def trigger_backfill(
    background_tasks: BackgroundTasks,
    x_internal_secret: str = Header(...),
    since: str | None = None,
) -> dict:
    """Trigger a full historical backfill from the Quiver bulk endpoint.

    Fetches all available congressional trades (back to ~2012) and upserts them.
    This is a long-running operation — runs in the background to avoid proxy timeouts.

    Optional query param `since` (YYYY-MM-DD) limits to trades on or after that date.
    Requires the X-Internal-Secret header.
    """
    if not hmac.compare_digest(x_internal_secret, settings.INTERNAL_SECRET):
        raise HTTPException(status_code=403, detail="Forbidden")

    logger.info("Full backfill triggered via POST /internal/backfill since=%s", since)
    background_tasks.add_task(run_full_backfill, since_date=since)
    return {"status": "accepted", "message": "Backfill started in background", "since": since}


@router.get("/internal/health")
async def internal_health() -> dict:
    """Lightweight health check for cron/uptime services.

    Returns a simple status dict. For scheduler status see the main /health endpoint.
    """
    return {"status": "ok", "scheduler": "see /health"}


@router.post("/internal/revalidate-isr")
async def trigger_isr_revalidation(
    tags: list[str],
    x_internal_secret: str = Header(...),
    redis: Redis = Depends(get_redis),
) -> dict:
    """Invalidate Redis leaderboard cache keys, then call Next.js ISR revalidation.

    Order matters: delete Redis keys FIRST, then call Next.js webhook.
    This prevents Next.js from fetching and caching stale data from a warm Redis key.

    If NEXTJS_URL is empty (e.g. in CI), ISR webhook call is skipped silently.
    """
    if not hmac.compare_digest(x_internal_secret, settings.INTERNAL_SECRET):
        raise HTTPException(status_code=403, detail="Forbidden")

    # Step 1: Invalidate Redis keys for affected tags
    redis_deletes = []
    for tag in tags:
        if tag == "leaderboard:returns":
            # Delete all limit variants — use pattern delete for simplicity
            # (In production, track active keys; for now delete known defaults)
            redis_deletes.append(returns_cache_key(20))
            redis_deletes.append(returns_cache_key(50))
            redis_deletes.append(returns_cache_key(100))
        elif tag == "leaderboard:volume":
            # Delete all-time/no-filter default key; add more as needed
            redis_deletes.append(volume_cache_key(None, None, "all", 20))
    if redis_deletes:
        await redis.delete(*redis_deletes)

    # Step 2: Call Next.js ISR revalidation (only if NEXTJS_URL configured)
    revalidated = []
    if settings.NEXTJS_URL:
        async with httpx.AsyncClient() as client:
            for tag in tags:
                try:
                    await client.get(
                        f"{settings.NEXTJS_URL}/api/revalidate",
                        params={"tag": tag, "secret": settings.REVALIDATE_SECRET},
                        timeout=5.0,
                    )
                    revalidated.append(tag)
                except httpx.RequestError:
                    logger.warning("ISR revalidation failed for tag %s", tag)

    return {"status": "ok", "redis_keys_deleted": redis_deletes, "tags_revalidated": revalidated}


@router.post("/internal/enrich-committees")
async def enrich_committees(
    x_internal_secret: str = Header(...),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Fetch current committee memberships from unitedstates.github.io and upsert."""
    if not hmac.compare_digest(x_internal_secret, settings.INTERNAL_SECRET):
        raise HTTPException(status_code=403, detail="Forbidden")
    from app.ingestion.committees import enrich_politician_committees

    count = await enrich_politician_committees(db)
    return {"status": "ok", "rows_upserted": count}


@router.post("/internal/enrich-hearings")
async def enrich_hearings(
    x_internal_secret: str = Header(...),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Fetch committee meetings/hearings from congress.gov and upsert into committee_hearings."""
    if not hmac.compare_digest(x_internal_secret, settings.INTERNAL_SECRET):
        raise HTTPException(status_code=403, detail="Forbidden")
    from app.ingestion.committees import fetch_committee_hearings

    count = await fetch_committee_hearings(db)
    return {"status": "ok", "rows_upserted": count}


@router.post("/internal/backfill-sector-meta")
async def backfill_sector_meta(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Enrich ticker_meta for all tickers in the trades table not yet in ticker_meta.

    Protected by INTERNAL_SECRET header (same as /internal/ingest).
    Rate: sequential fetch — do not call concurrently with ingestion pipeline.
    """
    from sqlalchemy import text
    from app.ingestion.prices import fetch_and_store_ticker_meta

    secret = request.headers.get("X-Internal-Secret", "")
    if not hmac.compare_digest(secret, settings.INTERNAL_SECRET):
        raise HTTPException(status_code=403, detail="Forbidden")

    # Get all distinct tickers from trades not yet in ticker_meta
    result = await db.execute(
        text(
            "SELECT DISTINCT t.ticker FROM trades t "
            "LEFT JOIN ticker_meta tm ON t.ticker = tm.ticker "
            "WHERE tm.ticker IS NULL"
        )
    )
    missing_tickers = [row[0] for row in result.fetchall()]
    await fetch_and_store_ticker_meta(db, missing_tickers)
    return {"status": "ok", "enriched": len(missing_tickers)}


@router.get("/internal/logs")
async def ingestion_logs(
    x_internal_secret: str = Header(...),
    db: AsyncSession = Depends(get_db),
    limit: int = 20,
) -> list[dict]:
    """Return recent ingestion log entries for the admin dashboard."""
    if not hmac.compare_digest(x_internal_secret, settings.INTERNAL_SECRET):
        raise HTTPException(status_code=403, detail="Forbidden")
    from sqlalchemy import select
    from app.models.ingestion_log import IngestionLog

    rows = (
        await db.execute(
            select(IngestionLog)
            .order_by(IngestionLog.started_at.desc())
            .limit(limit)
        )
    ).scalars().all()
    return [
        {
            "id": str(r.id),
            "source": r.source,
            "status": r.status,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "finished_at": r.finished_at.isoformat() if r.finished_at else None,
            "trades_fetched": r.trades_fetched,
            "trades_upserted": r.trades_upserted,
        }
        for r in rows
    ]


@router.post("/internal/rescore-suspicion")
async def rescore_suspicion(
    background_tasks: BackgroundTasks,
    x_internal_secret: str = Header(...),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Null all suspicion scores then re-score every trade.

    Runs in the background to avoid proxy timeouts.
    Requires the X-Internal-Secret header.
    """
    if not hmac.compare_digest(x_internal_secret, settings.INTERNAL_SECRET):
        raise HTTPException(status_code=403, detail="Forbidden")

    from sqlalchemy import text
    from app.services.suspicion import score_unscored_trades

    async def _run():
        await db.execute(text("UPDATE trades SET suspicion_score = NULL, suspicion_flags = NULL"))
        await db.commit()
        logger.info("Suspicion scores cleared. Re-scoring all trades...")
        total = await score_unscored_trades(db)
        logger.info("Suspicion re-score complete: %d trades scored.", total)

    background_tasks.add_task(_run)
    return {"status": "accepted", "message": "Re-score started in background"}


@router.post("/internal/backfill-prices")
async def backfill_prices(
    background_tasks: BackgroundTasks,
    request: Request,
    db: AsyncSession = Depends(get_db),
    since: str = "2024-01-01",
) -> dict:
    """Bulk-download full price history and recompute returns for all trades since `since`.

    Protected by INTERNAL_SECRET header. Runs in background to avoid proxy timeouts.
    """
    from datetime import date as date_type
    from app.ingestion.prices import backfill_price_history

    secret = request.headers.get("X-Internal-Secret", "")
    if not hmac.compare_digest(secret, settings.INTERNAL_SECRET):
        raise HTTPException(status_code=403, detail="Forbidden")

    since_date = date_type.fromisoformat(since)
    logger.info("Price history backfill triggered via POST /internal/backfill-prices since=%s", since)
    background_tasks.add_task(backfill_price_history, db, since_date)
    return {"status": "accepted", "message": "Price backfill started in background", "since": since}
