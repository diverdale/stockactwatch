"""
Internal API endpoints — not exposed to end users.

All routes require X-Internal-Secret header authentication.
Mounted at /internal in main.py.
"""
from __future__ import annotations

import hmac
import logging

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
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
    x_internal_secret: str = Header(...),
    since: str | None = None,
) -> dict:
    """Trigger a full historical backfill from the Quiver bulk endpoint.

    Fetches all available congressional trades (back to ~2012) and upserts them.
    This is a long-running operation — expect several minutes for a full run.

    Optional query param `since` (YYYY-MM-DD) limits to trades on or after that date.
    Requires the X-Internal-Secret header.
    """
    if not hmac.compare_digest(x_internal_secret, settings.INTERNAL_SECRET):
        raise HTTPException(status_code=403, detail="Forbidden")

    logger.info("Full backfill triggered via POST /internal/backfill since=%s", since)
    await run_full_backfill(since_date=since)
    return {"status": "ok", "message": "Backfill complete", "since": since}


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
