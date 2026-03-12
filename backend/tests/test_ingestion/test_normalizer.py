"""
Unit tests for normalize_quiver_trade() — the canonical Quiver-to-TradeIn mapping.

All tests must FAIL before implementation (RED phase).
"""
from datetime import date

import pytest

from app.schemas.trade import AssetType, TradeIn
from app.ingestion.normalizer import normalize_quiver_trade


# --- Fixtures ---

EQUITY_RAW = {
    "TransactionID": "abc123",
    "Representative": "Nancy Pelosi",
    "Ticker": "AAPL",
    "AssetDescription": "Apple Inc. Common Stock",
    "Transaction": "Purchase",
    "TransactionDate": "2024-01-15",
    "DisclosureDate": "2024-02-20",
    "Range": "$15,001 - $50,000",
    "Owner": "Self",
}


# --- Case 1: Equity trade ---

def test_equity_trade_full_mapping():
    result = normalize_quiver_trade(EQUITY_RAW)
    assert isinstance(result, TradeIn)
    assert result.external_id == "abc123"
    assert result.politician_name == "Nancy Pelosi"
    assert result.ticker == "AAPL"
    assert result.asset_type == AssetType.equity
    assert result.transaction_type == "Purchase"
    assert result.trade_date == date(2024, 1, 15)
    assert result.disclosure_date == date(2024, 2, 20)
    assert result.amount_lower == 15001
    assert result.amount_upper == 50000
    assert result.owner == "Self"
    assert result.source == "quiver"
    assert result.return_calculable is True


# --- Case 2: Option trade — call ---

def test_call_option_sets_option_type_and_not_calculable():
    raw = {**EQUITY_RAW, "AssetDescription": "AAPL Call Option 01/2025"}
    result = normalize_quiver_trade(raw)
    assert result.asset_type == AssetType.option
    assert result.return_calculable is False


# --- Case 3: Option trade — put ---

def test_put_option_sets_option_type_and_not_calculable():
    raw = {**EQUITY_RAW, "AssetDescription": "SPY Put Option"}
    result = normalize_quiver_trade(raw)
    assert result.asset_type == AssetType.option
    assert result.return_calculable is False


# --- Case 4: ETF detection ---

def test_etf_detection():
    raw = {**EQUITY_RAW, "AssetDescription": "S&P 500 ETF Trust"}
    result = normalize_quiver_trade(raw)
    assert result.asset_type == AssetType.etf
    assert result.return_calculable is True


# --- Case 5: Amount range parsing ---

def test_amount_range_parsing_mid_tier():
    raw = {**EQUITY_RAW, "Range": "$500,001 - $1,000,000"}
    result = normalize_quiver_trade(raw)
    assert result.amount_lower == 500001
    assert result.amount_upper == 1000000


# --- Case 6: $1M+ range — NULL upper ---

def test_amount_range_over_5m_null_upper():
    raw = {**EQUITY_RAW, "Range": "Over $5,000,000"}
    result = normalize_quiver_trade(raw)
    assert result.amount_lower == 5000001
    assert result.amount_upper is None


# --- Case 7: Date field mapping — must NOT be swapped (INGEST-05) ---

def test_date_fields_not_swapped():
    result = normalize_quiver_trade(EQUITY_RAW)
    # Explicit assertion — these must not be swapped
    assert result.trade_date == date(2024, 1, 15)
    assert result.disclosure_date == date(2024, 2, 20)
    # Extra guard: values are different so swapping would silently fail above
    assert result.trade_date != result.disclosure_date


# --- Case 8: Missing optional Owner field defaults to "Self" ---

def test_missing_owner_defaults_to_self():
    raw = {k: v for k, v in EQUITY_RAW.items() if k != "Owner"}
    result = normalize_quiver_trade(raw)
    assert result.owner == "Self"
