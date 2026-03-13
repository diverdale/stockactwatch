---
phase: 05-sector-dashboard
plan: "02"
subsystem: api
tags: [fastapi, redis, sqlalchemy, pydantic, cache-aside]

# Dependency graph
requires:
  - phase: 05-sector-dashboard plan 01
    provides: ticker_meta table, TickerMeta ORM model, fetch_and_store_ticker_meta function
  - phase: 02-api-layer
    provides: Redis cache-aside pattern (get/setex), get_redis dependency, get_db dependency

provides:
  - GET /sectors endpoint — sector overview list with aggregated trade counts and sentiment
  - GET /sectors/{slug} endpoint — sector detail with top 10 tickers, top 10 politicians, monthly trend
  - POST /internal/backfill-sector-meta — one-shot enrichment for historical tickers missing ticker_meta rows
  - sectors_router included in main.py FastAPI app

affects:
  - 05-03 (frontend sector pages will call these endpoints)
  - ingestion pipeline (backfill-sector-meta is a one-shot admin operation)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Redis cache-aside with sectors:overview and sectors:detail:{slug} keys (600s TTL)
    - TickerMeta JOIN Trade with sector IS NOT NULL filter to exclude ETFs/options
    - Request-header-based INTERNAL_SECRET auth on backfill endpoint (hmac.compare_digest)
    - Inline deferred imports (sqlalchemy text, fetch_and_store_ticker_meta) in backfill handler

key-files:
  created:
    - backend/app/api/sectors.py
  modified:
    - backend/app/api/internal.py
    - backend/app/main.py

key-decisions:
  - "SectorDetailResponse cached=True deserialization uses **data spread then overrides cached=True — avoids rebuilding sub-models individually"
  - "backfill-sector-meta reads X-Internal-Secret from request.headers (not FastAPI Header()) — allows reuse of existing hmac.compare_digest pattern with manual header extraction"
  - "fetch_and_store_ticker_meta imported inline in backfill handler — avoids circular import risk and keeps startup import surface minimal"

patterns-established:
  - "Sector queries always filter TickerMeta.sector.is_not(None) — ETFs and options stored with sector=NULL per Plan 01 decision"
  - "date_trunc('month', Trade.trade_date) returns datetime via asyncpg — use .strftime('%Y-%m') for consistent YYYY-MM string output"

requirements-completed:
  - SECT-01
  - SECT-03
  - SECT-04

# Metrics
duration: 3min
completed: 2026-03-13
---

# Phase 5 Plan 02: Sector API Endpoints Summary

**FastAPI sector endpoints with Redis cache-aside (600s TTL) — GET /sectors overview, GET /sectors/{slug} detail with trend/top-tickers/top-politicians, and POST /internal/backfill-sector-meta for historical enrichment**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-13T19:03:50Z
- **Completed:** 2026-03-13T19:06:10Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Built `backend/app/api/sectors.py` with GET /sectors and GET /sectors/{slug} — both with Redis cache-aside using `sectors:overview` and `sectors:detail:{slug}` keys at 600s TTL
- Implemented all Pydantic response models (SectorEntry, SectorOverviewResponse, TopTicker, TopPolitician, SectorTrendPoint, SectorDetailResponse) with `cached: bool` field
- Added POST /internal/backfill-sector-meta to internal.py — finds all trades.ticker not yet in ticker_meta and calls fetch_and_store_ticker_meta, protected by X-Internal-Secret header
- Wired sectors_router into main.py — all three routes confirmed: /internal/backfill-sector-meta, /sectors, /sectors/{slug}

## Task Commits

Each task was committed atomically:

1. **Task 1: Sector API router with overview and detail endpoints** - `eb6c649` (feat)
2. **Task 2: Backfill endpoint and main.py router include** - `c4ce927` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `backend/app/api/sectors.py` — Full sector router with SectorOverviewResponse and SectorDetailResponse, cache-aside pattern, _net_sentiment helper
- `backend/app/api/internal.py` — Added backfill_sector_meta endpoint; added Request, AsyncSession, get_db imports
- `backend/app/main.py` — Added sectors_router import and include_router call

## Decisions Made
- `SectorDetailResponse(**data, cached=True)` pattern used on cache hit — reconstructs full response from stored JSON dict in a single call, consistent with other endpoints in codebase
- `backfill-sector-meta` uses `request.headers.get("X-Internal-Secret")` rather than FastAPI `Header()` parameter — matches the pattern described in the plan and avoids exposing the secret in OpenAPI docs
- `fetch_and_store_ticker_meta` deferred import inside handler — avoids any circular import issues at startup

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing test failure in `test_normalizer.py::test_equity_trade_full_mapping` (ReportDate=None) — exists before this plan, unrelated to sectors implementation. Logged as pre-existing, not fixed (out-of-scope per scope boundary rules).

## User Setup Required
None - no external service configuration required. Endpoints will return `{"sectors": [], "total": 0, "cached": false}` until ticker_meta is populated via the `/internal/backfill-sector-meta` endpoint.

## Next Phase Readiness
- Both sector endpoints are live and ready for frontend consumption
- Redis cache keys populate on first request, warm reads return `cached: true` within 600s TTL
- Run `POST /internal/backfill-sector-meta` with correct X-Internal-Secret to populate ticker_meta for all historical trades before building the frontend sector pages

---
*Phase: 05-sector-dashboard*
*Completed: 2026-03-13*
