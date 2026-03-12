"""
Quiver Quantitative API client.

Provides raw list[dict] responses only — normalization is the caller's responsibility.
This module knows the Quiver API URL and authentication scheme, but not field semantics.
"""
from __future__ import annotations

import logging

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.config import settings

logger = logging.getLogger(__name__)

QUIVER_BASE_URL = "https://api.quiverquant.com/beta/live/congresstrading"


@retry(
    wait=wait_exponential(multiplier=1, min=2, max=30),
    stop=stop_after_attempt(3),
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.HTTPStatusError)),
    reraise=True,
)
async def fetch_congress_trades(since_date: str | None = None) -> list[dict]:
    """Fetch raw congressional trade records from the Quiver API.

    Args:
        since_date: Optional ISO date string (YYYY-MM-DD) to filter records.
                    When provided, passed as a query parameter to the API.

    Returns:
        Raw list of trade dicts from Quiver. Field names are Quiver vendor names.
        Callers must use normalize_quiver_trade() to map to the canonical TradeIn schema.

    Raises:
        httpx.TimeoutException: After 3 retries with exponential backoff.
        httpx.HTTPStatusError: After 3 retries for HTTP error responses.
    """
    params: dict[str, str] = {}
    if since_date is not None:
        params["date"] = since_date

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            QUIVER_BASE_URL,
            headers={"Authorization": f"Token {settings.QUIVER_API_KEY}"},
            params=params,
        )
        response.raise_for_status()
        data: list[dict] = response.json()
        logger.info("Fetched %d raw trade records from Quiver", len(data))
        return data
