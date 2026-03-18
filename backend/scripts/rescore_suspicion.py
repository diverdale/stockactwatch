"""Reset and re-score all trade suspicion scores."""
import asyncio
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)

log = logging.getLogger(__name__)


async def main():
    from sqlalchemy import text
    from app.db import AsyncSessionLocal, dispose_engine
    from app.services.suspicion import score_unscored_trades

    async with AsyncSessionLocal() as db:
        result = await db.execute(text("SELECT COUNT(*) FROM trades WHERE suspicion_score IS NOT NULL"))
        count = result.scalar()
        log.info("Nulling suspicion scores for %d trades...", count)

        await db.execute(text("UPDATE trades SET suspicion_score = NULL, suspicion_flags = NULL"))
        await db.commit()
        log.info("Scores cleared. Re-scoring...")

        total = await score_unscored_trades(db)
        log.info("Done. Scored %d trades.", total)

    await dispose_engine()


if __name__ == "__main__":
    asyncio.run(main())
