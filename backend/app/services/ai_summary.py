"""AI-generated politician trading summaries using Claude."""
from __future__ import annotations

import json
import logging
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.politician import Politician
from app.models.politician_committee import PoliticianCommittee
from app.models.trade import Trade

log = logging.getLogger(__name__)

SUMMARY_CACHE_TTL = 60 * 60 * 24 * 7  # 7 days


def _midpoint(lower: int | None, upper: int | None) -> float:
    if not lower:
        return 0
    return (lower + upper) / 2 if upper else float(lower)


def _fmt_volume(n: float) -> str:
    if n >= 1_000_000:
        return f"${n / 1_000_000:.1f}M"
    if n >= 1_000:
        return f"${n / 1_000:.0f}K"
    return f"${n:.0f}"


async def build_politician_context(politician_id: str, db: AsyncSession) -> dict:
    """Gather all relevant data about a politician for the summary prompt."""
    import uuid as _uuid
    pol_uuid = _uuid.UUID(politician_id)

    politician = await db.get(Politician, pol_uuid)
    if not politician:
        raise ValueError(f"Politician {politician_id} not found")

    trades_result = await db.execute(
        select(Trade).where(Trade.politician_id == pol_uuid).order_by(Trade.trade_date.desc())
    )
    trades = trades_result.scalars().all()

    committees_result = await db.execute(
        select(PoliticianCommittee).where(PoliticianCommittee.politician_id == pol_uuid)
    )
    committees = committees_result.scalars().all()

    # Derived stats
    buys = [t for t in trades if "purchase" in (t.transaction_type or "").lower()]
    sells = [t for t in trades if "sale" in (t.transaction_type or "").lower() or "sell" in (t.transaction_type or "").lower()]
    options = [t for t in trades if "option" in (t.asset_type or "").lower()]

    est_volume = sum(_midpoint(t.amount_lower, t.amount_upper) for t in trades)

    lags = []
    for t in trades:
        try:
            td = t.trade_date if isinstance(t.trade_date, date) else date.fromisoformat(str(t.trade_date))
            dd = t.disclosure_date if isinstance(t.disclosure_date, date) else date.fromisoformat(str(t.disclosure_date))
            lag = (dd - td).days
            if 0 <= lag <= 3650:
                lags.append(lag)
        except Exception:
            pass
    avg_lag = round(sum(lags) / len(lags)) if lags else None
    late_count = sum(1 for l in lags if l > 45)

    # Top tickers by frequency
    ticker_counts: dict[str, int] = {}
    for t in trades:
        ticker_counts[t.ticker] = ticker_counts.get(t.ticker, 0) + 1
    top_tickers = sorted(ticker_counts.items(), key=lambda x: x[1], reverse=True)[:5]

    # Date range
    trade_dates = sorted([str(t.trade_date) for t in trades])
    date_range = f"{trade_dates[0]} to {trade_dates[-1]}" if trade_dates else "N/A"

    return {
        "name": politician.full_name,
        "party": politician.party,
        "chamber": politician.chamber,
        "state": politician.state,
        "district": politician.district,
        "total_trades": len(trades),
        "buy_count": len(buys),
        "sell_count": len(sells),
        "options_count": len(options),
        "est_volume": _fmt_volume(est_volume),
        "avg_filing_lag": avg_lag,
        "late_filings": late_count,
        "date_range": date_range,
        "top_tickers": [{"ticker": t, "count": c} for t, c in top_tickers],
        "committees": [{"name": c.committee_name, "role": c.role} for c in committees],
    }


async def generate_summary(politician_id: str, db: AsyncSession) -> str:
    """Generate an AI summary for a politician using Claude. Returns the summary text."""
    if not settings.ANTHROPIC_API_KEY:
        return ""

    try:
        import anthropic
    except ImportError:
        log.warning("anthropic package not installed — cannot generate summary")
        return ""

    ctx = await build_politician_context(politician_id, db)

    committees_text = (
        ", ".join(f"{c['name']}{' (' + c['role'] + ')' if c['role'] else ''}" for c in ctx["committees"])
        if ctx["committees"] else "No committee data available"
    )
    top_tickers_text = (
        ", ".join(f"{t['ticker']} ({t['count']} trades)" for t in ctx["top_tickers"])
        if ctx["top_tickers"] else "N/A"
    )
    late_note = f"{ctx['late_filings']} trade{'s' if ctx['late_filings'] != 1 else ''} filed after the 45-day STOCK Act deadline" if ctx["late_filings"] else "All trades filed within the 45-day STOCK Act window"

    prompt = f"""You are analyzing public congressional stock trading disclosures under the STOCK Act.
Write a concise, factual 3-4 sentence summary of this member's trading activity. Be objective and data-driven.
Do not speculate about intent or make legal accusations. Focus on patterns, volume, and notable characteristics.

Member: {ctx['name']} ({ctx['party']}, {ctx['chamber']}, {ctx['state']})
Total trades: {ctx['total_trades']} ({ctx['buy_count']} buys, {ctx['sell_count']} sells, {ctx['options_count']} options)
Estimated trade volume: {ctx['est_volume']}
Date range: {ctx['date_range']}
Average filing lag: {ctx['avg_filing_lag']} days
Filing compliance: {late_note}
Most traded: {top_tickers_text}
Committee memberships: {committees_text}

Write the summary now:"""

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()


async def get_or_generate_summary(
    politician_id: str,
    db: AsyncSession,
    redis,
) -> dict:
    """Return cached summary or generate a fresh one."""
    cache_key = f"ai:summary:{politician_id}"
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    summary_text = await generate_summary(politician_id, db)
    if not summary_text:
        return {"summary": None, "generated_at": None}

    payload = {
        "summary": summary_text,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    await redis.setex(cache_key, SUMMARY_CACHE_TTL, json.dumps(payload))
    return payload
