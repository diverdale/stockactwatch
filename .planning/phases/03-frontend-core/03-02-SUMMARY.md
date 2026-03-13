---
phase: 03-frontend-core
plan: "02"
subsystem: frontend
tags: [feed, nuqs, isr, server-component, shadcn]
dependency_graph:
  requires: ["03-01"]
  provides: ["feed-page", "feed-table", "feed-filters"]
  affects: ["03-03", "03-04", "03-05"]
tech_stack:
  added: ["nuqs/adapters/next/app (NuqsAdapter)"]
  patterns: ["ISR Server Component", "nuqs URL state", "shadcn Table"]
key_files:
  created:
    - frontend/app/feed/page.tsx
    - frontend/components/feed-table.tsx
    - frontend/components/feed-filters.tsx
  modified:
    - frontend/app/layout.tsx
decisions:
  - "NuqsAdapter wraps body children in app/layout.tsx — required for nuqs useQueryState in App Router"
  - "Chamber/party params forwarded to apiFetch but backend ignores them until Phase 4 extension — documented in page comment"
  - "overflow-x-auto added to FeedTable container for mobile viewport correctness (Rule 2 — missing critical layout)"
  - "Date range filtering not implemented — backend GET /feed does not accept date_from/date_to (deferred to Phase 4)"
metrics:
  duration: "< 5 min"
  completed_date: "2026-03-13"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 3 Plan 02: Activity Feed Page Summary

**One-liner:** ISR server component feed page at /feed with nuqs-powered chamber/party URL filters and shadcn Table rendering FeedEntry[] rows.

## What Was Built

The primary landing experience for new site visitors. Three files implement FEED-01/02/03:

1. **`frontend/components/feed-table.tsx`** — Client Component rendering FeedEntry[] in a shadcn Table. Columns: Member (linked to /politicians/{id}), Chamber/Party, Ticker (linked to /tickers/{ticker}), Type (BUY/SELL badge + "options" badge when return_calculable=false), Amount, Disclosed. Empty state shows a bordered message instead of crashing.

2. **`frontend/components/feed-filters.tsx`** — Client Component using nuqs v2 `useQueryState` for chamber and party Select dropdowns. URL state updates on selection; no date range controls (backend does not support date_from/date_to in this phase).

3. **`frontend/app/feed/page.tsx`** — Async Server Component (no 'use client'). Awaits `searchParams` Promise (Next.js 16 required pattern). Builds query string from chamber/party/limit/offset, fetches `apiFetch<FeedResponse>('/feed?...')` with `tags: ['feed']` and `revalidate: 300`. Renders FeedFilters above FeedTable.

**`frontend/app/layout.tsx`** updated to import and wrap children with `NuqsAdapter` from `nuqs/adapters/next/app` — required for useQueryState hooks to function in App Router.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| NuqsAdapter in root layout | nuqs App Router adapter must wrap the component tree that uses useQueryState hooks |
| Chamber/party forwarded to API | Establishes URL state pattern now; backend silently ignores until Phase 4 extension |
| No date range controls | Backend GET /feed only accepts limit, offset, ticker — date_from/date_to deferred |
| overflow-x-auto on table container | Mobile 375px viewport support without horizontal page scroll |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added overflow-x-auto to FeedTable container**
- **Found during:** Task 1
- **Issue:** Plan template had `<div className="rounded-md border">` — no overflow handling for mobile 375px viewport, which would cause horizontal page scroll on narrow screens
- **Fix:** Added `overflow-x-auto` to the wrapping div class
- **Files modified:** `frontend/components/feed-table.tsx`
- **Commit:** 8b13868

No other deviations — plan executed as written.

## nuqs Usage

nuqs v2.8.9 was used (not the fallback). The `nuqs/adapters/next/app` adapter path was confirmed present at `frontend/node_modules/nuqs/adapters/next/`. The `NuqsAdapter` wraps children in `app/layout.tsx` as required for App Router.

## Phase 4 Gaps Documented

- Chamber/party backend filtering: GET /feed does not accept these params. URL state is wired; filtered results require a backend API extension in Phase 4.
- Date range filtering: GET /feed does not accept date_from/date_to. FeedEntry schema includes trade_date and disclosure_date for when a future backend extension adds support.

## Self-Check: PASSED

All files created and commits verified:
- FOUND: frontend/app/feed/page.tsx
- FOUND: frontend/components/feed-table.tsx
- FOUND: frontend/components/feed-filters.tsx
- FOUND: 03-02-SUMMARY.md
- FOUND commit: 8b13868 (Task 1)
- FOUND commit: 1952562 (Task 2)
