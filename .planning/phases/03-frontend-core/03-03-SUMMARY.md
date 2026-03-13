---
phase: 03-frontend-core
plan: "03"
subsystem: frontend
tags: [leaderboard, ISR, LEGAL-01, shadcn, server-component, client-component]
dependency_graph:
  requires: [03-01]
  provides: [leaderboard-returns-page, leaderboard-volume-page]
  affects: [site-nav, disclaimer]
tech_stack:
  added: []
  patterns: [ISR-with-cache-tags, shadcn-Table, use-client-table-component, server-component-page]
key_files:
  created:
    - frontend/app/leaderboard/returns/page.tsx
    - frontend/app/leaderboard/volume/page.tsx
    - frontend/components/returns-leaderboard-table.tsx
    - frontend/components/volume-leaderboard-table.tsx
  modified: []
decisions:
  - LEGAL-01 satisfied by rendering Disclaimer above table in page files, not per-row in table components
  - ISR cache tags 'leaderboard-returns' and 'leaderboard-volume' align with /api/revalidate/route.ts allowed set
  - methodologyLabel derived from first entry's methodology_label field with fallback string
metrics:
  duration: 2 min
  completed: 2026-03-13
  tasks_completed: 2
  files_created: 4
  files_modified: 0
---

# Phase 3 Plan 03: Leaderboard Pages Summary

**One-liner:** Returns and volume leaderboard pages with ISR (revalidate=300), cache tags, and LEGAL-01 Disclaimer banner above shadcn Table components.

## What Was Built

Two leaderboard routes and two reusable table components:

- `/leaderboard/returns` — ISR Server Component fetching `ReturnLeaderboardEntry[]`, renders `<Disclaimer />` then `<ReturnsLeaderboardTable />` with avg_return_pct formatted as `+X.X%` (green/red), return range, trade count, methodology label
- `/leaderboard/volume` — ISR Server Component fetching `VolumeLeaderboardEntry[]`, renders `<Disclaimer />` then `<VolumeLeaderboardTable />` with chamber, party badge, trade count
- `ReturnsLeaderboardTable` — `'use client'` shadcn Table, member name links to `/politicians/:id`, positive returns green, negative red
- `VolumeLeaderboardTable` — `'use client'` shadcn Table, party rendered as `<Badge variant="outline">`

## LEGAL-01 Compliance

Both leaderboard pages render `<Disclaimer />` above the table. The Disclaimer component:
- Has `role="note"` for accessibility
- Contains "STOCK Act disclosures", "estimates", "not financial advice"
- Renders a visible yellow banner (border-yellow-400 / bg-yellow-50)

## ISR Configuration

Both pages use:
- `export const revalidate = 300` (5-minute ISR)
- `apiFetch` with cache `tags: ['leaderboard-returns']` / `tags: ['leaderboard-volume']`
- Tags match the allowed set in `/api/revalidate/route.ts` for on-demand invalidation

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Returns and volume leaderboard table components | 0dc64a8 | returns-leaderboard-table.tsx, volume-leaderboard-table.tsx |
| 2 | Leaderboard page files with ISR and LEGAL-01 disclaimer | c52a52b | app/leaderboard/returns/page.tsx, app/leaderboard/volume/page.tsx |

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] frontend/app/leaderboard/returns/page.tsx — created
- [x] frontend/app/leaderboard/volume/page.tsx — created
- [x] frontend/components/returns-leaderboard-table.tsx — created
- [x] frontend/components/volume-leaderboard-table.tsx — created
- [x] Commit 0dc64a8 exists
- [x] Commit c52a52b exists
- [x] Both page files contain `<Disclaimer />` (LEGAL-01)
- [x] Both page files have `export const revalidate = 300`
- [x] Disclaimer has `role="note"` and correct legal text
