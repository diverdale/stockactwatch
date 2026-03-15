"""Standalone script to run the full Quiver bulk backfill."""
import asyncio
import logging
import sys
import os

# Add backend root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)

async def main():
    from app.db import AsyncSessionLocal, dispose_engine
    from app.ingestion.pipeline import run_full_backfill

    print("Starting full bulk backfill...")
    await run_full_backfill(since_date=None)
    await dispose_engine()
    print("Backfill complete.")

if __name__ == "__main__":
    asyncio.run(main())
