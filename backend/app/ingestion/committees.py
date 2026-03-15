"""
Committee membership enrichment.

Fetches current committee memberships from unitedstates.github.io and
upserts them into politician_committees, keyed by bioguide ID.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import date as date_type

import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.committee_hearing import CommitteeHearing
from app.models.politician import Politician
from app.models.politician_committee import PoliticianCommittee

logger = logging.getLogger(__name__)

COMMITTEE_MEMBERSHIP_URL = (
    "https://unitedstates.github.io/congress-legislators/committee-membership-current.json"
)
COMMITTEES_URL = (
    "https://unitedstates.github.io/congress-legislators/committees-current.json"
)

# Map committee codes to the sector slugs used in ticker_meta.sector_slug
# Built as one-to-many: committee_code -> list[sector_slug]
# Note: HSIF (House Energy and Commerce) covers energy, communication-services, AND healthcare.
# SSCM (Senate Commerce) covers both communication-services and industrials (transportation).
COMMITTEE_TO_SECTORS: dict[str, list[str]] = {
    # Financial Services
    "HSBA": ["financial-services"],
    "SSBK": ["financial-services"],
    # Energy
    "SSEG": ["energy"],
    # Technology / Communication Services
    "SSCM": ["communication-services", "industrials"],
    # Healthcare
    "SSHR": ["healthcare"],
    # Agriculture
    "HSAG": ["consumer-defensive"],
    "SSAF": ["consumer-defensive"],
    # Defense / Industrials
    "HSAS": ["industrials"],
    "SSAS": ["industrials"],
    # Transportation
    "HSPW": ["industrials"],
    # Judiciary / Real Estate
    "HSJU": ["real-estate"],
    "SSJU": ["real-estate"],
    # House Energy and Commerce — covers energy, tech/telecom, and healthcare oversight
    "HSIF": ["energy", "communication-services", "healthcare"],
}


async def fetch_committee_memberships() -> dict[str, list[dict]]:
    """Fetch raw committee membership data from unitedstates.github.io."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(COMMITTEE_MEMBERSHIP_URL)
        r.raise_for_status()
        return r.json()


