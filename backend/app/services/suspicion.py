"""Suspicion scoring for congressional trades.

Scores each trade 1–10 based on how suspicious it looks using signals
already present in the database: committee membership overlap with the
traded sector, proximity to a committee hearing, filing lag, trade size,
and whether it was an options trade.
"""
from __future__ import annotations

import json
import logging
from datetime import date, timedelta

from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.committee_hearing import CommitteeHearing
from app.models.politician_committee import PoliticianCommittee
from app.models.ticker_meta import TickerMeta
from app.models.trade import Trade

log = logging.getLogger(__name__)

# Maps traded sector → committee name keywords that oversee it
SECTOR_COMMITTEE_KEYWORDS: dict[str, list[str]] = {
    "Technology":             ["science", "intelligence", "commerce"],
    "Communication Services": ["commerce", "intelligence", "judiciary"],
    "Healthcare":             ["health", "commerce"],
    "Financial Services":     ["banking", "financial", "finance"],
    "Financials":             ["banking", "financial", "finance"],
    "Energy":                 ["energy", "environment", "natural resources"],
    "Utilities":              ["energy", "environment"],
    "Industrials":            ["armed services", "transportation", "commerce"],
    "Materials":              ["environment", "agriculture", "natural resources"],
    "Consumer Discretionary": ["commerce", "judiciary"],
    "Consumer Staples":       ["agriculture", "commerce"],
    "Real Estate":            ["banking", "financial", "housing"],
    "Defense":                ["armed services", "intelligence"],
}

HEARING_WINDOW_DAYS = 30  # trades within this many days after a hearing are flagged
LARGE_AMOUNT_THRESHOLD = 500_001
LATE_FILING_DAYS = 45
SLOW_FILING_DAYS = 30


def _committee_overlaps_sector(committee_name: str, sector: str) -> bool:
    keywords = SECTOR_COMMITTEE_KEYWORDS.get(sector, [])
    name_lower = committee_name.lower()
    return any(kw in name_lower for kw in keywords)


def score_trade(
    trade: Trade,
    sector: str | None,
    committees: list[PoliticianCommittee],
    hearings: list[CommitteeHearing],
) -> tuple[int, dict]:
    """Return (score 1-10, flags dict) for a single trade."""
    flags: dict = {}
    raw = 0

    # 1. Filing lag
    try:
        trade_dt = trade.trade_date if isinstance(trade.trade_date, date) else date.fromisoformat(str(trade.trade_date))
        disc_dt = trade.disclosure_date if isinstance(trade.disclosure_date, date) else date.fromisoformat(str(trade.disclosure_date))
        lag = (disc_dt - trade_dt).days
        if lag > LATE_FILING_DAYS:
            raw += 3
            flags["late_filing_days"] = lag
        elif lag > SLOW_FILING_DAYS:
            raw += 1
            flags["slow_filing_days"] = lag
    except Exception:
        trade_dt = None
        lag = None

    # 2. Committee-sector overlap
    if sector and committees:
        overlapping = [c.committee_name for c in committees if _committee_overlaps_sector(c.committee_name, sector)]
        if overlapping:
            raw += 3
            flags["committee_overlap"] = overlapping[:2]  # cap for brevity

    # 3. Proximity to a committee hearing (trade within HEARING_WINDOW_DAYS after a hearing)
    if trade_dt and committees and hearings:
        committee_codes = {c.committee_code for c in committees}
        window_start = trade_dt - timedelta(days=HEARING_WINDOW_DAYS)
        nearby = [
            h for h in hearings
            if h.committee_code in committee_codes
            and window_start <= h.hearing_date <= trade_dt
        ]
        if nearby:
            raw += 2
            flags["near_hearing"] = nearby[0].title or nearby[0].committee_name

    # 4. Large trade amount
    if trade.amount_lower and trade.amount_lower >= LARGE_AMOUNT_THRESHOLD:
        raw += 1
        flags["large_amount"] = True

    # 5. Options trade
    if trade.asset_type and "option" in trade.asset_type.lower():
        raw += 1
        flags["options_trade"] = True

    score = max(1, min(10, raw))
    return score, flags


async def score_politician_trades(
    politician_id: str,
    db: AsyncSession,
) -> list[tuple[str, int, dict]]:
    """Score all trades for a politician. Returns list of (trade_id, score, flags)."""
    import uuid as _uuid
    pol_uuid = _uuid.UUID(politician_id)

    # Fetch trades
    trades_result = await db.execute(
        select(Trade).where(Trade.politician_id == pol_uuid)
    )
    trades = list(trades_result.scalars().all())
    if not trades:
        return []

    # Fetch committee memberships
    committees_result = await db.execute(
        select(PoliticianCommittee).where(PoliticianCommittee.politician_id == pol_uuid)
    )
    committees = list(committees_result.scalars().all())

    # Fetch all relevant hearings (broad window)
    committee_codes = [c.committee_code for c in committees]
    hearings: list[CommitteeHearing] = []
    if committee_codes:
        hearings_result = await db.execute(
            select(CommitteeHearing).where(CommitteeHearing.committee_code.in_(committee_codes))
        )
        hearings = list(hearings_result.scalars().all())

    # Fetch sector data per ticker
    tickers = list({t.ticker for t in trades})
    sectors_result = await db.execute(
        select(TickerMeta.ticker, TickerMeta.sector).where(TickerMeta.ticker.in_(tickers))
    )
    sector_map: dict[str, str] = {row.ticker: row.sector for row in sectors_result if row.sector}

    results: list[tuple[str, int, dict]] = []
    for trade in trades:
        sector = sector_map.get(trade.ticker)
        score, flags = score_trade(trade, sector, committees, hearings)
        results.append((str(trade.id), score, flags))

    return results


async def persist_scores(
    scores: list[tuple[str, int, dict]],
    db: AsyncSession,
) -> None:
    """Write scores back to the trades table."""
    import uuid as _uuid
    for trade_id, score, flags in scores:
        await db.execute(
            update(Trade)
            .where(Trade.id == _uuid.UUID(trade_id))
            .values(suspicion_score=score, suspicion_flags=json.dumps(flags))
        )
    await db.commit()


async def score_unscored_trades(db: AsyncSession) -> int:
    """Score all trades that don't yet have a suspicion_score. Returns count scored."""
    # Get distinct politician_ids with unscored trades
    result = await db.execute(
        text("SELECT DISTINCT politician_id FROM trades WHERE suspicion_score IS NULL")
    )
    politician_ids = [str(row[0]) for row in result]

    total = 0
    for pol_id in politician_ids:
        try:
            scores = await score_politician_trades(pol_id, db)
            await persist_scores(scores, db)
            total += len(scores)
        except Exception as exc:
            log.warning("Failed to score trades for politician %s: %s", pol_id, exc)

    log.info("Scored %d trades across %d politicians", total, len(politician_ids))
    return total
