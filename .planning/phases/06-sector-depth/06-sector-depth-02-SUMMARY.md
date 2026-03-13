---
phase: 06-sector-depth
plan: 02
subsystem: ui
tags: [nextjs, typescript, react, csv-export, route-handler, proxy]

# Dependency graph
requires:
  - phase: 06-sector-depth plan 01
    provides: GET /sectors/{slug}/industries, GET /sectors/{slug}/trades, is_trending on SectorEntry
provides:
  - is_trending badge on sectors overview page
  - SectorIndustryBreakdown component with mini-bar chart
  - SectorCsvExport client component fetching via proxy Route Handler
  - Route Handler proxy at /api/sectors/[slug]/trades -> FastAPI
  - Sector detail page renders industry breakdown and CSV export button
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Route Handler proxy pattern (client fetches /api/sectors/[slug]/trades, Next.js server proxies to FastAPI API_URL)
    - Optional server-side fetch with try/catch for additive sections (industries endpoint)

key-files:
  created:
    - frontend/components/sector-industry-breakdown.tsx
    - frontend/components/sector-csv-export.tsx
    - frontend/app/api/sectors/[slug]/trades/route.ts
  modified:
    - frontend/lib/types.ts
    - frontend/app/sectors/page.tsx
    - frontend/app/sectors/[slug]/page.tsx

key-decisions:
  - "SectorCsvExport fetches /api/sectors/[slug]/trades (proxy Route Handler) not process.env.API_URL directly — client components cannot access server-only env vars"
  - "Industries fetch in detail page wrapped in try/catch — industry breakdown is additive, page renders without it on fetch failure"

patterns-established:
  - "CSV export pattern: client component -> proxy Route Handler -> FastAPI; same pattern as feed-csv-export.tsx"
  - "Additive server fetch pattern: try/catch around optional endpoint fetches in server components"

requirements-completed:
  - SECT-07
  - SECT-08
  - SECT-09

# Metrics
duration: 2min
completed: 2026-03-13
---

# Phase 6 Plan 02: Sector Depth Frontend Summary

**Trending badge on overview, industry mini-bar breakdown, and CSV download button wired to all three Phase 6 backend endpoints via Route Handler proxy**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-13T00:29:38Z
- **Completed:** 2026-03-13T00:31:58Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added `is_trending: boolean` to `SectorEntry` and four new Phase 6 types to `lib/types.ts`
- Rendered orange "trending" badge on sectors overview for `is_trending=true` sectors
- Created `SectorIndustryBreakdown` client component with relative mini-bar chart per industry
- Created `SectorCsvExport` client component that fetches via proxy Route Handler and triggers file download
- Created Route Handler proxy at `/api/sectors/[slug]/trades` forwarding to FastAPI `GET /sectors/{slug}/trades`
- Updated sector detail page to fetch industries server-side and render both new components

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Phase 6 types and trending badge on overview** - `70647ea` (feat)
2. **Task 2: Industry breakdown component, CSV export component, Route Handler proxy, and detail page integration** - `f3edc4c` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `frontend/lib/types.ts` - Added `is_trending` to `SectorEntry`; added `IndustryEntry`, `IndustryBreakdownResponse`, `SectorTrade`, `SectorTradesResponse`
- `frontend/app/sectors/page.tsx` - Trending badge rendered when `is_trending=true`
- `frontend/components/sector-industry-breakdown.tsx` - Client component: industry table with relative bar chart, buy/sell counts
- `frontend/components/sector-csv-export.tsx` - Client component: fetches proxy Route Handler, builds CSV, triggers download
- `frontend/app/api/sectors/[slug]/trades/route.ts` - Route Handler proxy: `/api/sectors/[slug]/trades` -> FastAPI
- `frontend/app/sectors/[slug]/page.tsx` - Imports and renders `SectorCsvExport` and `SectorIndustryBreakdown`; server-side industries fetch with try/catch

## Decisions Made
- `SectorCsvExport` fetches the proxy Route Handler (`/api/sectors/...`) not `process.env.API_URL` directly — client components cannot access server-only env vars; same pattern established in Phase 4 search.
- Industries fetch in the sector detail page is wrapped in `try/catch` so a missing or failed response does not 404 the whole page — breakdown is additive.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 6 frontend features are complete: trending badges, industry breakdown, CSV export
- Phase 6 is fully wired end-to-end: backend (Plan 01) + frontend (Plans 02 and 03)
- No blockers for launch

---
*Phase: 06-sector-depth*
*Completed: 2026-03-13*
