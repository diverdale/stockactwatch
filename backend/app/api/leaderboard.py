"""
Leaderboard API endpoints — returns rankings and volume rankings.

GET /leaderboard/returns  — politicians ranked by avg return pct
GET /leaderboard/volume   — politicians ranked by trade count (filterable)
"""
from __future__ import annotations

import json
from datetime import date, timedelta
from enum import Enum
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from redis.asyncio import Redis
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache import get_redis
from app.db import get_db
from app.models.computed_return import ComputedReturn
from app.models.politician import Politician
from app.models.trade import Trade
from app.schemas.leaderboard import (
    METHODOLOGY_LABEL_V1,
    LeaderboardResponse,
    ReturnLeaderboardEntry,
    VolumeLeaderboardEntry,
    VolumeLeaderboardResponse,
)


# ---------------------------------------------------------------------------
# Enum definitions for query parameter validation
# ---------------------------------------------------------------------------


class Chamber(str, Enum):
    house = "House"
    senate = "Senate"


class Party(str, Enum):
    democrat = "Democrat"
    republican = "Republican"
    independent = "Independent"


class TimePeriod(str, Enum):
    ytd = "ytd"
    one_year = "1y"
    all_time = "all"


# ---------------------------------------------------------------------------
# Period helper
# ---------------------------------------------------------------------------


def _period_to_cutoff(period: str) -> date | None:
    today = date.today()
    if period == "ytd":
        return date(today.year, 1, 1)
    if period == "1y":
        return today - timedelta(days=365)
    return None  # "all" — no cutoff


# ---------------------------------------------------------------------------
# Cache key helpers (used by Plan 02-02 Redis caching layer)
# ---------------------------------------------------------------------------


def returns_cache_key(limit: int) -> str:
    return f"leaderboard:returns:lim={limit}"


def volume_cache_key(chamber, party, period, limit) -> str:
    return f"leaderboard:volume:ch={chamber or 'any'}:p={party or 'any'}:t={period}:lim={limit}"


# ---------------------------------------------------------------------------
# Standalone async query functions (decoupled for unit testing)
# ---------------------------------------------------------------------------


async def query_returns_leaderboard(db: AsyncSession, limit: int = 20):
    """Return rows ordered by avg return_pct desc, NULL return_pct excluded."""
    stmt = (
        select(
            Politician.id,
            Politician.full_name,
            func.avg(ComputedReturn.return_pct).label("avg_return_pct"),
            func.min(ComputedReturn.return_pct).label("return_low"),
            func.max(ComputedReturn.return_pct).label("return_high"),
            func.count(ComputedReturn.id).label("trade_count"),
            func.max(ComputedReturn.methodology_ver).label("methodology_ver"),
        )
        .join(ComputedReturn, ComputedReturn.politician_id == Politician.id)
        .where(ComputedReturn.return_pct.is_not(None))
        .group_by(Politician.id, Politician.full_name)
        .order_by(func.avg(ComputedReturn.return_pct).desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.all()


async def query_volume_leaderboard(
    db: AsyncSession,
    chamber: str | None,
    party: str | None,
    period: str,
    limit: int = 20,
):
    """Return rows ordered by trade_count desc, filtered by chamber/party/period."""
    cutoff = _period_to_cutoff(period)

    stmt = (
        select(
            Politician.id,
            Politician.full_name,
            Politician.chamber,
            Politician.party,
            func.count(Trade.id).label("trade_count"),
        )
        .join(Trade, Trade.politician_id == Politician.id)
        .group_by(Politician.id, Politician.full_name, Politician.chamber, Politician.party)
        .order_by(func.count(Trade.id).desc())
        .limit(limit)
    )

    if chamber is not None:
        stmt = stmt.where(Politician.chamber == chamber)
    if party is not None:
        stmt = stmt.where(Politician.party == party)
    if cutoff is not None:
        stmt = stmt.where(Trade.trade_date >= cutoff)

    result = await db.execute(stmt)
    return result.all()


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


@router.get("/returns", response_model=LeaderboardResponse)
async def get_returns_leaderboard(
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> LeaderboardResponse:
    cache_key = returns_cache_key(limit)
    cached_raw = await redis.get(cache_key)
    if cached_raw:
        data = json.loads(cached_raw)
        return LeaderboardResponse(
            entries=[ReturnLeaderboardEntry(**e) for e in data],
            total=len(data),
            cached=True,
        )

    rows = await query_returns_leaderboard(db, limit)
    entries = [
        ReturnLeaderboardEntry(
            politician_id=str(row.id),
            full_name=row.full_name,
            avg_return_pct=row.avg_return_pct,
            return_low=row.return_low,
            return_high=row.return_high,
            trade_count=row.trade_count,
            methodology_label=METHODOLOGY_LABEL_V1,
            disclaimer=True,
        )
        for row in rows
    ]
    payload = [e.model_dump() for e in entries]
    await redis.setex(cache_key, 300, json.dumps(payload, default=str))
    return LeaderboardResponse(entries=entries, total=len(entries), cached=False)


@router.get("/volume", response_model=VolumeLeaderboardResponse)
async def get_volume_leaderboard(
    chamber: Annotated[Chamber | None, Query()] = None,
    party: Annotated[Party | None, Query()] = None,
    period: Annotated[TimePeriod, Query()] = TimePeriod.all_time,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> VolumeLeaderboardResponse:
    cache_key = volume_cache_key(
        chamber.value if chamber else None,
        party.value if party else None,
        period.value,
        limit,
    )
    cached_raw = await redis.get(cache_key)
    if cached_raw:
        data = json.loads(cached_raw)
        return VolumeLeaderboardResponse(
            entries=[VolumeLeaderboardEntry(**e) for e in data],
            total=len(data),
            cached=True,
            filters_applied={"chamber": chamber, "party": party, "period": period, "limit": limit},
        )

    rows = await query_volume_leaderboard(
        db,
        chamber.value if chamber else None,
        party.value if party else None,
        period.value,
        limit,
    )
    entries = [
        VolumeLeaderboardEntry(
            politician_id=str(row.id),
            full_name=row.full_name,
            chamber=row.chamber,
            party=row.party,
            trade_count=row.trade_count,
        )
        for row in rows
    ]
    payload = [e.model_dump() for e in entries]
    await redis.setex(cache_key, 300, json.dumps(payload, default=str))
    return VolumeLeaderboardResponse(
        entries=entries,
        total=len(entries),
        cached=False,
        filters_applied={"chamber": chamber, "party": party, "period": period, "limit": limit},
    )
