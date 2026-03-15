from contextlib import asynccontextmanager
from typing import AsyncGenerator

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app import cache as redis_cache
from app.api.cluster import router as cluster_router
from app.api.conflicts import router as conflicts_router
from app.api.feed import router as feed_router
from app.api.internal import router as internal_router
from app.api.leaderboard import router as leaderboard_router
from app.api.profile_ticker import router as profile_ticker_router
from app.api.search import router as search_router
from app.api.sectors import router as sectors_router
from app.api.stats import router as stats_router
from app.config import settings
from app.db import dispose_engine


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Railway single-process: APScheduler runs in-process on the event loop.
    # Deferred import so main.py is importable before scheduler.py exists (Plan 01-01 decision).
    from app.ingestion.scheduler import register_jobs  # noqa: PLC0415

    scheduler = AsyncIOScheduler()
    register_jobs(scheduler)
    scheduler.start()

    redis_cache._pool = redis_cache.create_pool(settings.REDIS_URL)

    yield

    scheduler.shutdown(wait=False)
    if redis_cache._pool:
        await redis_cache._pool.aclose()
    await dispose_engine()


app = FastAPI(title="Stock Tracker API", lifespan=lifespan)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": jsonable_encoder(exc.body)},
    )


# Mount internal endpoints — auth guarded by X-Internal-Secret header
app.include_router(internal_router)

# Mount leaderboard endpoints
app.include_router(leaderboard_router)

# Mount feed endpoint
app.include_router(feed_router)

# Mount politician profile and ticker endpoints
app.include_router(profile_ticker_router)

# Mount search endpoints (requires migration 0003 — pg_trgm extension)
app.include_router(search_router)

# Mount stats endpoint (landing page)
app.include_router(stats_router)

# Mount cluster endpoint (stocks traded by multiple members)
app.include_router(cluster_router)

# Mount sector dashboard endpoints (requires migration 0005 — ticker_meta table)
app.include_router(sectors_router)

# Mount committee conflict detector (requires migration 0006 — politician_committees table)
app.include_router(conflicts_router)


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok"})
