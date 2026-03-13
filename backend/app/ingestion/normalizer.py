"""
Quiver Quantitative API response normalizer.

This is the ONLY module in the codebase that knows Quiver vendor field names.
All external field names (Representative, TransactionDate, ReportDate, etc.)
are contained here and must not leak into business logic.
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

    Actual Quiver field mapping (verified against live API 2026-03-13):
      Representative      -> politician_name
      BioGuideID          -> used in external_id generation
      Ticker              -> ticker
      TickerType + Description -> asset_type (classified)
      Transaction         -> transaction_type
      TransactionDate     -> trade_date        (INGEST-05: NOT disclosure_date)
      ReportDate          -> disclosure_date   (INGEST-05: NOT trade_date)
      Range               -> amount_range_raw, amount_lower, amount_upper
      (no Owner field)    -> owner defaults to "Self"

    Note: Quiver has no stable TransactionID field. external_id is a deterministic
    MD5 hash of (BioGuideID, TransactionDate, Ticker, Range) to ensure idempotent upserts.
    """
    # Classify asset type from TickerType and Description.
    # TickerType "ST" / "Stock" = equity; Description may contain "call"/"put"/"option".
    description = raw.get("Description") or ""
    ticker_type = raw.get("TickerType", "")
    asset_type = _classify_asset_type(f"{description} {ticker_type}")

    amount_range_raw = raw.get("Range", "")
    amount_lower, amount_upper = parse_amount_range(amount_range_raw)

    # Deterministic external_id — Quiver has no stable trade ID field.
    bio_guide_id = raw.get("BioGuideID", raw.get("Representative", ""))
    id_source = f"{bio_guide_id}|{raw.get('TransactionDate', '')}|{raw.get('Ticker', '')}|{amount_range_raw}"
    external_id = hashlib.md5(id_source.encode()).hexdigest()

    return TradeIn(
        external_id=external_id,
        politician_name=raw["Representative"],
        ticker=raw["Ticker"],
        asset_type=asset_type,
        transaction_type=raw["Transaction"],
        trade_date=date.fromisoformat(raw["TransactionDate"]),   # INGEST-05
        disclosure_date=date.fromisoformat(raw["ReportDate"]),   # INGEST-05 (Quiver: ReportDate)
        amount_range_raw=amount_range_raw,
        amount_lower=amount_lower,
        amount_upper=amount_upper,
        owner=raw.get("Owner", "Self"),
        source="quiver",
    )
