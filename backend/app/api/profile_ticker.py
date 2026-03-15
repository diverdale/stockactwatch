"""GET /politicians/{politician_id} and GET /tickers/{ticker} endpoints."""
import json
import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from redis.asyncio import Redis
from sqlalchemy import case, func, literal_column, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache import get_redis
from app.db import get_db
from app.models.computed_return import ComputedReturn
from app.models.politician import Politician
from app.models.ticker_info import TickerInfo
from app.models.ticker_meta import TickerMeta
from app.models.trade import Trade
from app.schemas.feed import PoliticianProfile, TickerTradeEntry, TickerTrades, TradeEntry
from app.services.suspicion import score_politician_trades

router = APIRouter(tags=["profiles", "tickers"])


class PoliticianSectorEntry(BaseModel):
    sector: str
    sector_slug: str
    trade_count: int


class PoliticianSectorsResponse(BaseModel):
    politician_id: str
    sectors: list[PoliticianSectorEntry]
    cached: bool


class PoliticianListEntry(BaseModel):
    politician_id: str
    full_name: str
    chamber: str | None
    party: str | None
    state: str | None
    photo_url: str | None
    trade_count: int
    buy_count: int
    sell_count: int

class PoliticianListResponse(BaseModel):
    politicians: list[PoliticianListEntry]
    total: int
    cached: bool

BIOGUIDE_PHOTO_URL = "https://bioguide.congress.gov/bioguide/photo/{letter}/{bio_id}.jpg"


