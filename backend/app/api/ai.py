"""AI-powered endpoints: suspicion scores, politician summaries, and natural language Q&A."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from redis.asyncio import Redis
from sqlalchemy import select
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


class AiHistoryEntry(BaseModel):
    id: str
    question: str
    answer: str
    tool_used: str | None
    result_count: int
    created_at: str


@router.post("/ask", response_model=AskResponse)
async def ask_question(
    body: AskRequest,
    db: AsyncSession = Depends(get_db),
    x_user_id: str | None = Header(default=None),
) -> AskResponse:
    """Answer a natural language question about congressional trading data using Claude."""
    from app.services.ask import answer_question
    from app.models.user_ai_history import UserAiHistory

    q = body.question.strip()
    if not q:
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    if len(q) > 500:
        raise HTTPException(status_code=400, detail="Question too long (max 500 chars)")

    result = await answer_question(q, db)

    if x_user_id:
        try:
            entry = UserAiHistory(
                user_id=x_user_id,
                question=q,
                answer=result["answer"],
                tool_used=result.get("tool_used"),
                result_count=len(result.get("results") or []),
            )
            db.add(entry)
            await db.commit()
        except Exception:
            await db.rollback()

    return AskResponse(**result)


@router.get("/history", response_model=list[AiHistoryEntry])
async def get_ai_history(
    db: AsyncSession = Depends(get_db),
    x_user_id: str | None = Header(default=None),
) -> list[AiHistoryEntry]:
    """Return the signed-in user's AI query history (most recent first)."""
    from app.models.user_ai_history import UserAiHistory

    if not x_user_id:
        return []

    rows = (
        await db.execute(
            select(UserAiHistory)
            .where(UserAiHistory.user_id == x_user_id)
            .order_by(UserAiHistory.created_at.desc())
            .limit(50)
        )
    ).scalars().all()

    return [
        AiHistoryEntry(
            id=str(row.id),
            question=row.question,
            answer=row.answer,
            tool_used=row.tool_used,
            result_count=row.result_count,
            created_at=row.created_at.isoformat() if row.created_at else "",
        )
        for row in rows
    ]
