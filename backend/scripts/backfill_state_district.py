"""
Backfill state and district for all politicians using bio_guide_id.

Data source: https://theunitedstates.io/congress-legislators/
  legislators-current.json  — active members
  legislators-historical.json — former members

For each politician with a bio_guide_id, find their most recent term and
populate state (2-letter code) and district (int, House only).

Usage:
  cd backend
  DATABASE_URL=postgresql://localhost/stock_tracker python scripts/backfill_state_district.py
"""
from __future__ import annotations

import asyncio
import os
import sys
import urllib.request

try:
    import yaml
except ImportError:
    print("Install pyyaml: pip install pyyaml")
    sys.exit(1)

# Allow running without the full app config by patching settings early
os.environ.setdefault("QUIVER_API_KEY", "placeholder")
os.environ.setdefault("INTERNAL_SECRET", "placeholder")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, update, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.models.politician import Politician

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+asyncpg://localhost/stock_tracker")
# asyncpg requires postgresql+asyncpg:// scheme
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)

CURRENT_URL = "https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-current.yaml"
HISTORICAL_URL = "https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-historical.yaml"


def fetch_yaml(url: str) -> list[dict]:
    print(f"Fetching {url} ...")
    with urllib.request.urlopen(url, timeout=60) as resp:
        return yaml.safe_load(resp.read())


def build_lookup(legislators: list[dict]) -> dict[str, dict]:
    """Build bio_guide_id → {state, district} from legislators list."""
    lookup: dict[str, dict] = {}
    for leg in legislators:
        bio_id = leg.get("id", {}).get("bioguide")
        if not bio_id:
            continue
        # Use the most recent term (last in list)
        terms = leg.get("terms", [])
        if not terms:
            continue
        term = terms[-1]
        state = term.get("state")
        # district is only present for House reps
        district = term.get("district")
        if state:
            lookup[bio_id] = {"state": state, "district": district}
    return lookup


async def backfill() -> None:
    # Fetch from unitedstates project
    current = fetch_yaml(CURRENT_URL)
    historical = fetch_yaml(HISTORICAL_URL)

    # Historical first so current overrides
    lookup = build_lookup(historical)
    lookup.update(build_lookup(current))
    print(f"Loaded {len(lookup)} legislators from unitedstates project")

    engine = create_async_engine(DATABASE_URL, echo=False)
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as session:
        result = await session.execute(
            select(Politician.id, Politician.bio_guide_id, Politician.full_name)
            .where(Politician.bio_guide_id.isnot(None))
        )
        rows = result.all()
        print(f"Found {len(rows)} politicians with bio_guide_id in DB")

        updated = 0
        not_found = []
        for pol_id, bio_id, name in rows:
            info = lookup.get(bio_id)
            if not info:
                not_found.append((name, bio_id))
                continue
            await session.execute(
                update(Politician)
                .where(Politician.id == pol_id)
                .values(state=info["state"], district=info["district"])
            )
            updated += 1

        await session.commit()

    await engine.dispose()

    print(f"\nUpdated {updated} politicians with state/district")
    if not_found:
        print(f"Not found in unitedstates data ({len(not_found)}):")
        for name, bio_id in not_found:
            print(f"  {name} ({bio_id})")


if __name__ == "__main__":
    asyncio.run(backfill())
