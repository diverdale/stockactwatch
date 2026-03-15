from decimal import Decimal

from pydantic import BaseModel

METHODOLOGY_LABEL_V1 = "v1 — estimated gain/loss vs. entry price (midpoint of disclosed range)"


class ReturnLeaderboardEntry(BaseModel):
    politician_id: str
    full_name: str
    chamber: str | None
    party: str | None
    avg_return_pct: Decimal | None
    return_low: Decimal | None
    return_high: Decimal | None
    trade_count: int
    methodology_label: str
    disclaimer: bool


class VolumeLeaderboardEntry(BaseModel):
    politician_id: str
    full_name: str
    chamber: str | None
    party: str | None
    trade_count: int


class LeaderboardResponse(BaseModel):
    entries: list[ReturnLeaderboardEntry]
    total: int
    cached: bool


class VolumeLeaderboardResponse(BaseModel):
    entries: list[VolumeLeaderboardEntry]
    total: int
    cached: bool
    filters_applied: dict
