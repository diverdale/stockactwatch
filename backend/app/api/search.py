"""Search API endpoints — politician name autocomplete and ticker prefix search.

GET /search/politicians?q={query}  — word_similarity search via pg_trgm
GET /search/tickers?q={prefix}     — ILIKE prefix match (works for 1-2 char tickers)

Both endpoints cache results in Redis for 30 seconds.
Requires migration 0003 (pg_trgm extension + GIN indexes).
"""
import hashlib
import json
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache import get_redis
from app.db import get_db
from app.models.politician import Politician
from app.models.trade import Trade
from app.schemas.search import (
    PoliticianSearchResponse,
    PoliticianSuggestion,
    TickerSearchResponse,
    TickerSuggestion,
)

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/politicians", response_model=PoliticianSearchResponse)
async def search_politicians(
    q: Annotated[str, Query(min_length=2, max_length=100)],
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
) -> PoliticianSearchResponse:
    """Return up to 8 politicians matching q using pg_trgm word_similarity."""
    cache_key = f"search:pol:{hashlib.md5(q.lower().encode()).hexdigest()}"
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    stmt = (
        select(Politician.id, Politician.full_name, Politician.party, Politician.chamber)
        .where(
            func.lower(q).op("<%")(func.lower(Politician.full_name))
        )
        .where(Politician.active == True)  # noqa: E712
        .order_by(
            func.word_similarity(func.lower(q), func.lower(Politician.full_name)).desc()
        )
        .limit(8)
    )
    rows = (await db.execute(stmt)).all()
    results = [
        PoliticianSuggestion(id=r.id, full_name=r.full_name, party=r.party, chamber=r.chamber)
        for r in rows
    ]
    payload = PoliticianSearchResponse(results=results)
    await redis.setex(cache_key, 30, json.dumps(payload.model_dump(), default=str))
    return payload


@router.get("/tickers", response_model=TickerSearchResponse)
async def search_tickers(
    q: Annotated[str, Query(min_length=1, max_length=10)],
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
) -> TickerSearchResponse:
    """Return up to 10 distinct tickers matching q as a prefix.

    Uses ILIKE (not trigram similarity) so 1-2 char tickers like AA, C, F
    are found correctly — short strings have no extractable trigrams.
    """
    cache_key = f"search:tick:{hashlib.md5(q.upper().encode()).hexdigest()}"
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    stmt = (
        select(Trade.ticker)
        .where(Trade.ticker.ilike(f"{q.upper()}%"))
        .distinct()
        .order_by(Trade.ticker)
        .limit(10)
    )
    rows = (await db.execute(stmt)).all()
    results = [TickerSuggestion(ticker=r.ticker) for r in rows]
    payload = TickerSearchResponse(results=results)
    await redis.setex(cache_key, 30, json.dumps(payload.model_dump()))
    return payload
