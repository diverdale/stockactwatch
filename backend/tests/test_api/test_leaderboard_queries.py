"""
Unit tests for query_returns_leaderboard and query_volume_leaderboard.

Uses SQLite in-memory with test-specific ORM-mapped classes (SQLite-safe String
columns) to avoid postgresql.UUID dialect incompatibility.

Tests cover: basic ordering, NULL filter, limit, chamber filter, period filter (ytd),
and cache-key collision avoidance.
"""
from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.api.leaderboard import (
    query_returns_leaderboard,
    query_volume_leaderboard,
    returns_cache_key,
    volume_cache_key,
)

# ---------------------------------------------------------------------------
# Test-specific ORM-mapped classes using SQLite-compatible types
# ---------------------------------------------------------------------------


class TestBase(DeclarativeBase):
    pass


class TestPolitician(TestBase):
    __tablename__ = "politicians"

    id: Mapped[str] = mapped_column(sa.String, primary_key=True)
    external_id: Mapped[str] = mapped_column(sa.String, unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(sa.String, nullable=False)
    party: Mapped[str | None] = mapped_column(sa.String, nullable=True)
    chamber: Mapped[str | None] = mapped_column(sa.String, nullable=True)
    state: Mapped[str | None] = mapped_column(sa.String(2), nullable=True)
    active: Mapped[bool] = mapped_column(sa.Boolean, default=True)
    created_at: Mapped[str] = mapped_column(sa.String, nullable=True)
    updated_at: Mapped[str] = mapped_column(sa.String, nullable=True)


class TestTrade(TestBase):
    __tablename__ = "trades"

    id: Mapped[str] = mapped_column(sa.String, primary_key=True)
    external_id: Mapped[str] = mapped_column(sa.String, unique=True, nullable=False)
    politician_id: Mapped[str] = mapped_column(
        sa.String, sa.ForeignKey("politicians.id"), nullable=False
    )
    ticker: Mapped[str] = mapped_column(sa.String(10), nullable=False)
    asset_type: Mapped[str] = mapped_column(sa.String, nullable=False)
    asset_description: Mapped[str | None] = mapped_column(sa.String, nullable=True)
    transaction_type: Mapped[str] = mapped_column(sa.String, nullable=False)
    trade_date: Mapped[object] = mapped_column(sa.Date, nullable=False)
    disclosure_date: Mapped[object] = mapped_column(sa.Date, nullable=False)
    amount_range_raw: Mapped[str | None] = mapped_column(sa.String, nullable=True)
    amount_lower: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    amount_upper: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    owner: Mapped[str] = mapped_column(sa.String, nullable=False, default="Self")
    amendment_version: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=0)
    return_calculable: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, default=True)
    source: Mapped[str] = mapped_column(sa.String, nullable=False)
    created_at: Mapped[str] = mapped_column(sa.String, nullable=True)
    updated_at: Mapped[str] = mapped_column(sa.String, nullable=True)


class TestComputedReturn(TestBase):
    __tablename__ = "computed_returns"

    id: Mapped[str] = mapped_column(sa.String, primary_key=True)
    trade_id: Mapped[str] = mapped_column(
        sa.String, sa.ForeignKey("trades.id"), unique=True, nullable=False
    )
    politician_id: Mapped[str] = mapped_column(
        sa.String, sa.ForeignKey("politicians.id"), nullable=False
    )
    ticker: Mapped[str] = mapped_column(sa.String(10), nullable=False)
    trade_date: Mapped[object] = mapped_column(sa.Date, nullable=False)
    price_at_trade: Mapped[object] = mapped_column(sa.Numeric(12, 4), nullable=True)
    price_current: Mapped[object] = mapped_column(sa.Numeric(12, 4), nullable=True)
    return_pct: Mapped[object] = mapped_column(sa.Numeric(10, 4), nullable=True)
    return_dollar_est: Mapped[object] = mapped_column(sa.Numeric(14, 2), nullable=True)
    sp500_return_pct: Mapped[object] = mapped_column(sa.Numeric(10, 4), nullable=True)
    methodology_ver: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=1)
    computed_at: Mapped[str] = mapped_column(sa.String, nullable=True)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