@router.get("/politicians", response_model=PoliticianListResponse)
async def get_politicians_list(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> PoliticianListResponse:
    cache_key = "politicians:list"
    cached_raw = await redis.get(cache_key)
    if cached_raw:
        data = json.loads(cached_raw)
        return PoliticianListResponse(
            politicians=[PoliticianListEntry(**p) for p in data["politicians"]],
            total=data["total"],
            cached=True,
        )

    from sqlalchemy import case as sa_case
    stmt = (
        select(
            Politician.id,
            Politician.full_name,
            Politician.chamber,
            Politician.party,
            Politician.state,
            Politician.bio_guide_id,
            func.count(Trade.id).label("trade_count"),
            func.count(sa_case((Trade.transaction_type.ilike("%purchase%"), Trade.id))).label("buy_count"),
            func.count(sa_case((Trade.transaction_type.ilike("%sale%"), Trade.id))).label("sell_count"),
        )
        .join(Trade, Trade.politician_id == Politician.id)
        .group_by(Politician.id, Politician.full_name, Politician.chamber, Politician.party, Politician.state, Politician.bio_guide_id)
        .order_by(func.count(Trade.id).desc())
    )
    rows = (await db.execute(stmt)).all()

    politicians = [
        PoliticianListEntry(
            politician_id=str(row.id),
            full_name=row.full_name,
            chamber=row.chamber,
            party=row.party,
            state=row.state,
            photo_url=(
                BIOGUIDE_PHOTO_URL.format(letter=row.bio_guide_id[0].upper(), bio_id=row.bio_guide_id)
                if row.bio_guide_id else None
            ),
            trade_count=row.trade_count,
            buy_count=row.buy_count,
            sell_count=row.sell_count,
        )
        for row in rows
    ]
    payload = {"politicians": [p.model_dump() for p in politicians], "total": len(politicians)}
    await redis.setex(cache_key, 600, json.dumps(payload, default=str))
    return PoliticianListResponse(politicians=politicians, total=len(politicians), cached=False)


@router.get("/politicians/{politician_id}", response_model=PoliticianProfile)
async def get_politician_profile(
    politician_id: str,
    db: AsyncSession = Depends(get_db),
) -> PoliticianProfile:
    # Validate UUID format
    try:
        pol_uuid = uuid.UUID(politician_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid politician_id: must be a valid UUID")

    politician = await db.get(Politician, pol_uuid)
    if politician is None:
        raise HTTPException(status_code=404, detail="Politician not found")

    # Fetch trades with computed return if available
    stmt = (
        select(Trade, ComputedReturn)
        .outerjoin(ComputedReturn, ComputedReturn.trade_id == Trade.id)
        .where(Trade.politician_id == politician.id)
        .order_by(Trade.trade_date.desc())
    )
    rows = (await db.execute(stmt)).all()

    # Compute suspicion scores for all trades
    suspicion_data: dict[str, tuple[int, str]] = {}
    try:
        scores = await score_politician_trades(politician_id, db)
        suspicion_data = {tid: (score, __import__('json').dumps(flags)) for tid, score, flags in scores}
    except Exception:
        pass  # suspicion scoring is non-critical

    trade_entries = [
        TradeEntry(
            trade_id=str(row[0].id),
            ticker=row[0].ticker,
            asset_type=row[0].asset_type,
            transaction_type=row[0].transaction_type,
            trade_date=row[0].trade_date,
            disclosure_date=row[0].disclosure_date,
            amount_range_raw=row[0].amount_range_raw,
            amount_lower=row[0].amount_lower,
            amount_upper=row[0].amount_upper,
            return_calculable=row[0].return_calculable,
            avg_return_pct=row[1].return_pct if row[1] else None,
            suspicion_score=suspicion_data.get(str(row[0].id), (None, None))[0],
            suspicion_flags=suspicion_data.get(str(row[0].id), (None, None))[1],
        )
        for row in rows
    ]

    bio_id = politician.bio_guide_id
    photo_url = (
        BIOGUIDE_PHOTO_URL.format(letter=bio_id[0].upper(), bio_id=bio_id)
        if bio_id else None
    )

    return PoliticianProfile(
        politician_id=str(politician.id),
        full_name=politician.full_name,
        chamber=politician.chamber,
        party=politician.party,
        state=politician.state,
        district=politician.district,
        bio_guide_id=bio_id,
        photo_url=photo_url,
        total_trades=len(rows),
        trades=trade_entries,
    )


class TickerListEntry(BaseModel):
    ticker: str
    company_name: str | None
    sector: str | None
    sector_slug: str | None
    asset_types: list[str]
    total_trades: int
    buy_count: int
    sell_count: int
    member_count: int
    last_trade_date: str | None
    amount_vol_est: float | None
    sparkline: list[int]


class TickerListResponse(BaseModel):
    tickers: list[TickerListEntry]
    total_tickers: int
    total_trades: int
    total_members: int
    dollar_vol_est: float
    cached: bool


@router.get("/tickers", response_model=TickerListResponse)
async def get_tickers_list(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> TickerListResponse:
    cache_key = "tickers:list"
    cached_raw = await redis.get(cache_key)
    if cached_raw:
        data = json.loads(cached_raw)
        return TickerListResponse(
            tickers=[TickerListEntry(**t) for t in data["tickers"]],
            total_tickers=data["total_tickers"],
            total_trades=data["total_trades"],
            total_members=data["total_members"],
            dollar_vol_est=data["dollar_vol_est"],
            cached=True,
        )

    # ── 1. Main aggregation query ──────────────────────────────────────────
    stmt = (
        select(
            Trade.ticker,
            TickerInfo.company_name,
            TickerMeta.sector,
            TickerMeta.sector_slug,
            func.count(Trade.id).label("total_trades"),
            func.count(
                case((Trade.transaction_type.ilike("%purchase%"), Trade.id))
            ).label("buy_count"),
            func.count(
                case((Trade.transaction_type.ilike("%sale%"), Trade.id))
            ).label("sell_count"),
            func.count(func.distinct(Trade.politician_id)).label("member_count"),
            func.max(Trade.trade_date).label("last_trade_date"),
            func.sum(
                (func.coalesce(Trade.amount_lower, 0) + func.coalesce(Trade.amount_upper, 0)) / 2.0
            ).label("amount_vol_est"),
        )
        .outerjoin(TickerInfo, TickerInfo.ticker == Trade.ticker)
        .outerjoin(TickerMeta, TickerMeta.ticker == Trade.ticker)
        .group_by(Trade.ticker, TickerInfo.company_name, TickerMeta.sector, TickerMeta.sector_slug)
        .order_by(func.count(Trade.id).desc())
    )
    rows = (await db.execute(stmt)).all()

    # ── 2. Asset types per ticker (separate query) ─────────────────────────
    asset_stmt = (
        select(Trade.ticker, Trade.asset_type)
        .distinct()
    )
    asset_rows = (await db.execute(asset_stmt)).all()
    asset_types_map: dict[str, list[str]] = {}
    for ar in asset_rows:
        asset_types_map.setdefault(ar.ticker, []).append(ar.asset_type)

    # ── 3. Sparkline: monthly trade counts for last 12 months ─────────────
    today = date.today()
    # Build list of 12 month start dates, oldest first
    months: list[date] = []
    for i in range(11, -1, -1):
        # First day of month i months ago
        target = today.replace(day=1) - timedelta(days=1)  # last day of prev month
        # Roll back i months from current month
        year = today.year
        month = today.month - i
        while month <= 0:
            month += 12
            year -= 1
        months.append(date(year, month, 1))

    sparkline_stmt = (
        select(
            Trade.ticker,
            func.date_trunc(literal_column("'month'"), Trade.trade_date).label("month"),
            func.count(Trade.id).label("cnt"),
        )
        .where(Trade.trade_date >= months[0])
        .group_by(Trade.ticker, func.date_trunc(literal_column("'month'"), Trade.trade_date))
    )
    spark_rows = (await db.execute(sparkline_stmt)).all()

    # Build dict: ticker -> {month_date: count}
    spark_map: dict[str, dict[date, int]] = {}
    for sr in spark_rows:
        month_key = sr.month.date() if hasattr(sr.month, "date") else sr.month
        spark_map.setdefault(sr.ticker, {})[month_key] = sr.cnt

    # ── 4. Build response ──────────────────────────────────────────────────
    tickers: list[TickerListEntry] = []
    total_trades_sum = 0
    total_vol_sum = 0.0
    all_members: set = set()

    for row in rows:
        total_trades_sum += row.total_trades

        vol = float(row.amount_vol_est) if row.amount_vol_est is not None else 0.0
        total_vol_sum += vol

        # Build 12-slot sparkline
        ticker_spark = spark_map.get(row.ticker, {})
        sparkline = [ticker_spark.get(m, 0) for m in months]

        last_date_str = str(row.last_trade_date) if row.last_trade_date else None

        tickers.append(
            TickerListEntry(
                ticker=row.ticker,
                company_name=row.company_name,
                sector=row.sector,
                sector_slug=row.sector_slug,
                asset_types=asset_types_map.get(row.ticker, []),
                total_trades=row.total_trades,
                buy_count=row.buy_count,
                sell_count=row.sell_count,
                member_count=row.member_count,
                last_trade_date=last_date_str,
                amount_vol_est=vol if vol > 0 else None,
                sparkline=sparkline,
            )
        )

    # total_members: distinct politicians across ALL tickers
    members_stmt = select(func.count(func.distinct(Trade.politician_id)))
    total_members_result = (await db.execute(members_stmt)).scalar_one()

    payload = {
        "tickers": [t.model_dump() for t in tickers],
        "total_tickers": len(tickers),
        "total_trades": total_trades_sum,
        "total_members": total_members_result,
        "dollar_vol_est": total_vol_sum,
    }
    await redis.setex(cache_key, 600, json.dumps(payload, default=str))

    return TickerListResponse(
        tickers=tickers,
        total_tickers=len(tickers),
        total_trades=total_trades_sum,
        total_members=total_members_result,
        dollar_vol_est=total_vol_sum,
        cached=False,
    )


@router.get("/tickers/{ticker}", response_model=TickerTrades)
async def get_ticker_trades(
    ticker: str,
    db: AsyncSession = Depends(get_db),
) -> TickerTrades:
    ticker_upper = ticker.upper()

    stmt = (
        select(Trade, Politician)
        .join(Politician, Trade.politician_id == Politician.id)
        .where(Trade.ticker == ticker_upper)
        .order_by(Trade.trade_date.desc())
    )
    rows = (await db.execute(stmt)).all()

    ticker_info = await db.get(TickerInfo, ticker_upper)
    company_name = ticker_info.company_name if ticker_info else None

    entries = [
        TickerTradeEntry(
            trade_id=str(trade.id),
            politician_id=str(trade.politician_id),
            full_name=pol.full_name,
            chamber=pol.chamber,
            party=pol.party,
            transaction_type=trade.transaction_type,
            trade_date=trade.trade_date,
            disclosure_date=trade.disclosure_date,
            amount_range_raw=trade.amount_range_raw,
            amount_lower=trade.amount_lower,
            amount_upper=trade.amount_upper,
        )
        for trade, pol in rows
    ]

    return TickerTrades(ticker=ticker_upper, company_name=company_name, total_trades=len(rows), trades=entries)


@router.get("/politicians/{politician_id}/sectors", response_model=PoliticianSectorsResponse)
async def get_politician_sectors(
    politician_id: str,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> PoliticianSectorsResponse:
    cache_key = f"politician:sectors:{politician_id}"
    cached_raw = await redis.get(cache_key)
    if cached_raw:
        data = json.loads(cached_raw)
        return PoliticianSectorsResponse(**data, cached=True)

    stmt = (
        select(
            TickerMeta.sector,
            TickerMeta.sector_slug,
            func.count(Trade.id).label("trade_count"),
        )
        .join(Trade, Trade.ticker == TickerMeta.ticker)
        .where(Trade.politician_id == politician_id)
        .where(TickerMeta.sector.is_not(None))
        .group_by(TickerMeta.sector, TickerMeta.sector_slug)
        .order_by(func.count(Trade.id).desc())
        .limit(8)
    )
    rows = (await db.execute(stmt)).all()

    # Return 200 with empty list if politician exists but has no sector data
    # (404 is reserved for unknown politician_id — we don't validate existence here
    #  since profile endpoint already handles that)
    sectors = [
        PoliticianSectorEntry(
            sector=row.sector,
            sector_slug=row.sector_slug,
            trade_count=row.trade_count,
        )
        for row in rows
    ]
    payload = {"politician_id": politician_id, "sectors": [s.model_dump() for s in sectors]}
    await redis.setex(cache_key, 600, json.dumps(payload, default=str))
    return PoliticianSectorsResponse(politician_id=politician_id, sectors=sectors, cached=False)
