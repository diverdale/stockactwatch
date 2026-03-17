"""User watchlist — follow politicians and tickers.

All endpoints expect X-User-Id header containing the Clerk user ID.
The Next.js API routes inject this server-side after validating the Clerk session.
"""
from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import case, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.user_watchlist import UserWatchlist

BIOGUIDE_PHOTO_URL = "https://bioguide.congress.gov/bioguide/photo/{letter}/{bio_id}.jpg"

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


class EnrichedPolitician(BaseModel):
    ref_id: str
    name: str
    party: str | None
    chamber: str | None
    state: str | None
    photo_url: str | None
    total_trades: int
    recent_trades: int
    last_trade_date: date | None
    buy_pct: int | None

class EnrichedTicker(BaseModel):
    ref_id: str
    name: str | None
    sector: str | None
    sector_slug: str | None
    recent_trades: int
    last_trade_date: date | None
    buy_pct: int | None

class EnrichedWatchlist(BaseModel):
    politicians: list[EnrichedPolitician]
    tickers: list[EnrichedTicker]


@router.get("/enriched", response_model=EnrichedWatchlist)
async def get_enriched_watchlist(
    user_id: str = Depends(_require_user),
    db: AsyncSession = Depends(get_db),
) -> EnrichedWatchlist:
    """Return watchlist with trade stats, photos, and sentiment."""
    import uuid as _uuid
    from app.models.politician import Politician
    from app.models.ticker_info import TickerInfo
    from app.models.ticker_meta import TickerMeta
    from app.models.trade import Trade

    rows = (
        await db.execute(
            select(UserWatchlist)
            .where(UserWatchlist.user_id == user_id)
            .order_by(UserWatchlist.created_at.desc())
        )
    ).scalars().all()

    pol_ids = [_uuid.UUID(r.ref_id) for r in rows if r.type == "politician"]
    ticker_ids = [r.ref_id for r in rows if r.type == "ticker"]
    since = date.today() - timedelta(days=30)

    # ── Politicians ──────────────────────────────────────────────────────────
    politicians: list[EnrichedPolitician] = []
    if pol_ids:
        trade_stats = {
            row.politician_id: row
            for row in (await db.execute(
                select(
                    Trade.politician_id,
                    func.count(Trade.id).label("total_trades"),
                    func.count(Trade.id).filter(Trade.trade_date >= since).label("recent_trades"),
                    func.max(Trade.trade_date).label("last_trade_date"),
                    func.round(
                        func.count(Trade.id).filter(Trade.transaction_type == "Purchase") * 100.0
                        / func.nullif(func.count(Trade.id), 0)
                    ).label("buy_pct"),
                )
                .where(Trade.politician_id.in_(pol_ids))
                .group_by(Trade.politician_id)
            )).all()
        }
        for pol_id in pol_ids:
            pol = await db.get(Politician, pol_id)
            if not pol:
                continue
            stats = trade_stats.get(pol_id)
            photo_url = (
                BIOGUIDE_PHOTO_URL.format(letter=pol.bio_guide_id[0].upper(), bio_id=pol.bio_guide_id)
                if pol.bio_guide_id else None
            )
            politicians.append(EnrichedPolitician(
                ref_id=str(pol_id),
                name=pol.full_name,
                party=pol.party,
                chamber=pol.chamber,
                state=pol.state,
                photo_url=photo_url,
                total_trades=stats.total_trades if stats else 0,
                recent_trades=stats.recent_trades if stats else 0,
                last_trade_date=stats.last_trade_date if stats else None,
                buy_pct=int(stats.buy_pct) if stats and stats.buy_pct is not None else None,
            ))

    # ── Tickers ──────────────────────────────────────────────────────────────
    tickers: list[EnrichedTicker] = []
    if ticker_ids:
        ticker_stats = {
            row.ticker: row
            for row in (await db.execute(
                select(
                    Trade.ticker,
                    func.count(Trade.id).filter(Trade.trade_date >= since).label("recent_trades"),
                    func.max(Trade.trade_date).label("last_trade_date"),
                    func.round(
                        func.count(Trade.id).filter(Trade.transaction_type == "Purchase") * 100.0
                        / func.nullif(func.count(Trade.id), 0)
                    ).label("buy_pct"),
                )
                .where(Trade.ticker.in_(ticker_ids))
                .group_by(Trade.ticker)
            )).all()
        }
        for ticker in ticker_ids:
            info = await db.get(TickerInfo, ticker)
            meta = await db.get(TickerMeta, ticker)
            stats = ticker_stats.get(ticker)
            tickers.append(EnrichedTicker(
                ref_id=ticker,
                name=info.company_name if info else ticker,
                sector=meta.sector if meta else None,
                sector_slug=meta.sector_slug if meta else None,
                recent_trades=stats.recent_trades if stats else 0,
                last_trade_date=stats.last_trade_date if stats else None,
                buy_pct=int(stats.buy_pct) if stats and stats.buy_pct is not None else None,
            ))

    return EnrichedWatchlist(politicians=politicians, tickers=tickers)


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
