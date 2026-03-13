---
phase: 03-frontend-core
plan: "04"
subsystem: ui
tags: [next.js, tanstack-table, shadcn, react, typescript, ssr]

# Dependency graph
requires:
  - phase: 03-01
    provides: apiFetch, types (PoliticianProfile, TradeEntry), shadcn/ui components, Disclaimer

provides:
  - Politician profile page at /politicians/[id] with ISR (Server Component)
  - PoliticianMetrics client component with summary cards
  - TradeTable client component with TanStack Table sort and ticker filter

affects:
  - 04-deployment
  - any phase testing politician profile rendering

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dynamic route Server Component with Promise<params> pattern for Next.js 16"
    - "TanStack Table v8 with getSortedRowModel + getFilteredRowModel for client-side sort/filter"
    - "notFound() in catch block to convert API 404 into Next.js 404 page"
    - "computeTopAssetTypes: derive top 3 asset types by grouping trades by asset_type client-side"

key-files:
  created:
    - frontend/app/politicians/[id]/page.tsx
    - frontend/components/politician-metrics.tsx
    - frontend/components/trade-table.tsx
  modified: []

key-decisions:
  - "Disclaimer renders between profile header and PoliticianMetrics to satisfy LEGAL-01 on all analysis pages showing estimated returns"
  - "Committee assignments note rendered as informational text in header — PROF-04 partial delivery; full data requires ProPublica/Congress.gov integration (Phase 6 v2)"
  - "Options trades show 'not calculable' badge via return_calculable === false check, not asset_type check"
  - "computeTopAssetTypes derived client-side from profile.trades — no separate API call needed"

patterns-established:
  - "Client Components that consume PoliticianProfile import from @/lib/types, not from page props"
  - "TanStack Table column filters use state array pattern: columnFilters: tickerFilter ? [{id, value}] : []"

requirements-completed:
  - PROF-01
  - PROF-02
  - PROF-03
  - PROF-04
  - LEGAL-01

# Metrics
duration: 2min
completed: 2026-03-13
---

# Phase 3 Plan 04: Politician Profile Page Summary

**Politician profile page at /politicians/[id] with ISR, PoliticianMetrics cards (avg return, top asset types), and TanStack Table trade history with sort/filter — LEGAL-01 Disclaimer above metrics**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-13T12:09:25Z
- **Completed:** 2026-03-13T12:10:57Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- PoliticianMetrics Client Component with 4 summary cards: total trades, est. avg return (N/A when no calculable returns), options trade count, top 3 asset types with counts
- TradeTable Client Component using TanStack Table v8 with column sorting (trade_date, ticker, transaction_type, amount_range_raw) and ticker text filter — options trades show "not calculable" badge
- Politician profile Server Component with Next.js 16 Promise params pattern, ISR revalidate=3600, notFound() on API errors, LEGAL-01 Disclaimer above metrics, PROF-04 committee assignments note

## Task Commits

Each task was committed atomically:

1. **Task 1: Politician metrics cards and sortable trade table** - `07d032f` (feat)
2. **Task 2: Politician profile page with ISR, Disclaimer, and 404 handling** - `6ebbfc9` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `frontend/app/politicians/[id]/page.tsx` - ISR Server Component for politician profile; fetches PoliticianProfile, renders header, Disclaimer, PoliticianMetrics, TradeTable; notFound() on errors
- `frontend/components/politician-metrics.tsx` - Client Component with 4 summary cards; computeAvgReturn and computeTopAssetTypes derived from profile.trades
- `frontend/components/trade-table.tsx` - Client Component with TanStack Table v8 sortable/filterable trade history; ticker text filter; "not calculable" badge for options

## Decisions Made

- Disclaimer placed between profile header and PoliticianMetrics (LEGAL-01) — not at page bottom where it could be missed
- PROF-04 committee assignments: rendered as a one-line informational note in the header ("not available in public STOCK Act disclosure data") rather than a separate section — this is intentional partial delivery; full data requires ProPublica integration logged as Phase 6 concern
- Options trades identified by `return_calculable === false` (not by `asset_type === 'option'`) — consistent with the TradeIn schema-level LEGAL-02 enforcement in Phase 1

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Politician profile page fully implemented and committed
- All three wave-2 profile pages now complete: feed (03-02), leaderboards (03-03), politician profile (03-04), ticker page (03-05)
- Ready for Phase 4 deployment configuration

---
*Phase: 03-frontend-core*
*Completed: 2026-03-13*
