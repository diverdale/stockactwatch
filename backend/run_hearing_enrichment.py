"""Standalone script to run hearing enrichment."""
import asyncio
import sys
import os

# Ensure backend package is importable
sys.path.insert(0, os.path.dirname(__file__))

async def main():
    from app.db import AsyncSessionLocal
    from app.ingestion.committees import fetch_committee_hearings

    async with AsyncSessionLocal() as session:
        count = await fetch_committee_hearings(session)
        print(f"Done. Upserted {count} rows.")

if __name__ == "__main__":
    asyncio.run(main())
