# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-12)

**Core value:** Make congressional trading data so clear, current, and compelling that it becomes the go-to reference for anyone asking "what is Congress buying?"
**Current focus:** Phase 6 — Sector Depth

## Current Position

Phase: 6 of 6 (Sector Depth) — IN PROGRESS
Plan: 3 of 3 completed (politician sector radar)
Status: Phase 6 Plan 03 complete — GET /politicians/{id}/sectors endpoint + PoliticianSectorRadar component
Last activity: 2026-03-13 — Phase 6 Plan 03 complete (politician sector radar with Recharts RadarChart, server-side sectors fetch in profile page)

Progress: [██████████████████████] 100% (Phase 6 Plan 03 complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: 5 min
- Total execution time: 25 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-data-foundation | 4 | 20 min | 5 min |
| 02-api-layer | 3 | 13 min | 4.3 min |
| 03-frontend-core | 5 | 12 min | 2.4 min |
| 04-search-and-discoverability | 1 | 1 min | 1 min |

**Recent Trend:**
- Last 5 plans: 5 min
- Trend: consistent

*Updated after each plan completion*
| Phase 03-frontend-core P04 | 2 | 2 tasks | 3 files |
| Phase 04-search-and-discoverability P01 | 1 | 2 tasks | 5 files |
| Phase 04-search-and-discoverability P02 | 15 | 3 tasks | 13 files |
| Phase 05-sector-dashboard P01 | 1 | 2 tasks | 4 files |
| Phase 05-sector-dashboard P02 | 3 | 2 tasks | 3 files |
| Phase 05-sector-dashboard P03 | 1 | 2 tasks | 4 files |
| Phase 06-sector-depth P01 | 8 | 2 tasks | 1 files |
| Phase 06-sector-depth P03 | 2 | 2 tasks | 4 files |
| Phase 06-sector-depth P02 | 2 | 2 tasks | 6 files |

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
- [Phase 02-api-layer, Plan 03]: result.all() (not scalars()) for multi-entity JOIN queries — rows contain both Trade and Politician as tuple elements
- [Phase 02-api-layer, Plan 03]: UUID parse in politician profile wrapped in try/except ValueError -> 422 — consistent with FastAPI validation behavior
- [Phase 02-api-layer, Plan 03]: Ticker endpoint returns empty trades list (not 404) for unknown ticker — frontend handles gracefully
- [Phase 03-frontend-core, Plan 02]: NuqsAdapter wraps body children in app/layout.tsx — required for nuqs useQueryState hooks in App Router
- [Phase 03-frontend-core, Plan 02]: Chamber/party params forwarded to apiFetch; backend ignores them until Phase 4 extension adds support to GET /feed
- [Phase 03-frontend-core, Plan 02]: Date range filtering not implemented — backend GET /feed does not accept date_from/date_to in this phase
- [Phase 03-frontend-core, Plan 01]: revalidateTag() in Next.js 16 requires second profile argument — pass 'default' for standard cache invalidation
- [Phase 03-frontend-core, Plan 01]: All API fetches are server-side using API_URL env var (not NEXT_PUBLIC_) since no client-side data fetching
- [Phase 03-frontend-core, Plan 01]: shadcn/ui initialized with --defaults flag (Radix Nova preset) to bypass interactive prompts in CLI context
- [Phase 03-frontend-core, Plan 01]: Embedded .git created by create-next-app removed from frontend/ to prevent git submodule issues
- [Phase 03-frontend-core, Plan 05]: buildMonthlyData runs server-side in page component — chart data derivation stays server-side, TradingTimeline receives pre-computed TimelineDataPoint[]
- [Phase 03-frontend-core, Plan 05]: Ticker uppercased server-side before API call — normalizes /tickers/aapl and /tickers/AAPL to same backend request
- [Phase 03-frontend-core, Plan 03]: LEGAL-01 satisfied by rendering Disclaimer above table in page files, not per-row in table components
- [Phase 03-frontend-core, Plan 03]: ISR cache tags 'leaderboard-returns' and 'leaderboard-volume' match /api/revalidate/route.ts allowed set for on-demand invalidation
- [Phase 03-frontend-core]: Disclaimer renders between profile header and PoliticianMetrics to satisfy LEGAL-01 on all analysis pages
- [Phase 03-frontend-core]: PROF-04 committee assignments note as informational text in header — full data requires ProPublica integration (Phase 6 v2 concern)
- [Phase 03-frontend-core]: Options trades identified by return_calculable === false (not asset_type check) — consistent with Phase 1 TradeIn schema-level enforcement
- [Phase 04-search-and-discoverability, Plan 01]: word_similarity <% operator used (not similarity()) — handles partial matches like "pelosi" -> "Nancy Pelosi"; <% uses word_similarity_threshold not full-string threshold
- [Phase 04-search-and-discoverability, Plan 01]: ILIKE prefix for ticker search — 1-2 char tickers have no extractable trigrams so similarity() would miss them; ILIKE works for all lengths
- [Phase 04-search-and-discoverability, Plan 01]: CREATE EXTENSION placed first in migration upgrade() — GIN index creation fails with "type gtrgm does not exist" if extension not present
- [Phase 04-search-and-discoverability]: nuqs/server used in search-params.ts — parseAsString.withDefault not available in client nuqs server render context
- [Phase 04-search-and-discoverability]: Route Handler proxy pattern: client components fetch /api/search, Next.js server proxies to FastAPI — server-only API_URL never exposed to browser
- [Phase 04-search-and-discoverability, Plan 02]: PopoverTrigger rendered without asChild — base-ui PopoverPrimitive.Trigger has no asChild prop (unlike Radix); trigger styled directly with Tailwind classes
- [Phase 05-sector-dashboard, Plan 01]: trades.ticker widened from varchar(10) to varchar(20) in migration 0005 — option tickers can exceed 10 chars; ALTER included in same migration as ticker_meta creation
- [Phase 05-sector-dashboard, Plan 01]: sector_slug derived via Python slugify() in fetch_and_store_ticker_meta — avoids GENERATED ALWAYS AS complexity and keeps slug logic portable
- [Phase 05-sector-dashboard, Plan 01]: ETFs and options stored with sector=NULL in ticker_meta (not skipped) — ticker_meta row presence is required for all sector API queries regardless of equity type
- [Phase 04-search-and-discoverability, Plan 02]: feed page uses static metadata export — canonical is /feed regardless of filter state; filter state is transient pagination concern not SEO-relevant page identity
- [Phase 05-sector-dashboard]: SectorDetailResponse cached=True deserialization uses **data spread pattern — consistent with leaderboard endpoint cache hit pattern
- [Phase 05-sector-dashboard]: backfill-sector-meta uses request.headers.get for X-Internal-Secret — avoids exposing secret in FastAPI OpenAPI schema
- [Phase 05-sector-dashboard]: params in Next.js 16 dynamic routes is a Promise — await params before destructuring slug
- [Phase 05-sector-dashboard]: apiFetch second arg uses { tags, revalidate } shape (not { next: { revalidate, tags } }) — matched existing project pattern
- [Phase 05-sector-dashboard]: Raw ResponsiveContainer from recharts used directly in sector-trend-chart — project has no shadcn ChartContainer wrapper
- [Phase 06-sector-depth, Plan 01]: is_trending: bool = False default on SectorEntry — existing Redis-cached payloads without the field deserialize without validation errors on deploy
- [Phase 06-sector-depth, Plan 01]: count_30d and count_90d added as SQL aggregations in the overview SELECT — no separate query needed for trending computation
- [Phase 06-sector-depth, Plan 01]: /{slug}/industries and /{slug}/trades registered before /{slug} catch-all — FastAPI matches routes in registration order, sub-paths must come first
- [Phase 06-sector-depth, Plan 03]: profile_ticker router has no prefix — GET /politicians/{id}/sectors registered directly on router without prefix
- [Phase 06-sector-depth, Plan 03]: Sector fetch in page.tsx wrapped in try/catch — sector radar is additive, profile page renders without it on fetch failure
- [Phase 06-sector-depth, Plan 03]: PoliticianDashboard unchanged — PoliticianSectorRadar rendered as additive wrapper in page.tsx only
- [Phase 06-sector-depth]: SectorCsvExport fetches /api/sectors/[slug]/trades proxy Route Handler — client components cannot access server-only API_URL env var
- [Phase 06-sector-depth]: Industries fetch in sector detail page wrapped in try/catch — breakdown is additive, page renders without it on fetch failure

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 1: Quiver Quantitative API tier and rate limits unconfirmed — may affect ingestion interval and historical data depth
- Phase 1: Price data source for returns unconfirmed (yfinance currently for local dev, FMP/Polygon.io for production) — PriceClient ABC is in place, FMPPriceClient needed before launch
- Phase 1: Commercial use rights from Quiver Quantitative / Capitol Trades need written confirmation before launch
- Phase 6 (v2): Committee assignment data not in Quiver/Capitol Trades APIs — requires separate ProPublica or Congress.gov integration

## Session Continuity

Last session: 2026-03-13
Stopped at: Completed 06-01-PLAN.md — GET /sectors/{slug}/industries, GET /sectors/{slug}/trades, is_trending on SectorEntry. Phase 6 Plan 01 complete (executed retroactively after Plans 02/03).
Resume file: None
