"""AI-powered endpoints: suspicion scores, politician summaries, and natural language Q&A."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache import get_redis
from app.db import get_db
from app.services.ai_summary import get_or_generate_summary

router = APIRouter(prefix="/ai", tags=["ai"])


class AISummaryResponse(BaseModel):
    politician_id: str
    summary: str | None
    generated_at: str | None
    cached: bool = False


@router.get("/politicians/{politician_id}/summary", response_model=AISummaryResponse)
async def get_politician_summary(
    politician_id: str,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> AISummaryResponse:
    import json
    cache_key = f"ai:summary:{politician_id}"
    cached_raw = await redis.get(cache_key)
    if cached_raw:
        data = json.loads(cached_raw)
        return AISummaryResponse(
            politician_id=politician_id,
            summary=data.get("summary"),
            generated_at=data.get("generated_at"),
            cached=True,
        )

    result = await get_or_generate_summary(politician_id, db, redis)
    return AISummaryResponse(
        politician_id=politician_id,
        summary=result.get("summary"),
        generated_at=result.get("generated_at"),
        cached=False,
    )


class AskRequest(BaseModel):
    question: str


class AskResponse(BaseModel):
    answer: str
    results: list[dict] | None = None
    tool_used: str | None = None


@router.post("/ask", response_model=AskResponse)
async def ask_question(
    body: AskRequest,
    db: AsyncSession = Depends(get_db),
) -> AskResponse:
    """Answer a natural language question about congressional trading data using Claude."""
    from app.services.ask import answer_question

    q = body.question.strip()
    if not q:
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    if len(q) > 500:
        raise HTTPException(status_code=400, detail="Question too long (max 500 chars)")

    result = await answer_question(q, db)
    return AskResponse(**result)
