---
phase: 06-sector-depth
plan: "03"
subsystem: politician-sector-radar
tags: [backend, api, frontend, recharts, politician-profile, sector]
dependency_graph:
  requires:
    - "Phase 05 Plan 01: ticker_meta table with sector/sector_slug columns"
    - "Phase 02 Plan 03: GET /politicians/{id} profile endpoint"
  provides:
    - "GET /politicians/{id}/sectors endpoint"
    - "PoliticianSectorRadar client component"
  affects:
    - "frontend/app/politicians/[id]/page.tsx (sector radar added)"
tech_stack:
  added: []
  patterns:
    - "Cache-aside Redis pattern with 600s TTL"
    - "Additive server-side fetch with try/catch fallback"
    - "Direct Recharts RadarChart without shadcn ChartContainer"
key_files:
  created:
    - "frontend/components/politician-sector-radar.tsx"
  modified:
    - "backend/app/api/profile_ticker.py"
    - "frontend/lib/types.ts"
    - "frontend/app/politicians/[id]/page.tsx"
decisions:
  - "profile_ticker router has no prefix — route registered as /politicians/{id}/sectors directly on router"
  - "Additive fetch with try/catch in page.tsx — sector radar failure does not break politician profile page"
  - "PoliticianDashboard unchanged — radar added as wrapper in page.tsx only"
metrics:
  duration: "2 min"
  completed_date: "2026-03-13"
  tasks_completed: 2
  files_modified: 4
---

# Phase 06 Plan 03: Politician Sector Radar Summary

**One-liner:** GET /politicians/{id}/sectors endpoint with top-8 TickerMeta JOIN query + Recharts RadarChart client component on politician profile pages.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add GET /politicians/{id}/sectors backend endpoint | 33d9ea1 | backend/app/api/profile_ticker.py |
| 2 | PoliticianSectorRadar component and politician profile page integration | 44a2628 | frontend/lib/types.ts, frontend/components/politician-sector-radar.tsx, frontend/app/politicians/[id]/page.tsx |

## What Was Built

### Backend: GET /politicians/{id}/sectors

Added to `backend/app/api/profile_ticker.py`:

- **PoliticianSectorEntry** Pydantic model: `sector`, `sector_slug`, `trade_count`
- **PoliticianSectorsResponse** Pydantic model: `politician_id`, `sectors[]`, `cached`
- **GET /politicians/{politician_id}/sectors** endpoint: queries TickerMeta JOIN Trade, groups by sector, orders by trade_count desc, limits to 8 results
- Redis cache-aside at 600s using `politician:sectors:{id}` key
- Returns 200 with empty list if politician has no sector data (no 404 guard — profile endpoint already validates existence)

New imports added to profile_ticker.py: `json`, `pydantic.BaseModel`, `redis.asyncio.Redis`, `sqlalchemy.func`, `app.models.ticker_meta.TickerMeta`, `app.cache.get_redis`.

### Frontend: PoliticianSectorRadar Component

- **`frontend/lib/types.ts`**: Added `PoliticianSectorEntry` and `PoliticianSectorsResponse` TypeScript interfaces after existing sector types
- **`frontend/components/politician-sector-radar.tsx`**: Client component using direct Recharts imports (RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip, ResponsiveContainer) — no shadcn ChartContainer wrapper per project convention. Empty-state guard returns informational paragraph when sectors.length === 0.
- **`frontend/app/politicians/[id]/page.tsx`**: Server-side fetch of `/politicians/{id}/sectors` with try/catch fallback, renders `<PoliticianSectorRadar>` conditionally between `<Disclaimer>` and `<PoliticianDashboard>` — dashboard component unchanged.

## Verification Results

- `PYTHONPATH=. python -c "from app.api.profile_ticker import PoliticianSectorEntry; print('OK')"` — PASSED
- `grep "@router.get.*sectors"` — found at line 135
- `npx tsc --noEmit` — zero errors
- `grep "RadarChart"` in radar component — present
- `grep "ChartContainer"` in radar component — absent (correct)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED
