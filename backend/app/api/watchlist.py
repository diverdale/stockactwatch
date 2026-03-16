"""User watchlist — follow politicians and tickers.

All endpoints expect X-User-Id header containing the Clerk user ID.
The Next.js API routes inject this server-side after validating the Clerk session.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.user_watchlist import UserWatchlist

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


def _require_user(x_user_id: str = Header(...)) -> str:
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return x_user_id


class WatchlistItem(BaseModel):
    type: str   # "politician" | "ticker"
    ref_id: str


class WatchlistEntry(BaseModel):
    type: str
    ref_id: str
    name: str | None = None
    party: str | None = None
    chamber: str | None = None
    created_at: str | None = None


@router.get("", response_model=list[WatchlistEntry])
async def get_watchlist(
    user_id: str = Depends(_require_user),
    db: AsyncSession = Depends(get_db),
) -> list[WatchlistEntry]:
    """Return the user's full watchlist with enriched labels."""
    from app.models.politician import Politician
    from app.models.ticker_info import TickerInfo

    rows = (
        await db.execute(
            select(UserWatchlist)
            .where(UserWatchlist.user_id == user_id)
            .order_by(UserWatchlist.created_at.desc())
        )
    ).scalars().all()

    entries: list[WatchlistEntry] = []
    for row in rows:
        if row.type == "politician":
            try:
                import uuid as _uuid
                pol = await db.get(Politician, _uuid.UUID(row.ref_id))
                entries.append(WatchlistEntry(
                    type=row.type,
                    ref_id=row.ref_id,
                    name=pol.full_name if pol else row.ref_id,
                    party=pol.party if pol else None,
                    chamber=pol.chamber if pol else None,
                    created_at=row.created_at.isoformat() if row.created_at else None,
                ))
            except Exception:
                entries.append(WatchlistEntry(type=row.type, ref_id=row.ref_id))
        elif row.type == "ticker":
            ticker_info = await db.get(TickerInfo, row.ref_id)
            entries.append(WatchlistEntry(
                type=row.type,
                ref_id=row.ref_id,
                name=ticker_info.company_name if ticker_info else row.ref_id,
                created_at=row.created_at.isoformat() if row.created_at else None,
            ))

    return entries


@router.post("", status_code=201)
async def follow(
    item: WatchlistItem,
    user_id: str = Depends(_require_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Add a politician or ticker to the user's watchlist."""
    if item.type not in ("politician", "ticker"):
        raise HTTPException(status_code=400, detail="type must be 'politician' or 'ticker'")

    stmt = (
        insert(UserWatchlist)
        .values(user_id=user_id, type=item.type, ref_id=item.ref_id)
        .on_conflict_do_nothing(constraint="uq_user_watchlist")
    )
    await db.execute(stmt)
    await db.commit()
    return {"status": "ok"}


@router.delete("/{type}/{ref_id}", status_code=200)
async def unfollow(
    type: str,
    ref_id: str,
    user_id: str = Depends(_require_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Remove a politician or ticker from the user's watchlist."""
    row = (
        await db.execute(
            select(UserWatchlist).where(
                UserWatchlist.user_id == user_id,
                UserWatchlist.type == type,
                UserWatchlist.ref_id == ref_id,
            )
        )
    ).scalar_one_or_none()

    if row:
        await db.delete(row)
        await db.commit()
    return {"status": "ok"}


@router.get("/check/{type}/{ref_id}")
async def check_following(
    type: str,
    ref_id: str,
    user_id: str = Depends(_require_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Check whether the user is following a specific politician or ticker."""
    row = (
        await db.execute(
            select(UserWatchlist).where(
                UserWatchlist.user_id == user_id,
                UserWatchlist.type == type,
                UserWatchlist.ref_id == ref_id,
            )
        )
    ).scalar_one_or_none()
    return {"following": row is not None}
