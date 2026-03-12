from contextlib import asynccontextmanager
from typing import AsyncGenerator

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.db import engine


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Railway single-process: APScheduler runs in-process on the event loop.
    # register_jobs is defined in app.ingestion.scheduler (created in Plan 01-03).
    from app.ingestion.scheduler import register_jobs  # noqa: PLC0415

    scheduler = AsyncIOScheduler()
    register_jobs(scheduler)
    scheduler.start()

    yield

    scheduler.shutdown(wait=False)
    await engine.dispose()


app = FastAPI(title="Stock Tracker API", lifespan=lifespan)


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok"})


@app.get("/internal/ingest-trigger")
async def ingest_trigger() -> JSONResponse:
    # Placeholder — will be wired in Plan 01-03.
    return JSONResponse({"detail": "Not Implemented"}, status_code=501)
