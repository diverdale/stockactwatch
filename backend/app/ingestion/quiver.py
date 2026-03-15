"""
Quiver Quantitative API client.

Provides raw list[dict] responses only — normalization is the caller's responsibility.
This module knows the Quiver API URL and authentication scheme, but not field semantics.

The live endpoint (/beta/live/congresstrading) returns V1 schema.
The bulk endpoint (/beta/bulk/congresstrading) returns V2 schema.
Both schemas are handled by normalize_quiver_trade() in normalizer.py.
"""
from __future__ import annotations

import asyncio
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
QUIVER_BULK_URL = "https://api.quiverquant.com/beta/bulk/congresstrading"

_BULK_PAGE_SIZE = 500


@retry(
    wait=wait_exponential(multiplier=1, min=2, max=30),
    stop=stop_after_attempt(3),
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.HTTPStatusError)),
    reraise=True,
)
async def fetch_congress_trades(since_date: str | None = None) -> list[dict]:
    """Fetch raw congressional trade records from the Quiver live API.

    Returns V1 schema records (Representative, TransactionDate, ReportDate, Range, House, Party).

    Args:
        since_date: Optional ISO date string (YYYY-MM-DD) to filter records.
                    When provided, passed as a query parameter to the API.

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
        logger.info("Fetched %d raw trade records from Quiver live", len(data))
        return data


async def _fetch_bulk_page(client: httpx.AsyncClient, page: int) -> list[dict] | None:
    """Fetch a single page from the bulk endpoint.

    Returns:
        List of records, empty list if no more data, or None when rate limit
        persists after retries (caller stops pagination gracefully).

    Raises:
        httpx.TimeoutException / httpx.HTTPStatusError for non-429/500 errors after retries.
    """
    _429_WAITS = (30, 60, 120)  # seconds to wait on consecutive 429s before giving up
    consecutive_429 = 0

    for attempt in range(5):
        try:
            response = await client.get(
                QUIVER_BULK_URL,
                params={"page": page, "page_size": _BULK_PAGE_SIZE},
            )
            if response.status_code == 429:
                if consecutive_429 >= len(_429_WAITS):
                    logger.warning(
                        "Bulk fetch rate-limited (429) at page %d after %d retries — "
                        "stopping pagination.", page, consecutive_429,
                    )
                    return None  # Signal caller to stop
                wait = _429_WAITS[consecutive_429]
                logger.warning(
                    "Bulk fetch rate-limited (429) at page %d — waiting %ds (attempt %d).",
                    page, wait, consecutive_429 + 1,
                )
                await asyncio.sleep(wait)
                consecutive_429 += 1
                continue
            if response.status_code == 500:
                # Transient server error — back off and retry
                if attempt >= 2:
                    response.raise_for_status()
                await asyncio.sleep(10 * (attempt + 1))
                continue
            response.raise_for_status()
            data = response.json()
            # Bulk endpoint may return a list or a dict with results key
            if isinstance(data, dict):
                return data.get("results", [])
            return data
        except httpx.TimeoutException:
            if attempt >= 2:
                raise
            await asyncio.sleep(2 ** attempt * 2)
    return []


async def fetch_congress_trades_bulk(since_date: str | None = None) -> list[dict]:
    """Fetch all congressional trade records from the Quiver bulk endpoint.

    Paginates through the bulk endpoint (page_size=500) until an empty page is
    returned or a 429 rate limit is hit. On 429, stops gracefully and returns
    all records collected so far — partial data is better than nothing.

    The bulk endpoint returns V2 schema (Name, Traded, Filed, Trade_Size_USD,
    Chamber, State, Party). normalize_quiver_trade() auto-detects V2.

    A 1-second delay is inserted between pages to reduce rate-limit risk.

    Args:
        since_date: Optional ISO date string (YYYY-MM-DD). Records whose
                    Traded date is before this date are discarded after fetching.

    Returns:
        Complete list of raw V2 trade dicts collected across all pages.
    """
    all_records: list[dict] = []
    page = 1

    async with httpx.AsyncClient(
        timeout=60.0,
        headers={"Authorization": f"Token {settings.QUIVER_API_KEY}"},
    ) as client:
        while True:
            page_records = await _fetch_bulk_page(client, page)

            if page_records is None:
                # 429 — stop gracefully with what we have
                logger.info(
                    "Bulk fetch stopping at rate limit. Collected %d records across %d pages.",
                    len(all_records), page - 1,
                )
                break

            if not page_records:
                logger.info(
                    "Bulk fetch complete: empty page %d. Total records: %d",
                    page, len(all_records),
                )
                break

            all_records.extend(page_records)

            if page % 10 == 0:
                logger.info("Bulk fetch page %d: %d records so far", page, len(all_records))

            page += 1
            await asyncio.sleep(3.0)  # Be a good citizen — 3s between pages

    if since_date is not None:
        before = len(all_records)
        # V2 uses "Traded" for transaction date
        all_records = [
            r for r in all_records
            if (r.get("Traded") or r.get("TransactionDate") or "") >= since_date
        ]
        logger.info(
            "Bulk fetch since_date filter (%s): kept %d of %d records",
            since_date, len(all_records), before,
        )

    return all_records