async def fetch_committee_names() -> dict[str, str]:
    """Return mapping of committee_code -> committee_name."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(COMMITTEES_URL)
        r.raise_for_status()
        committees = r.json()

    names: dict[str, str] = {}
    for c in committees:
        # thomas_id is the canonical code used in membership data
        code = c.get("thomas_id", "")
        if code:
            names[code] = c.get("name", code)
        # subcommittees
        for sub in c.get("subcommittees", []):
            sub_code = c.get("thomas_id", "") + sub.get("thomas_id", "")
            if sub_code:
                names[sub_code] = sub.get("name", sub_code)
    return names


async def enrich_politician_committees(session: AsyncSession) -> int:
    """Fetch committee memberships and upsert into politician_committees.

    Matches on bio_guide_id. Politicians without a bioguide ID are skipped.
    Returns the count of rows upserted.
    """
    # Load all politicians with bioguide IDs
    result = await session.execute(
        select(Politician.id, Politician.bio_guide_id, Politician.chamber).where(
            Politician.bio_guide_id.is_not(None)
        )
    )
    politicians = {row.bio_guide_id: (row.id, row.chamber) for row in result.all()}
    logger.info(
        "Enriching committees for %d politicians with bioguide IDs", len(politicians)
    )

    memberships = await fetch_committee_memberships()
    committee_names = await fetch_committee_names()

    rows: list[dict] = []
    for committee_code, members in memberships.items():
        # Only process committees we have sector mappings for
        if committee_code not in COMMITTEE_TO_SECTORS:
            continue

        # Determine chamber from code prefix (H=House, S=Senate)
        if committee_code.startswith("H"):
            chamber = "House"
        elif committee_code.startswith("S"):
            chamber = "Senate"
        else:
            chamber = "Joint"

        committee_name = committee_names.get(committee_code, committee_code)

        for member in members:
            bioguide = member.get("bioguide", "")
            if not bioguide or bioguide not in politicians:
                continue
            politician_id, _ = politicians[bioguide]
            rows.append(
                {
                    "politician_id": politician_id,
                    "committee_code": committee_code,
                    "committee_name": committee_name,
                    "role": member.get("title"),
                    "chamber": chamber,
                }
            )

    if not rows:
        logger.warning("No committee rows to upsert — check bioguide matching")
        return 0

    # Upsert in chunks
    CHUNK = 200
    total = 0
    for i in range(0, len(rows), CHUNK):
        chunk = rows[i : i + CHUNK]
        stmt = pg_insert(PoliticianCommittee).values(chunk)
        stmt = stmt.on_conflict_do_update(
            index_elements=["politician_id", "committee_code"],
            set_={
                "committee_name": stmt.excluded.committee_name,
                "role": stmt.excluded.role,
            },
        )
        await session.execute(stmt)
        total += len(chunk)

    await session.commit()
    logger.info("Upserted %d politician_committee rows", total)
    return total


# ---------------------------------------------------------------------------
# Committee hearing enrichment — congress.gov API
# ---------------------------------------------------------------------------

# Map our committee codes to congress.gov systemCode (lowercase + "00")
COMMITTEE_SYSTEM_CODES: dict[str, str] = {
    "HSBA": "hsba00",
    "SSBK": "ssbk00",
    "HSIF": "hsif00",
    "SSEG": "sseg00",
    "SSCM": "sscm00",
    "SSHR": "sshr00",
    "HSAG": "hsag00",
    "SSAF": "ssaf00",
    "HSAS": "hsas00",
    "SSAS": "ssas00",
    "HSPW": "hspw00",
    "HSJU": "hsju00",
    "SSJU": "ssju00",
}

# Reverse: systemCode -> our committee code
SYSTEM_CODE_TO_COMMITTEE: dict[str, str] = {v: k for k, v in COMMITTEE_SYSTEM_CODES.items()}

CONGRESS_API_BASE = "https://api.congress.gov/v3"


async def fetch_committee_hearings(session: AsyncSession) -> int:
    """Fetch committee meetings/hearings from congress.gov for relevant committees.

    Fetches congress 119 (current) and 118 (previous) for house and senate.
    Filters to only meetings for committees in COMMITTEE_TO_SECTORS.
    Returns count of rows upserted.
    """
    api_key = settings.CONGRESS_API_KEY
    if not api_key:
        logger.warning("CONGRESS_API_KEY not set — skipping hearing enrichment")
        return 0

    target_system_codes = set(COMMITTEE_SYSTEM_CODES.values())

    rows: list[dict] = []

    async with httpx.AsyncClient(timeout=30.0) as client:
        for congress in [119, 118]:
            for chamber in ["house", "senate"]:
                offset = 0
                limit = 250
                meeting_count = 0

                while True:
                    try:
                        r = await client.get(
                            f"{CONGRESS_API_BASE}/committee-meeting/{congress}/{chamber}",
                            params={
                                "api_key": api_key,
                                "format": "json",
                                "limit": limit,
                                "offset": offset,
                            },
                        )
                    except httpx.RequestError as exc:
                        logger.warning("Request error fetching meetings list: %s", exc)
                        break

                    if r.status_code != 200:
                        logger.warning(
                            "Hearing list fetch failed: %s %s", r.status_code, r.text[:200]
                        )
                        break

                    data = r.json()
                    meetings = data.get("committeeMeetings", [])
                    if not meetings:
                        break

                    for meeting in meetings:
                        event_id = str(meeting.get("eventId", ""))
                        if not event_id:
                            continue

                        meeting_count += 1
                        # Limit detail fetches to avoid excessive API calls
                        if meeting_count > 500:
                            break

                        await asyncio.sleep(0.2)

                        try:
                            detail_r = await client.get(
                                f"{CONGRESS_API_BASE}/committee-meeting/{congress}/{chamber}/{event_id}",
                                params={"api_key": api_key, "format": "json"},
                            )
                        except httpx.RequestError as exc:
                            logger.warning("Request error fetching meeting detail %s: %s", event_id, exc)
                            continue

                        if detail_r.status_code != 200:
                            logger.debug(
                                "Detail fetch failed for event %s: %s", event_id, detail_r.status_code
                            )
                            continue

                        detail = detail_r.json().get("committeeMeeting", {})

                        date_str = detail.get("date", "")
                        if not date_str:
                            continue

                        # Parse to date object — asyncpg requires actual date, not str
                        try:
                            hearing_date = date_type.fromisoformat(date_str[:10])
                        except ValueError:
                            continue
                        meeting_type = detail.get("type", "Meeting")
                        raw_title = detail.get("title", "")
                        title = raw_title[:500] if raw_title else None

                        for committee in detail.get("committees", []):
                            sys_code = committee.get("systemCode", "")
                            if sys_code not in target_system_codes:
                                continue
                            our_code = SYSTEM_CODE_TO_COMMITTEE[sys_code]
                            rows.append(
                                {
                                    "committee_code": our_code,
                                    "committee_name": committee.get("name", our_code),
                                    "hearing_date": hearing_date,
                                    "title": title,
                                    "meeting_type": meeting_type,
                                    "congress": congress,
                                    "event_id": event_id,
                                }
                            )

                    if meeting_count > 500:
                        logger.info(
                            "Reached detail fetch limit for congress %s %s — stopping pagination",
                            congress,
                            chamber,
                        )
                        break

                    pagination = data.get("pagination", {})
                    if not pagination.get("next"):
                        break
                    offset += limit
                    await asyncio.sleep(0.5)

    if not rows:
        logger.warning("No hearing rows collected — check API key and committee codes")
        return 0

    # Deduplicate rows within the batch to avoid ON CONFLICT cardinality violations
    seen: set[tuple[str, str]] = set()
    deduped: list[dict] = []
    for row in rows:
        key = (row["committee_code"], row["event_id"])
        if key not in seen:
            seen.add(key)
            deduped.append(row)
    rows = deduped
    logger.info("Collected %d unique hearing rows to upsert", len(rows))

    # Upsert in chunks
    CHUNK = 100
    total = 0
    for i in range(0, len(rows), CHUNK):
        chunk = rows[i : i + CHUNK]
        stmt = pg_insert(CommitteeHearing).values(chunk)
        stmt = stmt.on_conflict_do_update(
            index_elements=["committee_code", "event_id"],
            set_={
                "hearing_date": stmt.excluded.hearing_date,
                "title": stmt.excluded.title,
                "meeting_type": stmt.excluded.meeting_type,
            },
        )
        await session.execute(stmt)
        total += len(chunk)

    await session.commit()
    logger.info("Upserted %d committee hearing rows", total)
    return total
