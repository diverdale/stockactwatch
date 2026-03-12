"""
Canonical TradeIn Pydantic schema and AssetType enum.

These are the application's internal representations of a congressional trade.
No vendor field names (Quiver, Capitol Trades, etc.) appear here.
"""
from __future__ import annotations

from datetime import date
from enum import Enum

from pydantic import BaseModel, model_validator


class AssetType(str, Enum):
    equity = "equity"
    option = "option"
    etf = "etf"
    mutual_fund = "mutual_fund"
    other = "other"


class TradeIn(BaseModel):
    """Canonical representation of a congressional trade disclosure."""

    external_id: str
    politician_name: str
    ticker: str
    asset_type: AssetType
    transaction_type: str
    trade_date: date
    disclosure_date: date
    amount_range_raw: str = ""
    amount_lower: int
    amount_upper: int | None
    owner: str = "Self"
    amendment_version: int = 0
    source: str
    return_calculable: bool = True

    @model_validator(mode="after")
    def set_return_calculable(self) -> "TradeIn":
        """Options must never have return_calculable=True (LEGAL-02)."""
        if self.asset_type == AssetType.option:
            self.return_calculable = False
        return self
