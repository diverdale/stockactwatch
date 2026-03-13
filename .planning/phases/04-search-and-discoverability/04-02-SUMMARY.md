---
phase: 04-search-and-discoverability
plan: "02"
subsystem: ui
tags: [next.js, nuqs, shadcn, cmdk, use-debounce, search, seo, canonical-urls]

# Dependency graph
requires:
  - phase: 04-search-and-discoverability/04-01
    provides: FastAPI GET /search/politicians and GET /search/tickers endpoints with Redis 30s TTL caching
provides:
  - Autocomplete search combobox in site nav with debounced politician and ticker search
  - Next.js Route Handler at /api/search proxying to FastAPI using server-only API_URL
  - Canonical metadata (alternates.canonical) on all five page types
  - leaderboardParams and serializeLeaderboard utilities via nuqs/server
affects: [seo, navigation, discoverability]

# Tech tracking
tech-stack:
  added:
    - use-debounce 10.1.0 (useDebouncedCallback for 300ms debounce in SearchCombobox)
    - shadcn command component (cmdk-based accessible dropdown)
    - shadcn popover component (base-ui/react based)
  patterns:
    - Route Handler proxy pattern: client components fetch /api/search, server route proxies to FastAPI with process.env.API_URL
    - shouldFilter=false on Command: server-side filtering, cmdk does not re-filter results
    - nuqs/server for search-params.ts: parseAsString/createSerializer/createLoader all available server-side
    - generateMetadata with createLoader(leaderboardParams) for filter-aware canonical URLs on dynamic pages
    - Static metadata export for pages without URL filter state (feed page)

key-files:
  created:
    - frontend/lib/search-params.ts
    - frontend/app/api/search/route.ts
    - frontend/components/search-combobox.tsx
    - frontend/components/ui/command.tsx
    - frontend/components/ui/popover.tsx
    - frontend/components/ui/dialog.tsx
    - frontend/components/ui/input-group.tsx
    - frontend/components/ui/textarea.tsx
  modified:
    - frontend/components/site-nav.tsx
    - frontend/app/leaderboard/returns/page.tsx
    - frontend/app/leaderboard/volume/page.tsx
    - frontend/app/politicians/[id]/page.tsx
    - frontend/app/tickers/[ticker]/page.tsx
    - frontend/app/feed/page.tsx

key-decisions:
  - "nuqs/server used in search-params.ts instead of nuqs client — parseAsString.withDefault only works server-side; client nuqs missing withDefault in server context"
  - "PopoverTrigger rendered without asChild — base-ui PopoverPrimitive.Trigger has no asChild prop (unlike Radix); trigger styled directly with Tailwind classes"
  - "feed page uses static metadata export (not generateMetadata with searchParams) — canonical is /feed regardless of filter state; filter state is transient pagination concern not SEO-relevant page identity"
  - "cache: 'no-store' on Route Handler upstream fetch — FastAPI Redis cache (30s TTL) is the appropriate cache layer; Route Handler must not add additional caching"

patterns-established:
  - "Route Handler proxy: client components always reach FastAPI via /api/* Next.js routes, never directly; server-only API_URL is never exposed to browser"
  - "generateMetadata pattern for filter-aware canonicals: createLoader(leaderboardParams) reads Promise<SearchParams>, builds URLSearchParams, sets alternates.canonical"

requirements-completed:
  - SRCH-01
  - SRCH-02
  - SRCH-03
  - SHARE-01

# Metrics
duration: 15min
completed: 2026-03-13
---

# Phase 4 Plan 02: Search and Discoverability (Frontend) Summary

**Debounced autocomplete combobox in site nav (politicians + tickers via /api/search Route Handler) and generateMetadata with alternates.canonical on all five page types**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-13T00:00:00Z
- **Completed:** 2026-03-13T00:15:00Z
- **Tasks:** 2 of 3 (Task 3 is human verification checkpoint)
- **Files modified:** 13

## Accomplishments
- SearchCombobox component with 300ms debounce, separate politician/ticker groups, shouldFilter=false for server-side filtering
- Next.js Route Handler at /api/search proxies to FastAPI with cache: 'no-store', validates type param, returns empty on errors
- Canonical URLs on all five page types: leaderboard pages include active filter params, static pages have path-only canonicals
- use-debounce 10.1.0 and shadcn command/popover components installed

## Task Commits

Each task was committed atomically:

