# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-12)

**Core value:** Make congressional trading data so clear, current, and compelling that it becomes the go-to reference for anyone asking "what is Congress buying?"
**Current focus:** Phase 2 — API Layer

## Current Position

Phase: 2 of 4 (API Layer) — IN PROGRESS
Plan: 2 of 3 completed (Redis cache-aside layer and ISR invalidation endpoint)
Status: Phase 2 Plan 02 complete
Last activity: 2026-03-13 — Phase 2 Plan 02 complete (21 tests passing, Redis cache-aside live)

Progress: [████████░░] 43% (Phase 1 complete + Phase 2 Plans 01-02 complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: 5 min
- Total execution time: 20 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-data-foundation | 4 | 20 min | 5 min |
| 02-api-layer | 2 | 11 min | 5.5 min |

**Recent Trend:**
- Last 5 plans: 5 min
- Trend: consistent

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-planning]: Returns methodology must be locked and documented before any leaderboard code is written — decision cascades through all ranking features
- [Pre-planning]: Verify Quiver Quantitative API tier access and commercial use rights before committing to ingestion schedule
- [Pre-planning]: Deployment target (Railway vs Vercel serverless) must be decided before Phase 1 — APScheduler is incompatible with multiple FastAPI instances
- [Phase 01-data-foundation]: Deployment target: railway-single — APScheduler AsyncIOScheduler runs in-process with one uvicorn worker
- [Phase 01-data-foundation]: register_jobs deferred import inside lifespan so main.py is importable before Plan 01-03 creates the scheduler module
- [Phase 01-data-foundation, Plan 01b]: GENERATED ALWAYS AS columns (filing_lag_days, amount_midpoint) defined only in migration — not in ORM model — to avoid SQLAlchemy writing to read-only generated columns
- [Phase 01-data-foundation, Plan 01b]: Alembic env.py reads DATABASE_URL from .env directly via dotenv_values to bypass shell env var precedence (avoids ambient DATABASE_URL conflict)
- [Phase 01-data-foundation, Plan 02]: Vendor field isolation enforced structurally — normalize_quiver_trade() is the sole function knowing Quiver field names; grep verification passes with zero matches outside normalizer.py
- [Phase 01-data-foundation, Plan 02]: AMOUNT_RANGES as dict (not regex) because STOCK Act ranges are a closed enumerated set
- [Phase 01-data-foundation, Plan 02]: model_validator on TradeIn enforces LEGAL-02 at schema level — options always have return_calculable=False regardless of caller input
- [Phase 01-data-foundation, Plan 03]: BATCH_SIZE=500 for upsert chunking — 20 columns x 500 rows = 10,000 params, safely under PostgreSQL 32,767 bind parameter limit
- [Phase 01-data-foundation, Plan 03]: hmac.compare_digest for INTERNAL_SECRET comparison — timing-safe, prevents secret leakage via response latency
- [Phase 01-data-foundation, Plan 03]: IngestionLog written in finally block — every pipeline execution produces a log row regardless of success or failure
- [Phase 01-data-foundation, Plan 04]: SELECT + INSERT or UPDATE pattern for ComputedReturn upsert — cross-dialect, enables SQLite in-memory testing while preserving idempotency
- [Phase 01-data-foundation, Plan 04]: Explicit uuid.uuid4() on ComputedReturn.id in pipeline code — server_default gen_random_uuid() is PG-only; Python-side UUID generation is portable
- [Phase 01-data-foundation, Plan 04]: yfinance as local-dev-only PriceClient — rate limited in production, FMPPriceClient deferred to pre-launch, marked with module-level PRODUCTION comment
- [Phase 01-data-foundation, Plan 04]: ^GSPC always fetched in fetch_and_store_prices — benchmark data required for all returns computations regardless of tickers list
- [Phase 02-api-layer, Plan 01]: Standalone async query functions (not embedded in route handlers) for leaderboard — enables direct unit testing without HTTP overhead
- [Phase 02-api-layer, Plan 01]: Test-specific SQLite-safe ORM-mapped classes with monkeypatching for leaderboard unit tests — avoids postgresql.UUID DDL incompatibility in SQLite in-memory DB
- [Phase 02-api-layer, Plan 01]: dispose_engine() async function added to db.py — fixes broken engine import from Phase 1 lazy-init refactor (engine was renamed to _engine but main.py was not updated)
- [Phase 02-api-layer, Plan 01]: volume_cache_key uses ch= and p= prefixes — prevents collision when chamber and party arguments are swapped
- [Phase 02-api-layer, Plan 02]: redis.asyncio (redis-py 7.x) used directly — aioredis is deprecated since redis-py 4.2.0
- [Phase 02-api-layer, Plan 02]: Redis keys deleted BEFORE Next.js ISR webhook call — prevents Next.js from re-caching stale data from a warm Redis key
- [Phase 02-api-layer, Plan 02]: Module-level _pool pattern for Redis connection pool — simpler ownership model, pool lifecycle tied to lifespan
- [Phase 02-api-layer, Plan 02]: json.dumps with default=str for all Redis writes — handles Decimal avg_return_pct and UUID values without custom serializers

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 1: Quiver Quantitative API tier and rate limits unconfirmed — may affect ingestion interval and historical data depth
- Phase 1: Price data source for returns unconfirmed (yfinance currently for local dev, FMP/Polygon.io for production) — PriceClient ABC is in place, FMPPriceClient needed before launch
- Phase 1: Commercial use rights from Quiver Quantitative / Capitol Trades need written confirmation before launch
- Phase 6 (v2): Committee assignment data not in Quiver/Capitol Trades APIs — requires separate ProPublica or Congress.gov integration

## Session Continuity

Last session: 2026-03-13
Stopped at: Phase 2 Plan 02 complete. 21/21 passing tests. Redis cache-aside live on both leaderboard endpoints. POST /internal/revalidate-isr endpoint live. Ready for Plan 02-03.
Resume file: None
