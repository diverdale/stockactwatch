"""
Quiver Quantitative API response normalizer.

This is the ONLY module in the codebase that knows Quiver vendor field names.
All external field names are contained here and must not leak into business logic.

Supports both V1 (live endpoint) and V2 (bulk endpoint) schemas.
Auto-detection: if "Name" key is present → V2, otherwise → V1.
"""
from __future__ import annotations

import hashlib
import logging
from datetime import date

from app.schemas.trade import AssetType, TradeIn

logger = logging.getLogger(__name__)

# Fixed STOCK Act disclosure amount ranges — use a dict, not regex.
# These ranges are a closed, enumerated set defined by the STOCK Act.
AMOUNT_RANGES: dict[str, tuple[int, int | None]] = {
    "$1,001 - $15,000":         (1001,    15000),
    "$15,001 - $50,000":        (15001,   50000),
    "$50,001 - $100,000":       (50001,   100000),
    "$100,001 - $250,000":      (100001,  250000),
    "$250,001 - $500,000":      (250001,  500000),
    "$500,001 - $1,000,000":    (500001,  1000000),
    "$1,000,001 - $5,000,000":  (1000001, 5000000),
    "Over $5,000,000":          (5000001, None),
}

# Reverse: lower bound → (range_string, lower, upper)
_LOWER_TO_RANGE: list[tuple[int, int | None, str]] = [
    (lower, upper, raw) for raw, (lower, upper) in AMOUNT_RANGES.items()
]


def parse_amount_range(raw: str) -> tuple[int, int | None]:
    """Map a STOCK Act range string to (lower, upper) integers.

    Returns (0, None) for unrecognized ranges and logs a warning.
    """
    result = AMOUNT_RANGES.get(raw)
    if result is None:
        logger.warning("Unrecognized amount range %r — defaulting to (0, None)", raw)
        return (0, None)
    return result


def _amount_from_numeric(value: float | int | None) -> tuple[str, int, int | None]:
    """Map a numeric Trade_Size_USD value to (range_raw, lower, upper).

    Buckets the value into the nearest STOCK Act range. Used for V2 records
    where the exact range string is not present.
    """
    if not value:
        return ("", 0, None)
    n = int(float(str(value)))
    for lower, upper, raw in _LOWER_TO_RANGE:
        if n >= lower and (upper is None or n <= upper):
            return (raw, lower, upper)
    # Value exceeds all ranges — use the top bucket
    return ("Over $5,000,000", 5000001, None)


def _classify_asset_type(description: str) -> AssetType:
    """Classify an asset from its description string.

    Checks in priority order:
    1. Option (call or put) — highest priority, LEGAL-02 compliance
    2. ETF / fund
    3. Default: equity
    """
    lower = description.lower()
    if "call" in lower or "put" in lower or "option" in lower:
        return AssetType.option
    if "etf" in lower or "fund" in lower:
        return AssetType.etf
    return AssetType.equity


def _parse_date(raw: str | None) -> date | None:
    """Parse ISO date string, returning None for blank/null values."""
    if not raw:
        return None
    try:
        return date.fromisoformat(str(raw)[:10])
    except (ValueError, TypeError):
        return None


def normalize_quiver_trade(raw: dict) -> TradeIn:
    """Map a raw Quiver API trade dict to the canonical TradeIn schema.

    Auto-detects V1 vs V2 schema:
    - V2: contains "Name" key (bulk endpoint)
    - V1: contains "Representative" key (live endpoint)

    V1 field mapping:
      Representative      → politician_name
      BioGuideID          → bio_guide_id
      Ticker              → ticker
      Transaction         → transaction_type
      TransactionDate     → trade_date
      ReportDate          → disclosure_date
      Range               → amount_range_raw / amount_lower / amount_upper
      House               → chamber  ("Representatives" → "House")
      Party               → party    ("R" → "Republican")

    V2 field mapping:
      Name                → politician_name
      BioGuideID          → bio_guide_id
      Ticker              → ticker
      Transaction         → transaction_type
      Traded              → trade_date
      Filed               → disclosure_date
      Trade_Size_USD      → amount (bucketed back to STOCK Act range)
      Chamber             → chamber  (already "House" / "Senate")
      State               → state
      Party               → party    ("R" → "Republican" or already full name)
    """
    is_v2 = "Name" in raw

    if is_v2:
        return _normalize_v2(raw)
    return _normalize_v1(raw)


