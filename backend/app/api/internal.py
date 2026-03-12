"""
Internal API endpoints — not exposed to end users.

All routes require X-Internal-Secret header authentication.
Mounted at /internal in main.py.
"""
from __future__ import annotations

import hmac
import logging

from fastapi import APIRouter, Header, HTTPException

from app.config import settings
from app.ingestion.pipeline import run_ingestion_pipeline

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


@router.get("/internal/health")
async def internal_health() -> dict:
    """Lightweight health check for cron/uptime services.

    Returns a simple status dict. For scheduler status see the main /health endpoint.
    """
    return {"status": "ok", "scheduler": "see /health"}
