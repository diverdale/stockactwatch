---
phase: 06-sector-depth
plan: 01
subsystem: api
tags: [fastapi, pydantic, sqlalchemy, redis, sectors, industries]

# Dependency graph
requires:
  - phase: 05-sector-dashboard
    provides: sectors.py router, TickerMeta model with sector_slug/industry columns, SectorEntry/SectorDetailResponse models
provides:
  - is_trending field on SectorEntry (backward-compatible, default False)
  - _is_trending() helper function (30d vs 90d monthly average comparison)
  - GET /sectors/{slug}/industries endpoint with IndustryBreakdownResponse and Redis cache-aside at 600s
  - GET /sectors/{slug}/trades endpoint with SectorTradesResponse and Redis cache-aside at 600s
  - IndustryEntry, IndustryBreakdownResponse, SectorTrade, SectorTradesResponse Pydantic models
affects: [06-sector-depth frontend plans, any plan consuming GET /sectors or GET /sectors/{slug}/industries or GET /sectors/{slug}/trades]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route ordering: sub-path routes (/{slug}/industries, /{slug}/trades) registered before catch-all (/{slug}) to prevent FastAPI route shadowing"
    - "Trending detection: 30d count vs 90d monthly average (count_90d / 3.0) with 2x threshold"
    - "Redis cache-aside with 600s TTL on all three sector endpoints using json.dumps(default=str)"

key-files:
  created: []
  modified:
    - backend/app/api/sectors.py

key-decisions:
  - "is_trending: bool = False default on SectorEntry — existing Redis-cached payloads without the field deserialize without validation errors on deploy"
  - "count_30d and count_90d added as SQL aggregations in the overview SELECT alongside existing columns — no separate query needed"
  - "/{slug}/industries and /{slug}/trades registered before /{slug} catch-all — FastAPI matches routes in registration order, sub-paths must come first"
  - "SectorTrade.amount_range_raw uses or-empty-string fallback — field is required str, None values from DB convert cleanly"

patterns-established:
  - "Sub-path routes before catch-all in FastAPI routers to prevent path shadowing"
  - "Cache payload serialized via model_dump() list comprehension before json.dumps — consistent with existing sector endpoints"

requirements-completed:
  - SECT-06
  - SECT-07
  - SECT-08

# Metrics
duration: 8min
completed: 2026-03-13
---

# Phase 6 Plan 01: Sector Depth Summary

**Three additive backend endpoints: industry sub-breakdown, individual trades export, and trending detection on sector overview — all with Redis cache-aside at 600s TTL**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-13T00:00:00Z
- **Completed:** 2026-03-13T00:08:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added `is_trending: bool = False` to `SectorEntry` with backward-compatible default for existing Redis cache
- Added `_is_trending()` helper: True when 30d trade count exceeds 2x the 90d monthly average
- Added `GET /sectors/{slug}/industries` returning industry breakdown with buy/sell counts per industry, grouped by `TickerMeta.industry`
- Added `GET /sectors/{slug}/trades` returning all individual trades for a sector with fields matching the feed CSV export
- All four new Pydantic models: `IndustryEntry`, `IndustryBreakdownResponse`, `SectorTrade`, `SectorTradesResponse`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add is_trending to SectorEntry and update overview query** - `18d2f65` (feat)
2. **Task 2: Add GET /sectors/{slug}/industries and GET /sectors/{slug}/trades endpoints** - `c024095` (feat)

## Files Created/Modified
- `backend/app/api/sectors.py` - Added `is_trending` field, `_is_trending()` helper, `count_30d`/`count_90d` aggregations in overview query, four new Pydantic models, and two new route handlers registered before `/{slug}` catch-all

## Decisions Made
- `is_trending: bool = False` as Pydantic field default — existing Redis-cached JSON blobs serialized without this field still deserialize cleanly on deploy without validation errors
- `count_30d` and `count_90d` computed in the same SQL aggregation as the existing overview columns — one query, no extra round trip
- New sub-path routes (`/{slug}/industries`, `/{slug}/trades`) placed before `/{slug}` catch-all in the router file — FastAPI matches routes in registration order, sub-paths must be registered first or requests like `/sectors/technology/industries` would match `/{slug}` with slug="technology/industries"

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `uv run python` required instead of bare `python` to access project virtualenv — resolved immediately, no impact on deliverables.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three backend data endpoints ready for Phase 6 frontend consumption
- `GET /sectors` now includes `is_trending` per sector for trending badges on the overview page
- `GET /sectors/{slug}/industries` ready for industry breakdown charts/tables on sector detail page
- `GET /sectors/{slug}/trades` ready for CSV export and detailed trade tables on sector detail page
- No blockers for Phase 6 frontend plans

---
*Phase: 06-sector-depth*
*Completed: 2026-03-13*
