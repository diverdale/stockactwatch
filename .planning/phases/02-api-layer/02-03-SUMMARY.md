---
phase: 02-api-layer
plan: "03"
subsystem: api
tags: [feed, pagination, politician-profile, ticker, pydantic, sqlalchemy]
dependency_graph:
  requires: ["02-01", "02-02"]
  provides: ["feed-endpoint", "politician-profile-endpoint", "ticker-endpoint"]
  affects: ["03-frontend"]
tech_stack:
  added: []
  patterns:
    - "Multi-entity SQLAlchemy 2.0 JOIN with row[0]/row[1] destructuring"
    - "Annotated Query params for ge/le validation -> 422 on invalid limit"
    - "outerjoin for optional ComputedReturn in politician profile"
    - "try/except ValueError for UUID path param -> 422 HTTPException"
key_files:
  created:
    - backend/app/schemas/feed.py
    - backend/app/api/feed.py
    - backend/app/api/profile_ticker.py
  modified:
    - backend/app/main.py
decisions:
  - "result.all() (not scalars()) for multi-entity JOIN queries — rows contain both Trade and Politician"
  - "trade, pol = row destructuring for feed and ticker endpoints; row[0]/row[1] for profile endpoint with outerjoin"
  - "UUID parse wrapped in try/except ValueError returns 422 — consistent with FastAPI validation behavior"
  - "count query uses select(func.count(Trade.id)).join(...) with same WHERE — avoids subquery nesting"
metrics:
  duration: "~2 min"
  completed: "2026-03-13"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 2 Plan 03: Feed, Profile, and Ticker Endpoints Summary

**One-liner:** Read-only paginated feed and profile/ticker query endpoints with Pydantic-typed responses, offset pagination, and validated query parameters.

## Endpoints Added

| Endpoint | Router | Response Model |
|----------|--------|----------------|
| `GET /feed` | `app/api/feed.py` | `FeedResponse` (paginated `FeedEntry` list) |
| `GET /politicians/{politician_id}` | `app/api/profile_ticker.py` | `PoliticianProfile` (with `TradeEntry` list + avg_return_pct) |
| `GET /tickers/{ticker}` | `app/api/profile_ticker.py` | `TickerTrades` (with `TickerTradeEntry` list) |

## Response Shapes

**FeedResponse**
```
{ entries: FeedEntry[], total: int, limit: int, offset: int }
FeedEntry: trade_id, politician_id, full_name, chamber, party, ticker,
           asset_type, transaction_type, trade_date, disclosure_date,
           amount_range_raw, amount_lower, amount_upper, return_calculable
```

**PoliticianProfile**
```
{ politician_id, full_name, chamber, party, state, total_trades, trades: TradeEntry[] }
TradeEntry: trade_id, ticker, asset_type, transaction_type, trade_date, disclosure_date,
            amount_range_raw, amount_lower, amount_upper, return_calculable, avg_return_pct
```

**TickerTrades**
```
{ ticker, total_trades, trades: TickerTradeEntry[] }
TickerTradeEntry: trade_id, politician_id, full_name, chamber, party,
                  transaction_type, trade_date, disclosure_date,
                  amount_range_raw, amount_lower, amount_upper
```

## Parameter Validation

- `GET /feed`: `limit` validated `ge=1, le=100` — `limit=0` or `limit=999` returns 422
- `GET /politicians/{politician_id}`: UUID parse in try/except — invalid UUID returns 422, missing politician returns 404
- `GET /tickers/{ticker}`: ticker uppercased before query — returns empty trades list (not 404) for unknown ticker

## Implementation Notes

- Feed count uses a separate `select(func.count(Trade.id)).join(...)` query with the same WHERE clause
- Politician profile uses `outerjoin(ComputedReturn, ...)` so trades without computed returns still appear (`avg_return_pct=None`)
- All routers registered in `main.py` after existing leaderboard router — no existing includes removed

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

All created files confirmed on disk. Commits 131ca9d and 51409cc verified in git log.

## Verification Results

1. `python -m pytest tests/ -v` — 21/21 tests pass (no regressions)
2. `/leaderboard/returns` and `/leaderboard/volume` confirmed present in app.routes
3. `from app.schemas.feed import FeedResponse, PoliticianProfile, TickerTrades` — no errors
4. `from app.api.feed import router; from app.api.profile_ticker import router` — no errors
