"""Natural language Q&A over congressional trading data using Claude tool use."""
from __future__ import annotations

import json
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an AI assistant for Stock Act Watch, a transparency site that tracks public stock trading disclosures by US Congress members under the STOCK Act.

You have tools that query a live database of ~19,000 congressional trades. When a user asks a question:
1. Use exactly ONE tool call to retrieve the relevant data.
2. Write a clear, structured answer based only on what the data shows.
3. Be factual and objective — never speculate about criminal intent or make legal accusations.
4. A high suspicion score (1-10) means a trade has characteristics associated with potential conflicts of interest (committee overlap, late filing, proximity to hearings, trade size). It is NOT an accusation.
5. If the data returns empty results, say so clearly.

Formatting rules:
- Lead with a brief summary sentence.
- Use markdown freely: bullet lists, bold, tables — the response is rendered as markdown.
- For lists of people or trades, a markdown table with columns (Politician, Party, Chamber, Notes) is ideal.
- Keep answers concise, under 250 words.

Trades go back to ~2012. Suspicion scores are 1–10."""

TOOLS = [
    {
        "name": "filter_trades",
        "description": (
            "Search and filter congressional stock trades. Use this for most questions: "
            "which politicians have high suspicion scores, who bought/sold a specific stock, "
            "trades by party/chamber, trades near committee hearings, etc."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "min_suspicion_score": {
                    "type": "integer",
                    "description": "Minimum suspicion score (1-10). Use to find flagged/suspicious trades.",
                },
                "max_suspicion_score": {
                    "type": "integer",
                    "description": "Maximum suspicion score (1-10).",
                },
                "ticker": {
                    "type": "string",
                    "description": "Stock ticker symbol (e.g. NVDA, AAPL, MSFT).",
                },
                "politician_name": {
                    "type": "string",
                    "description": "Partial politician name match (e.g. 'Pelosi', 'Smith').",
                },
                "transaction_type": {
                    "type": "string",
                    "enum": ["Purchase", "Sale"],
                    "description": "Filter to only buys (Purchase) or only sells (Sale).",
                },
                "party": {
                    "type": "string",
                    "enum": ["Democrat", "Republican", "Independent"],
                },
                "chamber": {
                    "type": "string",
                    "enum": ["House", "Senate"],
                },
                "date_from": {
                    "type": "string",
                    "description": "Start date YYYY-MM-DD.",
                },
                "date_to": {
                    "type": "string",
                    "description": "End date YYYY-MM-DD.",
                },
                "has_committee_overlap": {
                    "type": "boolean",
                    "description": "Only trades where the politician's committee oversees the traded sector.",
                },
                "has_near_hearing": {
                    "type": "boolean",
                    "description": "Only trades that occurred within 30 days of a relevant committee hearing.",
                },
                "min_amount": {
                    "type": "integer",
                    "description": "Minimum trade amount (lower bound in dollars).",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max results to return (default 20, max 50).",
                },
            },
        },
    },
    {
        "name": "get_leaderboard",
        "description": (
            "Get politicians ranked by estimated trading returns or by trade count. "
            "Use for 'who performs best', 'who trades most', 'most active' questions."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "metric": {
                    "type": "string",
                    "enum": ["returns", "volume"],
                    "description": "'returns' = best estimated return %, 'volume' = most trades filed.",
                },
                "party": {
                    "type": "string",
                    "enum": ["Democrat", "Republican", "Independent"],
                },
                "chamber": {
                    "type": "string",
                    "enum": ["House", "Senate"],
                },
                "limit": {
                    "type": "integer",
                    "description": "Number of politicians to return (default 10, max 25).",
                },
            },
            "required": ["metric"],
        },
    },
    {
        "name": "get_ticker_summary",
        "description": (
            "Get a summary of all congressional trading for a specific stock ticker. "
            "Use for 'who has traded NVDA?', 'how much Congress activity in Apple?' questions."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {
                    "type": "string",
                    "description": "Stock ticker symbol (e.g. NVDA, AAPL, MSFT).",
                },
            },
            "required": ["ticker"],
        },
    },
]


async def _run_filter_trades(db: AsyncSession, params: dict) -> list[dict]:
    from sqlalchemy import and_, select

    from app.models.politician import Politician
    from app.models.trade import Trade

    conditions = []
    if params.get("min_suspicion_score") is not None:
        conditions.append(Trade.suspicion_score >= int(params["min_suspicion_score"]))
    if params.get("max_suspicion_score") is not None:
        conditions.append(Trade.suspicion_score <= int(params["max_suspicion_score"]))
    if params.get("ticker"):
        conditions.append(Trade.ticker == params["ticker"].upper())
    if params.get("politician_name"):
        conditions.append(Politician.full_name.ilike(f"%{params['politician_name']}%"))
    if params.get("transaction_type"):
        conditions.append(Trade.transaction_type == params["transaction_type"])
    if params.get("party"):
        conditions.append(Politician.party == params["party"])
    if params.get("chamber"):
        conditions.append(Politician.chamber == params["chamber"])
    if params.get("date_from"):
        conditions.append(Trade.trade_date >= params["date_from"])
    if params.get("date_to"):
        conditions.append(Trade.trade_date <= params["date_to"])
    if params.get("min_amount"):
        conditions.append(Trade.amount_lower >= int(params["min_amount"]))
    if params.get("has_committee_overlap"):
        conditions.append(Trade.suspicion_flags.contains("committee_overlap"))
    if params.get("has_near_hearing"):
        conditions.append(Trade.suspicion_flags.contains("near_hearing"))

    limit = min(int(params.get("limit", 20)), 50)

    stmt = (
        select(Trade, Politician)
        .join(Politician, Trade.politician_id == Politician.id)
        .order_by(Trade.suspicion_score.desc().nulls_last(), Trade.trade_date.desc())
        .limit(limit)
    )
    if conditions:
        stmt = stmt.where(and_(*conditions))

    rows = (await db.execute(stmt)).all()
    return [
        {
            "politician": pol.full_name,
            "party": pol.party,
            "chamber": pol.chamber,
            "ticker": trade.ticker,
            "type": trade.transaction_type,
            "date": str(trade.trade_date),
            "amount": trade.amount_range_raw,
            "suspicion_score": trade.suspicion_score,
            "suspicion_flags": trade.suspicion_flags,
            "politician_id": str(pol.id),
        }
        for trade, pol in rows
    ]


async def _run_get_leaderboard(db: AsyncSession, params: dict) -> list[dict]:
    from sqlalchemy import func, select

    from app.models.computed_return import ComputedReturn
    from app.models.politician import Politician
    from app.models.trade import Trade

    metric = params.get("metric", "volume")
    limit = min(int(params.get("limit", 10)), 25)
    party_filter = params.get("party")
    chamber_filter = params.get("chamber")

    if metric == "returns":
        stmt = (
            select(
                Politician.full_name,
                Politician.party,
                Politician.chamber,
                func.avg(ComputedReturn.return_pct).label("avg_return"),
                func.count(ComputedReturn.trade_id).label("trade_count"),
            )
            .join(Trade, ComputedReturn.trade_id == Trade.id)
            .join(Politician, Trade.politician_id == Politician.id)
            .group_by(Politician.id, Politician.full_name, Politician.party, Politician.chamber)
            .having(func.count(ComputedReturn.trade_id) >= 3)
            .order_by(func.avg(ComputedReturn.return_pct).desc())
            .limit(limit)
        )
        if party_filter:
            stmt = stmt.where(Politician.party == party_filter)
        if chamber_filter:
            stmt = stmt.where(Politician.chamber == chamber_filter)
        rows = (await db.execute(stmt)).all()
        return [
            {
                "politician": r.full_name,
                "party": r.party,
                "chamber": r.chamber,
                "avg_return_pct": round(float(r.avg_return), 1),
                "trade_count": r.trade_count,
            }
            for r in rows
        ]

    else:  # volume
        stmt = (
            select(
                Politician.full_name,
                Politician.party,
                Politician.chamber,
                func.count(Trade.id).label("trade_count"),
            )
            .join(Trade, Trade.politician_id == Politician.id)
            .group_by(Politician.id, Politician.full_name, Politician.party, Politician.chamber)
            .order_by(func.count(Trade.id).desc())
            .limit(limit)
        )
        if party_filter:
            stmt = stmt.where(Politician.party == party_filter)
        if chamber_filter:
            stmt = stmt.where(Politician.chamber == chamber_filter)
        rows = (await db.execute(stmt)).all()
        return [
            {
                "politician": r.full_name,
                "party": r.party,
                "chamber": r.chamber,
                "trade_count": r.trade_count,
            }
            for r in rows
        ]


async def _run_get_ticker_summary(db: AsyncSession, params: dict) -> dict:
    from sqlalchemy import func, select

    from app.models.politician import Politician
    from app.models.ticker_info import TickerInfo
    from app.models.trade import Trade

    ticker = params["ticker"].upper()

    total_stmt = (
        select(
            func.count(Trade.id).label("total"),
        )
        .where(Trade.ticker == ticker)
    )
    total_row = (await db.execute(total_stmt)).one_or_none()

    top_stmt = (
        select(
            Politician.full_name,
            Politician.party,
            func.count(Trade.id).label("trade_count"),
        )
        .join(Trade, Trade.politician_id == Politician.id)
        .where(Trade.ticker == ticker)
        .group_by(Politician.id, Politician.full_name, Politician.party)
        .order_by(func.count(Trade.id).desc())
        .limit(10)
    )
    top_rows = (await db.execute(top_stmt)).all()

    ticker_info = await db.get(TickerInfo, ticker)
    return {
        "ticker": ticker,
        "company_name": ticker_info.company_name if ticker_info else None,
        "total_trades": total_row.total if total_row else 0,
        "top_traders": [
            {"politician": r.full_name, "party": r.party, "trades": r.trade_count}
            for r in top_rows
        ],
    }


async def answer_question(question: str, db: AsyncSession) -> dict:
    """Answer a natural language question using Claude tool use.

    Returns dict with keys: answer, results (list|None), tool_used (str|None).
    """
    if not settings.ANTHROPIC_API_KEY:
        return {
            "answer": "AI features are not configured on this server.",
            "results": None,
            "tool_used": None,
        }

    try:
        import ssl

        import anthropic
        import httpx
        import truststore

        truststore.inject_into_ssl()
        ssl_ctx = ssl.create_default_context()
        client = anthropic.AsyncAnthropic(
            api_key=settings.ANTHROPIC_API_KEY,
            http_client=httpx.AsyncClient(verify=ssl_ctx),
        )

        # Turn 1: Claude picks a tool
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=[{"role": "user", "content": question}],
        )

        tool_block = next((b for b in response.content if b.type == "tool_use"), None)
        results: list[dict] | dict | None = None
        tool_name: str | None = None

        if tool_block:
            tool_name = tool_block.name
            tool_input = tool_block.input

            if tool_name == "filter_trades":
                results = await _run_filter_trades(db, tool_input)
            elif tool_name == "get_leaderboard":
                results = await _run_get_leaderboard(db, tool_input)
            elif tool_name == "get_ticker_summary":
                results = await _run_get_ticker_summary(db, tool_input)

            # Turn 2: Claude writes the final answer with data in hand
            final = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=512,
                system=SYSTEM_PROMPT,
                messages=[
                    {"role": "user", "content": question},
                    {"role": "assistant", "content": response.content},
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "tool_result",
                                "tool_use_id": tool_block.id,
                                "content": json.dumps(results, default=str),
                            }
                        ],
                    },
                ],
            )
            answer = final.content[0].text if final.content else "No answer generated."
            log.info(
                "ask tokens — turn1: in=%d out=%d | turn2: in=%d out=%d | total: %d",
                response.usage.input_tokens,
                response.usage.output_tokens,
                final.usage.input_tokens,
                final.usage.output_tokens,
                response.usage.input_tokens + response.usage.output_tokens
                + final.usage.input_tokens + final.usage.output_tokens,
            )
        else:
            # Claude answered directly (meta question, out-of-scope, etc.)
            answer = response.content[0].text if response.content else "No answer generated."
            log.info(
                "ask tokens (direct) — in=%d out=%d",
                response.usage.input_tokens,
                response.usage.output_tokens,
            )

        # Normalise results to list for the frontend table
        if isinstance(results, dict):
            # ticker_summary returns a dict — pull top_traders out as the table data
            table_rows = results.get("top_traders") or []
        elif isinstance(results, list):
            table_rows = results
        else:
            table_rows = None

        return {
            "answer": answer,
            "results": table_rows,
            "tool_used": tool_name,
        }

    except Exception as e:
        log.error("answer_question failed: %s — %s", type(e).__name__, e, exc_info=True)
        return {
            "answer": "Sorry, something went wrong while processing your question. Please try again.",
            "results": None,
            "tool_used": None,
        }
