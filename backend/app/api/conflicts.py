"""
Conflicts API — trades where a politician sits on the oversight committee
for the sector they're trading in.

Endpoints:
  GET /conflicts         — full list of flagged trades
  GET /conflicts/summary — committee-level scorecards for dashboard
  GET /conflicts/hearings — committee hearing dates for timeline
"""
from __future__ import annotations

import json
import logging
from collections import defaultdict

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from redis.asyncio import Redis
from sqlalchemy import case, func, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache import get_redis
from app.db import get_db
from app.ingestion.committees import COMMITTEE_TO_SECTORS
from app.models.committee_hearing import CommitteeHearing
from app.models.politician import Politician
from app.models.politician_committee import PoliticianCommittee
from app.models.ticker_info import TickerInfo
from app.models.ticker_meta import TickerMeta
from app.models.trade import Trade

logger = logging.getLogger(__name__)

router = APIRouter(tags=["conflicts"])

CACHE_KEY = "conflicts:all"
CACHE_TTL = 600

BIOGUIDE_PHOTO_URL = (
    "https://bioguide.congress.gov/bioguide/photo/{letter}/{bio_id}.jpg"
)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class ConflictTrade(BaseModel):
    trade_id: str
    politician_id: str
    full_name: str
    chamber: str | None
    party: str | None
    state: str | None
    photo_url: str | None
    committee_name: str
    committee_code: str
    role: str | None
    ticker: str
    company_name: str | None
    sector: str | None
    transaction_type: str
    trade_date: str
    disclosure_date: str
    amount_range_raw: str
    amount_lower: float | None
    amount_upper: float | None
    conflict_reason: str


class ConflictsResponse(BaseModel):
    trades: list[ConflictTrade]
    total: int
    cached: bool


class CommitteeScorecard(BaseModel):
    committee_code: str
    committee_name: str
    chamber: str
    sector: str | None
    total_trades: int
    buy_count: int
    sell_count: int
    member_count: int
    chair_trades: int
    ranking_member_trades: int
    dollar_vol_est: float
    sectors: list[str]


class ConflictsSummaryResponse(BaseModel):
    committees: list[CommitteeScorecard]
    total_flagged_trades: int
    total_members_implicated: int
    total_committees: int
    dollar_vol_est: float
    cached: bool


class HearingEvent(BaseModel):
    committee_code: str
    committee_name: str
    hearing_date: str
    title: str | None
    meeting_type: str | None
    congress: int


class ConflictHearingsResponse(BaseModel):
    hearings: list[HearingEvent]
    total: int
    cached: bool


# ---------------------------------------------------------------------------
# Build valid (committee_code, sector_slug) pairs for the SQL IN filter
# ---------------------------------------------------------------------------