1. **Task 1: Route Handler proxy, search-params.ts, and SearchCombobox** - `a1b57d2` (feat)
2. **Task 2: Canonical metadata on all five page types** - `008d51c` (feat)

## Files Created/Modified
- `frontend/lib/search-params.ts` - leaderboardParams (nuqs/server) and serializeLeaderboard for canonical URL generation
- `frontend/app/api/search/route.ts` - GET handler proxying to FastAPI /search/* with cache: 'no-store'
- `frontend/components/search-combobox.tsx` - Debounced combobox with politician + ticker groups, shouldFilter=false
- `frontend/components/site-nav.tsx` - SearchCombobox rendered ml-auto after nav links
- `frontend/app/leaderboard/returns/page.tsx` - generateMetadata with createLoader(leaderboardParams), canonical includes chamber/party
- `frontend/app/leaderboard/volume/page.tsx` - Same generateMetadata pattern as returns, different path/title
- `frontend/app/politicians/[id]/page.tsx` - generateMetadata reading params only, canonical /politicians/{id}
- `frontend/app/tickers/[ticker]/page.tsx` - generateMetadata reading params only, canonical /tickers/{TICKER} (uppercased)
- `frontend/app/feed/page.tsx` - Static metadata export, canonical /feed

## Decisions Made
- Used `nuqs/server` in `search-params.ts` — the client-side `nuqs` doesn't expose `withDefault` in server render context. Switching to `nuqs/server` resolves the runtime error while still providing `parseAsString`, `createSerializer`, and `createLoader`.
- Removed `asChild` from `PopoverTrigger` — the project uses `@base-ui/react` Popover (not Radix), which doesn't support the `asChild` render prop. Styled the trigger directly with Tailwind classes.
- Feed page uses static `metadata` export — the canonical `/feed` doesn't change based on filter state (chamber/party are query params for pagination/filtering but don't define the page's SEO identity).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed nuqs import in search-params.ts to use nuqs/server**
- **Found during:** Task 2 (canonical metadata on leaderboard pages)
- **Issue:** `parseAsString.withDefault is not a function` at build time — `nuqs` client module doesn't work in Next.js server context; `nuqs/server` is required
- **Fix:** Changed `import { parseAsString, createSerializer } from 'nuqs'` to `import { parseAsString, createSerializer } from 'nuqs/server'`
- **Files modified:** frontend/lib/search-params.ts
- **Verification:** `pnpm build` succeeds with no TypeScript errors
- **Committed in:** 008d51c (Task 2 commit)

**2. [Rule 1 - Bug] Removed asChild from PopoverTrigger**
- **Found during:** Task 1 (SearchCombobox build)
- **Issue:** `Property 'asChild' does not exist` — project uses @base-ui/react Popover, not Radix; base-ui's Trigger doesn't support asChild
- **Fix:** Removed `asChild` prop and `<Button>` wrapper, styled PopoverTrigger directly with Tailwind inline classes
- **Files modified:** frontend/components/search-combobox.tsx
- **Verification:** `pnpm build` succeeds with no TypeScript errors
- **Committed in:** a1b57d2 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — runtime bugs found at build time)
**Impact on plan:** Both fixes required for compilation. No scope creep. Visual result identical to plan spec.

## Issues Encountered
- base-ui Popover does not support `asChild` unlike Radix — required inline styling instead of Button wrapper. No functional impact.
- nuqs client vs server context split — plan referenced `'nuqs'` import but server rendering requires `'nuqs/server'`. Fixed inline.

## User Setup Required
None - no external service configuration required.

## Checkpoint Verification

**Task 3: Verify search autocomplete and canonical URLs — APPROVED**

Human verified on 2026-03-13:
- Search autocomplete works: typing in nav combobox shows politician and ticker suggestions within ~300ms
- Selecting a result navigates to the correct URL (/politicians/{id} or /tickers/{ticker})
- Canonical URLs confirmed in page source for all five page types
- Network requests confirmed going to /api/search Route Handler (not directly to FastAPI)

## Next Phase Readiness
- Phase 4 Search and Discoverability complete — all plans (04-01, 04-02) delivered
- Full stack ready: FastAPI search endpoints (04-01) + frontend combobox + Route Handler proxy + canonical URLs
- All four phases of the project are now complete

---
*Phase: 04-search-and-discoverability*
*Completed: 2026-03-13*
