"""
APScheduler job registration for the ingestion pipeline.

register_jobs() is called once during the FastAPI lifespan startup.
Both jobs use max_instances=1 and coalesce=True to prevent overlap and
merge misfired triggers into a single execution.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import settings
from app.ingestion.pipeline import run_amendment_recheck, run_ingestion_pipeline

# Delay first ingestion run so the app can serve requests immediately after startup
_STARTUP_DELAY_MINUTES = 5


def register_jobs(scheduler: AsyncIOScheduler) -> None:
    """Register all periodic ingestion jobs with the given scheduler.

    Jobs:
    - ingest_trades: interval trigger, every INGEST_INTERVAL_MINUTES minutes
    - recheck_amendments: cron trigger, daily at 02:00 UTC
    """
    first_run = datetime.now(timezone.utc) + timedelta(minutes=_STARTUP_DELAY_MINUTES)
    scheduler.add_job(
        run_ingestion_pipeline,
        trigger="interval",
        minutes=settings.INGEST_INTERVAL_MINUTES,
        id="ingest_trades",
        max_instances=1,  # CRITICAL: prevents overlap if a run takes longer than the interval
        misfire_grace_time=60,
        coalesce=True,  # merge misfires into a single run rather than catching up
        next_run_time=first_run,  # delay first run — app must be ready before pipeline fires
    )
    scheduler.add_job(
        run_amendment_recheck,
        trigger="cron",
        hour=2,
        minute=0,  # 02:00 UTC nightly
        id="recheck_amendments",
        max_instances=1,
        coalesce=True,
    )