_VALID_PAIRS: list[tuple[str, str]] = [
    (code, sector)
    for code, sectors in COMMITTEE_TO_SECTORS.items()
    for sector in sectors
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _chamber_from_code(code: str) -> str:
    if code.startswith("H"):
        return "House"
    if code.startswith("S"):
        return "Senate"
    return "Joint"


# ---------------------------------------------------------------------------
# GET /conflicts
# ---------------------------------------------------------------------------


@router.get("/conflicts", response_model=ConflictsResponse)
async def get_conflicts(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> ConflictsResponse:
    """Return all trades where the politician sits on an oversight committee
    for the sector of the stock they traded."""

    cached_raw = await redis.get(CACHE_KEY)
    if cached_raw:
        data = json.loads(cached_raw)
        return ConflictsResponse(
            trades=[ConflictTrade(**t) for t in data["trades"]],
            total=data["total"],
            cached=True,
        )

    stmt = (
        select(
            Trade.id.label("trade_id"),
            Trade.ticker,
            Trade.transaction_type,
            Trade.trade_date,
            Trade.disclosure_date,
            Trade.amount_range_raw,
            Trade.amount_lower,
            Trade.amount_upper,
            Politician.id.label("politician_id"),
            Politician.full_name,
            Politician.chamber,
            Politician.party,
            Politician.state,
            Politician.bio_guide_id,
            PoliticianCommittee.committee_name,
            PoliticianCommittee.committee_code,
            PoliticianCommittee.role,
            TickerMeta.sector,
            TickerInfo.company_name,
        )
        .join(PoliticianCommittee, PoliticianCommittee.politician_id == Trade.politician_id)
        .join(TickerMeta, TickerMeta.ticker == Trade.ticker)
        .join(Politician, Politician.id == Trade.politician_id)
        .outerjoin(TickerInfo, TickerInfo.ticker == Trade.ticker)
        .where(
            tuple_(PoliticianCommittee.committee_code, TickerMeta.sector_slug).in_(
                _VALID_PAIRS
            )
        )
        .where(TickerMeta.sector_slug.is_not(None))
        .order_by(Trade.trade_date.desc())
    )

    rows = (await db.execute(stmt)).all()

    trades: list[ConflictTrade] = []
    for row in rows:
        bio_id = row.bio_guide_id
        photo_url = (
            BIOGUIDE_PHOTO_URL.format(letter=bio_id[0].upper(), bio_id=bio_id)
            if bio_id
            else None
        )

        role = row.role
        conflict_reason = (
            f"{role} of {row.committee_name}"
            if role
            else f"Member of {row.committee_name}"
        )

        trades.append(
            ConflictTrade(
                trade_id=str(row.trade_id),
                politician_id=str(row.politician_id),
                full_name=row.full_name,
                chamber=row.chamber,
                party=row.party,
                state=row.state,
                photo_url=photo_url,
                committee_name=row.committee_name,
                committee_code=row.committee_code,
                role=role,
                ticker=row.ticker,
                company_name=row.company_name,
                sector=row.sector,
                transaction_type=row.transaction_type,
                trade_date=str(row.trade_date),
                disclosure_date=str(row.disclosure_date),
                amount_range_raw=row.amount_range_raw or "",
                amount_lower=float(row.amount_lower) if row.amount_lower is not None else None,
                amount_upper=float(row.amount_upper) if row.amount_upper is not None else None,
                conflict_reason=conflict_reason,
            )
        )

    payload = {"trades": [t.model_dump() for t in trades], "total": len(trades)}
    await redis.setex(CACHE_KEY, CACHE_TTL, json.dumps(payload, default=str))

    return ConflictsResponse(trades=trades, total=len(trades), cached=False)


# ---------------------------------------------------------------------------
# GET /conflicts/summary
# ---------------------------------------------------------------------------


@router.get("/conflicts/summary", response_model=ConflictsSummaryResponse)
async def get_conflicts_summary(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> ConflictsSummaryResponse:
    """Return committee-level aggregations for dashboard scorecards."""

    SUMMARY_CACHE_KEY = "conflicts:summary"
    SUMMARY_TTL = 600

    cached_raw = await redis.get(SUMMARY_CACHE_KEY)
    if cached_raw:
        data = json.loads(cached_raw)
        return ConflictsSummaryResponse(
            committees=[CommitteeScorecard(**c) for c in data["committees"]],
            total_flagged_trades=data["total_flagged_trades"],
            total_members_implicated=data["total_members_implicated"],
            total_committees=data["total_committees"],
            dollar_vol_est=data["dollar_vol_est"],
            cached=True,
        )

    # Determine whether a role is Chair-level or Ranking Member-level
    chair_roles = ("Chair", "Chairman", "Chairwoman", "Chairperson")
    ranking_roles = ("Ranking Member",)

    chair_case = case(
        (PoliticianCommittee.role.in_(chair_roles), 1),
        else_=0,
    )
    ranking_case = case(
        (PoliticianCommittee.role.in_(ranking_roles), 1),
        else_=0,
    )

    is_buy = func.lower(Trade.transaction_type).contains("purchase")

    stmt = (
        select(
            PoliticianCommittee.committee_code,
            PoliticianCommittee.committee_name,
            func.count(Trade.id).label("total_trades"),
            func.sum(case((is_buy, 1), else_=0)).label("buy_count"),
            func.sum(case((~is_buy, 1), else_=0)).label("sell_count"),
            func.count(func.distinct(Trade.politician_id)).label("member_count"),
            func.sum(chair_case).label("chair_trades"),
            func.sum(ranking_case).label("ranking_member_trades"),
            func.sum(
                (func.coalesce(Trade.amount_lower, 0) + func.coalesce(Trade.amount_upper, 0)) / 2.0
            ).label("dollar_vol_est"),
        )
        .join(PoliticianCommittee, PoliticianCommittee.politician_id == Trade.politician_id)
        .join(TickerMeta, TickerMeta.ticker == Trade.ticker)
        .where(
            tuple_(PoliticianCommittee.committee_code, TickerMeta.sector_slug).in_(
                _VALID_PAIRS
            )
        )
        .where(TickerMeta.sector_slug.is_not(None))
        .group_by(PoliticianCommittee.committee_code, PoliticianCommittee.committee_name)
        .order_by(func.count(Trade.id).desc())
    )

    rows = (await db.execute(stmt)).all()

    committees: list[CommitteeScorecard] = []
    total_trades = 0
    total_members: set[str] = set()
    total_vol = 0.0

    for row in rows:
        code = row.committee_code
        sectors = COMMITTEE_TO_SECTORS.get(code, [])
        chamber = _chamber_from_code(code)
        vol = float(row.dollar_vol_est or 0)

        committees.append(
            CommitteeScorecard(
                committee_code=code,
                committee_name=row.committee_name,
                chamber=chamber,
                sector=sectors[0] if sectors else None,
                total_trades=int(row.total_trades),
                buy_count=int(row.buy_count or 0),
                sell_count=int(row.sell_count or 0),
                member_count=int(row.member_count or 0),
                chair_trades=int(row.chair_trades or 0),
                ranking_member_trades=int(row.ranking_member_trades or 0),
                dollar_vol_est=vol,
                sectors=sectors,
            )
        )
        total_trades += int(row.total_trades)
        total_vol += vol

    # member_count per committee doesn't give us total unique members across committees
    # — run a separate count query for cross-committee deduplication
    member_stmt = (
        select(func.count(func.distinct(Trade.politician_id)))
        .join(PoliticianCommittee, PoliticianCommittee.politician_id == Trade.politician_id)
        .join(TickerMeta, TickerMeta.ticker == Trade.ticker)
        .where(
            tuple_(PoliticianCommittee.committee_code, TickerMeta.sector_slug).in_(
                _VALID_PAIRS
            )
        )
        .where(TickerMeta.sector_slug.is_not(None))
    )
    total_members_count = (await db.execute(member_stmt)).scalar() or 0

    payload = {
        "committees": [c.model_dump() for c in committees],
        "total_flagged_trades": total_trades,
        "total_members_implicated": int(total_members_count),
        "total_committees": len(committees),
        "dollar_vol_est": total_vol,
    }
    await redis.setex(SUMMARY_CACHE_KEY, SUMMARY_TTL, json.dumps(payload, default=str))

    return ConflictsSummaryResponse(
        committees=committees,
        total_flagged_trades=total_trades,
        total_members_implicated=int(total_members_count),
        total_committees=len(committees),
        dollar_vol_est=total_vol,
        cached=False,
    )


# ---------------------------------------------------------------------------
# GET /conflicts/hearings
# ---------------------------------------------------------------------------


@router.get("/conflicts/hearings", response_model=ConflictHearingsResponse)
async def get_conflicts_hearings(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> ConflictHearingsResponse:
    """Return all committee hearing dates for the timeline."""

    HEARINGS_CACHE_KEY = "conflicts:hearings"
    HEARINGS_TTL = 3600

    cached_raw = await redis.get(HEARINGS_CACHE_KEY)
    if cached_raw:
        data = json.loads(cached_raw)
        return ConflictHearingsResponse(
            hearings=[HearingEvent(**h) for h in data["hearings"]],
            total=data["total"],
            cached=True,
        )

    stmt = select(CommitteeHearing).order_by(CommitteeHearing.hearing_date.desc())
    rows = (await db.execute(stmt)).scalars().all()

    hearings: list[HearingEvent] = [
        HearingEvent(
            committee_code=row.committee_code,
            committee_name=row.committee_name,
            hearing_date=str(row.hearing_date),
            title=row.title,
            meeting_type=row.meeting_type,
            congress=row.congress,
        )
        for row in rows
    ]

    payload = {"hearings": [h.model_dump() for h in hearings], "total": len(hearings)}
    await redis.setex(HEARINGS_CACHE_KEY, HEARINGS_TTL, json.dumps(payload, default=str))

    return ConflictHearingsResponse(hearings=hearings, total=len(hearings), cached=False)
