"""
Tests for compute_returns_for_trade() in app.ingestion.pipeline.

Cases 1-4 from Plan 01-04 TDD spec.

Uses an in-memory SQLite async session so that real upsert conflict logic is exercised
(not mocked ORM calls).
"""
from __future__ import annotations

import json
import uuid
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.ingestion.pipeline import compute_returns_for_trade
from app.models.base import Base
from app.models.computed_return import ComputedReturn
from app.models.politician import Politician
from app.models.price_snapshot import PriceSnapshot
from app.models.trade import Trade

# ---------------------------------------------------------------------------
# In-memory SQLite fixtures
# ---------------------------------------------------------------------------

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"


@pytest.fixture()
async def async_session():
    """Async SQLite in-memory engine with all tables created."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session

    await engine.dispose()


async def _seed_politician(session: AsyncSession) -> uuid.UUID:
    pol = Politician(
        external_id="quiver:test politician",
        full_name="Test Politician",
    )
    session.add(pol)
    await session.flush()
    return pol.id


async def _seed_trade(
    session: AsyncSession,
    politician_id: uuid.UUID,
    *,
    asset_type: str,
    ticker: str = "AAPL",
    trade_date: date = date(2024, 1, 15),
    disclosure_date: date = date(2024, 2, 1),
    amount_lower: int = 15001,
    amount_upper: int = 50000,
    external_id: str | None = None,
) -> uuid.UUID:
    trade = Trade(
        external_id=external_id or f"test:{uuid.uuid4()}",
        politician_id=politician_id,
        ticker=ticker,
        asset_type=asset_type,
        transaction_type="purchase",
        trade_date=trade_date,
        disclosure_date=disclosure_date,
        amount_lower=amount_lower,
        amount_upper=amount_upper,
        return_calculable=(asset_type == "equity"),
        source="quiver",
    )
    session.add(trade)
    await session.flush()
    return trade.id


async def _seed_price_snapshots(session: AsyncSession) -> None:
    fixture_path = FIXTURES_DIR / "price_snapshots.json"
    snapshots = json.loads(fixture_path.read_text())
    for s in snapshots:
        snap = PriceSnapshot(
            ticker=s["ticker"],
            snapshot_date=date.fromisoformat(s["snapshot_date"]),
            close_price=Decimal(str(s["close_price"])),
            source=s["source"],
        )
        session.add(snap)
    await session.flush()


# ---------------------------------------------------------------------------
# Case 1 — Options exclusion (LEGAL-02)
# ---------------------------------------------------------------------------

async def test_options_exclusion_no_row_created(async_session):
    """compute_returns_for_trade returns None and creates no DB row for options."""
    pol_id = await _seed_politician(async_session)
    trade_id = await _seed_trade(
        async_session, pol_id, asset_type="option", external_id="opt-1"
    )
    await async_session.commit()

    result = await compute_returns_for_trade(async_session, trade_id)

    assert result is None

    row = await async_session.execute(
        select(ComputedReturn).where(ComputedReturn.trade_id == trade_id)
    )
    assert row.scalar_one_or_none() is None, "ComputedReturn must NOT be created for options"


# ---------------------------------------------------------------------------
# Case 2 — Equity return calculation
# ---------------------------------------------------------------------------

async def test_equity_return_calculation(async_session):
    """Return pct and S&P 500 pct computed correctly from price_snapshots using trade_date."""
    pol_id = await _seed_politician(async_session)
    trade_id = await _seed_trade(
        async_session,
        pol_id,
        asset_type="equity",
        ticker="AAPL",
        trade_date=date(2024, 1, 15),
        amount_lower=15001,
        amount_upper=50000,
    )
    await _seed_price_snapshots(async_session)
    await async_session.commit()

    await compute_returns_for_trade(async_session, trade_id)

    row = await async_session.execute(
        select(ComputedReturn).where(ComputedReturn.trade_id == trade_id)
    )
    cr = row.scalar_one()

    # return_pct = (250.00 - 185.00) / 185.00 * 100 ≈ 35.135...
    expected_return_pct = Decimal("35.14")
    assert abs(Decimal(str(cr.return_pct)) - expected_return_pct) < Decimal("0.01"), (
        f"return_pct={cr.return_pct} not within 0.01 of {expected_return_pct}"
    )

    # sp500_return_pct = (5000 - 4780) / 4780 * 100 ≈ 4.602...
    expected_sp500 = Decimal("4.60")
    assert abs(Decimal(str(cr.sp500_return_pct)) - expected_sp500) < Decimal("0.01"), (
        f"sp500_return_pct={cr.sp500_return_pct} not within 0.01 of {expected_sp500}"
    )

    assert int(cr.methodology_ver) == 1, "methodology_ver must be 1"
    assert Decimal(str(cr.price_at_trade)) == Decimal("185.00"), (
        "price_at_trade must use trade_date (2024-01-15), not disclosure_date"
    )


# ---------------------------------------------------------------------------
# Case 3 — Missing price data → skip gracefully
# ---------------------------------------------------------------------------

async def test_missing_price_data_skips_gracefully(async_session):
    """No ComputedReturn created when price_snapshots has no rows for the ticker."""
    pol_id = await _seed_politician(async_session)
    trade_id = await _seed_trade(
        async_session,
        pol_id,
        asset_type="equity",
        ticker="MSFT",  # no price data seeded for MSFT
        trade_date=date(2024, 1, 15),
    )
    await async_session.commit()

    # Must not raise
    result = await compute_returns_for_trade(async_session, trade_id)

    assert result is None

    row = await async_session.execute(
        select(ComputedReturn).where(ComputedReturn.trade_id == trade_id)
    )
    assert row.scalar_one_or_none() is None, (
        "No ComputedReturn row should be created when price data is missing"
    )


# ---------------------------------------------------------------------------
# Case 4 — Upsert idempotency
# ---------------------------------------------------------------------------

async def test_upsert_idempotency(async_session):
    """Calling compute_returns_for_trade twice produces exactly one ComputedReturn row."""
    pol_id = await _seed_politician(async_session)
    trade_id = await _seed_trade(
        async_session,
        pol_id,
        asset_type="equity",
        ticker="AAPL",
        trade_date=date(2024, 1, 15),
    )
    await _seed_price_snapshots(async_session)
    await async_session.commit()

    await compute_returns_for_trade(async_session, trade_id)
    await compute_returns_for_trade(async_session, trade_id)

    rows = await async_session.execute(
        select(ComputedReturn).where(ComputedReturn.trade_id == trade_id)
    )
    all_rows = rows.scalars().all()
    assert len(all_rows) == 1, (
        f"Expected exactly 1 ComputedReturn row after two calls, got {len(all_rows)}"
    )
