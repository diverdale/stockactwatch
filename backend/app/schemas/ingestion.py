"""
Ingestion-related response schemas (e.g. for internal trigger endpoints).
"""
from __future__ import annotations

from pydantic import BaseModel


class IngestionResult(BaseModel):
    """Summary of an ingestion run."""

    records_fetched: int
    records_normalized: int
    records_inserted: int
    errors: list[str] = []