# ── V1 normalizer (live endpoint) ─────────────────────────────────────────────

_HOUSE_MAP = {"Representatives": "House", "Senate": "Senate"}
_PARTY_MAP = {"R": "Republican", "D": "Democrat", "I": "Independent", "Democratic": "Democrat", "Republican Party": "Republican"}


def _normalize_v1(raw: dict) -> TradeIn:
    chamber = _HOUSE_MAP.get(raw.get("House", ""), raw.get("House") or None)
    raw_party = raw.get("Party", "")
    party = _PARTY_MAP.get(raw_party, raw_party or None)
    bio_guide_id = raw.get("BioGuideID") or None

    description = raw.get("Description") or ""
    ticker_type = raw.get("TickerType", "")
    asset_type = _classify_asset_type(f"{description} {ticker_type}")

    amount_range_raw = raw.get("Range", "")
    amount_lower, amount_upper = parse_amount_range(amount_range_raw)

    id_key = raw.get("BioGuideID") or raw.get("Representative", "")
    id_source = f"{id_key}|{raw.get('TransactionDate', '')}|{raw.get('Ticker', '')}|{amount_range_raw}"
    external_id = hashlib.md5(id_source.encode()).hexdigest()

    trade_date = _parse_date(raw.get("TransactionDate"))
    disclosure_date = _parse_date(raw.get("ReportDate"))

    if trade_date is None or disclosure_date is None:
        raise ValueError(
            f"V1 record missing required date fields: "
            f"TransactionDate={raw.get('TransactionDate')!r}, ReportDate={raw.get('ReportDate')!r}"
        )

    return TradeIn(
        external_id=external_id,
        politician_name=raw["Representative"],
        bio_guide_id=bio_guide_id,
        chamber=chamber,
        party=party,
        ticker=raw["Ticker"],
        asset_type=asset_type,
        transaction_type=raw["Transaction"],
        trade_date=trade_date,
        disclosure_date=disclosure_date,
        amount_range_raw=amount_range_raw,
        amount_lower=amount_lower,
        amount_upper=amount_upper,
        owner=raw.get("Owner", "Self"),
        source="quiver",
    )


# ── V2 normalizer (bulk endpoint) ─────────────────────────────────────────────

def _normalize_v2(raw: dict) -> TradeIn:
    # Chamber: V2 uses "Representatives" / "Senate"; normalize with same map as V1
    chamber = _HOUSE_MAP.get(raw.get("Chamber", ""), raw.get("Chamber") or None)

    # Party: may be "R"/"D"/"I" or already full name
    raw_party = raw.get("Party", "")
    party = _PARTY_MAP.get(raw_party, raw_party or None)

    bio_guide_id = raw.get("BioGuideID") or None
    state = raw.get("State") or None

    description = raw.get("Description") or ""
    ticker_type = raw.get("TickerType", "")
    asset_type = _classify_asset_type(f"{description} {ticker_type}")

    # V2 uses Trade_Size_USD (numeric) instead of Range (string)
    amount_range_raw, amount_lower, amount_upper = _amount_from_numeric(
        raw.get("Trade_Size_USD")
    )

    trade_date = _parse_date(raw.get("Traded"))
    disclosure_date = _parse_date(raw.get("Filed"))

    if trade_date is None or disclosure_date is None:
        raise ValueError(
            f"V2 record missing required date fields: "
            f"Traded={raw.get('Traded')!r}, Filed={raw.get('Filed')!r}"
        )

    politician_name = raw.get("Name", "").strip()
    if not politician_name:
        raise ValueError("V2 record missing Name field")

    id_key = bio_guide_id or politician_name
    id_source = f"v2|{id_key}|{raw.get('Traded', '')}|{raw.get('Ticker', '')}|{amount_range_raw}"
    external_id = hashlib.md5(id_source.encode()).hexdigest()

    return TradeIn(
        external_id=external_id,
        politician_name=politician_name,
        bio_guide_id=bio_guide_id,
        chamber=chamber,
        party=party,
        state=state,
        ticker=raw["Ticker"],
        asset_type=asset_type,
        transaction_type=raw.get("Transaction", "Purchase"),
        trade_date=trade_date,
        disclosure_date=disclosure_date,
        amount_range_raw=amount_range_raw,
        amount_lower=amount_lower,
        amount_upper=amount_upper,
        owner=raw.get("Owner", "Self"),
        source="quiver",
    )
