from contextlib import asynccontextmanager
from typing import AsyncGenerator

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.api.internal import router as internal_router
from app.db import engine


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Railway single-process: APScheduler runs in-process on the event loop.
    # Deferred import so main.py is importable before scheduler.py exists (Plan 01-01 decision).
    from app.ingestion.scheduler import register_jobs  # noqa: PLC0415

    scheduler = AsyncIOScheduler()
    register_jobs(scheduler)
    scheduler.start()

    yield

    scheduler.shutdown(wait=False)
    await engine.dispose()


app = FastAPI(title="Stock Tracker API", lifespan=lifespan)

# Mount internal endpoints — auth guarded by X-Internal-Secret header
app.include_router(internal_router)


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok"})
