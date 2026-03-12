"""
Quiver Quantitative API response normalizer.

This is the ONLY module in the codebase that knows Quiver vendor field names.
All external field names (Representative, TransactionDate, DisclosureDate, etc.)
are contained here and must not leak into business logic.
"""
from __future__ import annotations

import logging
from datetime import date

from app.schemas.trade import AssetType, TradeIn

logger = logging.getLogger(__name__)

# Fixed STOCK Act disclosure amount ranges — use a dict, not regex.
# These ranges are a closed, enumerated set defined by the STOCK Act.
AMOUNT_RANGES: dict[str, tuple[int, int | None]] = {
    "$1,001 - $15,000": (1001, 15000),
    "$15,001 - $50,000": (15001, 50000),
    "$50,001 - $100,000": (50001, 100000),
    "$100,001 - $250,000": (100001, 250000),
    "$250,001 - $500,000": (250001, 500000),
    "$500,001 - $1,000,000": (500001, 1000000),
    "$1,000,001 - $5,000,000": (1000001, 5000000),
    "Over $5,000,000": (5000001, None),
}


def parse_amount_range(raw: str) -> tuple[int, int | None]:
    """Map a STOCK Act range string to (lower, upper) integers.

    Returns (0, None) for unrecognized ranges and logs a warning.
    Ingestion continues — a single unrecognized range must not abort a batch.
    """
    result = AMOUNT_RANGES.get(raw)
    if result is None:
        logger.warning("Unrecognized amount range %r — defaulting to (0, None)", raw)
        return (0, None)
    return result


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


def normalize_quiver_trade(raw: dict) -> TradeIn:
    """Map a raw Quiver API trade dict to the canonical TradeIn schema.

    This function is the sole boundary between Quiver vendor field names
    and the application's internal domain model.

    Quiver field mapping:
      TransactionID       -> external_id
      Representative      -> politician_name
      Ticker              -> ticker
      AssetDescription    -> asset_type (classified)
      Transaction         -> transaction_type
      TransactionDate     -> trade_date        (INGEST-05: NOT disclosure_date)
      DisclosureDate      -> disclosure_date   (INGEST-05: NOT trade_date)
      Range               -> amount_range_raw, amount_lower, amount_upper
      Owner               -> owner (default "Self")
    """
    asset_type = _classify_asset_type(raw.get("AssetDescription", ""))
    amount_range_raw = raw.get("Range", "")
    amount_lower, amount_upper = parse_amount_range(amount_range_raw)

    return TradeIn(
        external_id=raw["TransactionID"],
        politician_name=raw["Representative"],
        ticker=raw["Ticker"],
        asset_type=asset_type,
        transaction_type=raw["Transaction"],
        trade_date=date.fromisoformat(raw["TransactionDate"]),      # INGEST-05
        disclosure_date=date.fromisoformat(raw["DisclosureDate"]),  # INGEST-05
        amount_range_raw=amount_range_raw,
        amount_lower=amount_lower,
        amount_upper=amount_upper,
        owner=raw.get("Owner", "Self"),
        source="quiver",
    )
