"""
Tests for PriceClient interface in app.ingestion.prices.

Cases 5-6 from Plan 01-04 TDD spec.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from app.ingestion.prices import PriceClient


# ---------------------------------------------------------------------------
# MockPriceClient for interface compliance tests
# ---------------------------------------------------------------------------

class MockPriceClient(PriceClient):
    """Test double returning fixed price data for AAPL on 2024-01-15."""

    PRICES: dict[tuple[str, date], Decimal] = {
        ("AAPL", date(2024, 1, 15)): Decimal("185.00"),
        ("AAPL", date(2024, 12, 31)): Decimal("250.00"),
    }

    async def get_daily_close(self, ticker: str, as_of_date: date) -> Decimal | None:
        return self.PRICES.get((ticker, as_of_date))


# ---------------------------------------------------------------------------
# Case 5 — Interface compliance
# ---------------------------------------------------------------------------

async def test_price_client_interface_compliance():
    """MockPriceClient subclasses PriceClient and returns Decimal for known dates."""
    client = MockPriceClient()
    result = await client.get_daily_close("AAPL", date(2024, 1, 15))

    assert result is not None, "Should return a value for a known ticker/date"
    assert isinstance(result, Decimal), f"Expected Decimal, got {type(result)}"


# ---------------------------------------------------------------------------
# Case 6 — Missing date returns None
# ---------------------------------------------------------------------------

async def test_price_client_missing_date_returns_none():
    """MockPriceClient returns None for unknown dates, does not raise."""
    client = MockPriceClient()
    result = await client.get_daily_close("AAPL", date(1900, 1, 1))

    assert result is None, (
        f"Expected None for unknown date, got {result!r}"
    )