async def async_session():
    """Async SQLite in-memory engine with test tables."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(TestBase.metadata.create_all)

    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session

    await engine.dispose()


def _pol_id() -> str:
    return str(uuid.uuid4())


def _trade_id() -> str:
    return str(uuid.uuid4())


def _cr_id() -> str:
    return str(uuid.uuid4())


async def _seed_politician(
    session: AsyncSession,
    *,
    pol_id: str | None = None,
    full_name: str = "Test Politician",
    chamber: str | None = None,
    party: str | None = None,
) -> str:
    pid = pol_id or _pol_id()
    pol = TestPolitician(
        id=pid,
        external_id=f"test:{pid}",
        full_name=full_name,
        chamber=chamber,
        party=party,
    )
    session.add(pol)
    await session.flush()
    return pid


async def _seed_trade(
    session: AsyncSession,
    politician_id: str,
    *,
    trade_date: date = date(2025, 6, 1),
) -> str:
    tid = _trade_id()
    trade = TestTrade(
        id=tid,
        external_id=f"test:{tid}",
        politician_id=politician_id,
        ticker="AAPL",
        asset_type="equity",
        transaction_type="purchase",
        trade_date=trade_date,
        disclosure_date=trade_date,
        return_calculable=True,
        source="quiver",
    )
    session.add(trade)
    await session.flush()
    return tid


async def _seed_computed_return(
    session: AsyncSession,
    politician_id: str,
    trade_id: str,
    *,
    return_pct: Decimal | None = Decimal("10.00"),
) -> str:
    crid = _cr_id()
    cr = TestComputedReturn(
        id=crid,
        trade_id=trade_id,
        politician_id=politician_id,
        ticker="AAPL",
        trade_date=date(2025, 6, 1),
        return_pct=return_pct,
        methodology_ver=1,
    )
    session.add(cr)
    await session.flush()
    return crid


# ---------------------------------------------------------------------------
# Monkey-patch: redirect query functions to use TestBase models
# ---------------------------------------------------------------------------
# The query functions import Politician, Trade, ComputedReturn from app.models.*
# which use postgresql.UUID. We patch them here to use the SQLite-safe test models.

import app.api.leaderboard as _leaderboard_module
from app.models.computed_return import ComputedReturn as _OrigComputedReturn
from app.models.politician import Politician as _OrigPolitician
from app.models.trade import Trade as _OrigTrade


@pytest.fixture(autouse=True)
def patch_orm_models(monkeypatch):
    """Redirect ORM references in leaderboard module to SQLite-safe test models."""
    monkeypatch.setattr(_leaderboard_module, "Politician", TestPolitician)
    monkeypatch.setattr(_leaderboard_module, "Trade", TestTrade)
    monkeypatch.setattr(_leaderboard_module, "ComputedReturn", TestComputedReturn)
    yield
    # monkeypatch auto-restores on teardown


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_returns_leaderboard_basic(async_session):
    """Two politicians with computed returns — result has 2 rows ordered by avg desc."""
    pol1 = await _seed_politician(async_session, full_name="Alice")
    pol2 = await _seed_politician(async_session, full_name="Bob")

    t1 = await _seed_trade(async_session, pol1)
    t2 = await _seed_trade(async_session, pol2)

    await _seed_computed_return(async_session, pol1, t1, return_pct=Decimal("20.00"))
    await _seed_computed_return(async_session, pol2, t2, return_pct=Decimal("5.00"))
    await async_session.commit()

    rows = await query_returns_leaderboard(async_session, limit=20)

    assert len(rows) == 2
    assert all(row.avg_return_pct is not None for row in rows)
    # Ordered by avg desc — Alice (20%) first
    assert str(rows[0].id) == pol1
    assert str(rows[1].id) == pol2


async def test_returns_leaderboard_excludes_null_return_pct(async_session):
    """Politician with only NULL return_pct entries does NOT appear in results."""
    pol_real = await _seed_politician(async_session, full_name="Real Gains")
    pol_null = await _seed_politician(async_session, full_name="No Data")

    t1 = await _seed_trade(async_session, pol_real)
    t2 = await _seed_trade(async_session, pol_null)

    await _seed_computed_return(async_session, pol_real, t1, return_pct=Decimal("15.00"))
    await _seed_computed_return(async_session, pol_null, t2, return_pct=None)
    await async_session.commit()

    rows = await query_returns_leaderboard(async_session, limit=20)

    ids = [str(r.id) for r in rows]
    assert pol_null not in ids, "Politician with NULL return_pct must be excluded"
    assert pol_real in ids


async def test_returns_leaderboard_limit(async_session):
    """Inserting 5 politicians with returns, limit=2 returns exactly 2 rows."""
    for i in range(5):
        pid = await _seed_politician(async_session, full_name=f"Pol {i}")
        tid = await _seed_trade(async_session, pid)
        await _seed_computed_return(
            async_session, pid, tid, return_pct=Decimal(str(i * 5))
        )
    await async_session.commit()

    rows = await query_returns_leaderboard(async_session, limit=2)
    assert len(rows) == 2


async def test_volume_leaderboard_basic(async_session):
    """Two politicians with trades — volume leaderboard returns correct trade counts."""
    pol1 = await _seed_politician(async_session, full_name="Heavy Trader")
    pol2 = await _seed_politician(async_session, full_name="Light Trader")

    # pol1 gets 3 trades, pol2 gets 1
    for _ in range(3):
        await _seed_trade(async_session, pol1)
    await _seed_trade(async_session, pol2)
    await async_session.commit()

    rows = await query_volume_leaderboard(async_session, None, None, "all", limit=20)

    assert len(rows) == 2
    counts = {str(r.id): r.trade_count for r in rows}
    assert counts[pol1] == 3
    assert counts[pol2] == 1
    # Ordered by trade_count desc
    assert str(rows[0].id) == pol1


async def test_volume_leaderboard_chamber_filter(async_session):
    """Filter by chamber=House returns only House politicians."""
    pol_house = await _seed_politician(async_session, full_name="House Rep", chamber="House")
    pol_senate = await _seed_politician(async_session, full_name="Senator", chamber="Senate")

    await _seed_trade(async_session, pol_house)
    await _seed_trade(async_session, pol_senate)
    await async_session.commit()

    rows = await query_volume_leaderboard(async_session, "House", None, "all", limit=20)

    ids = [str(r.id) for r in rows]
    assert pol_house in ids
    assert pol_senate not in ids


async def test_volume_leaderboard_period_filter_ytd(async_session):
    """YTD filter counts only trades from Jan 1 of current year onward."""
    from datetime import date as _date

    today = _date.today()
    current_year_date = _date(today.year, 2, 1)
    prior_year_date = _date(today.year - 1, 6, 1)

    pol = await _seed_politician(async_session, full_name="Active Trader")

    # One trade in current year, one in prior year
    await _seed_trade(async_session, pol, trade_date=current_year_date)
    await _seed_trade(async_session, pol, trade_date=prior_year_date)
    await async_session.commit()

    rows = await query_volume_leaderboard(async_session, None, None, "ytd", limit=20)

    assert len(rows) == 1
    assert rows[0].trade_count == 1, (
        f"YTD filter should count 1 trade (current year only), got {rows[0].trade_count}"
    )


async def test_cache_key_no_collision(async_session):
    """Different argument orderings for chamber vs party produce distinct cache keys."""
    key1 = volume_cache_key(None, "Democrat", "all", 20)
    key2 = volume_cache_key("Democrat", None, "all", 20)
    assert key1 != key2, (
        f"Cache keys must differ when chamber and party are swapped: {key1!r} == {key2!r}"
    )
