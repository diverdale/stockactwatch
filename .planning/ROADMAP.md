# Roadmap: Congressional Stock Tracker

## Overview

Four phases that follow the dependency chain the data imposes: the ingestion pipeline must run before any visible feature can be validated; the API layer must be stable before frontend work is wired; the browse pages all share the same page architecture so they ship together; search and shareable URLs land last as the navigation and distribution layer that ties the site together for journalists and search traffic.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Data Foundation** - Ingestion pipeline fetches, normalizes, and stores real congressional trade data with correct returns calculations
- [ ] **Phase 2: API Layer** - All REST endpoints serving real data with Redis caching; leaderboard shape locked before frontend work begins
- [ ] **Phase 3: Frontend Core** - All browse pages rendering real data: activity feed, politician profiles, ticker pages, and leaderboards with legal disclaimers
- [ ] **Phase 4: Search and Discoverability** - Politician and ticker autocomplete search plus canonical permalink URLs for every page state

## Phase Details

### Phase 1: Data Foundation
**Goal**: The ingestion pipeline runs on a schedule, populates the database with real congressional trade data, and computes returns correctly — enabling every downstream feature to be built on accurate data.
**Depends on**: Nothing (first phase)
**Requirements**: INGEST-01, INGEST-02, INGEST-03, INGEST-04, INGEST-05, LEGAL-02
**Success Criteria** (what must be TRUE):
  1. The scheduler fetches new trade disclosures from the third-party API at a configured interval and upserts them into PostgreSQL without duplicates
  2. Amended disclosures are detected and corrected in the database — running the pipeline twice on the same data produces correct final state, not duplicates or stale records
  3. Each trade record carries an `asset_type` field; options trades are excluded from return calculations and carry a "return not calculable" marker
  4. Historical price data is fetched and stored for equity trades, and estimated returns are pre-computed and stored (not calculated at query time)
  5. Every trade record stores both `transaction_date` and `filing_date` as separate fields; returns calculations use `transaction_date`
**Plans**: 4 plans

Plans:
- [ ] 01-01-PLAN.md — Project scaffold, DB schema (5 ORM models), Alembic migration, deployment decision checkpoint
- [ ] 01-02-PLAN.md — Canonical TradeIn schema, normalizer, Quiver client (TDD: 8 normalizer tests)
- [ ] 01-03-PLAN.md — Pipeline orchestrator, scheduler job registration, POST /internal/ingest endpoint
- [ ] 01-04-PLAN.md — PriceClient abstraction, yfinance dev impl, returns pre-computation (TDD: 6 tests)

### Phase 2: API Layer
**Goal**: All REST endpoints serve real data with typed responses, Redis caching on high-read aggregations, and a stable API shape that the frontend can depend on without cascade refactors.
**Depends on**: Phase 1
**Requirements**: LEAD-01, LEAD-02, LEAD-03, LEAD-04
**Success Criteria** (what must be TRUE):
  1. The returns leaderboard endpoint responds with estimated performance rankings including return range (low/high), methodology label, and disclaimer flag — not a bare figure
  2. The volume leaderboard endpoint responds with trade count rankings, filterable by chamber, party, and time period
  3. Leaderboard endpoints respond in under 2 seconds under normal load via Redis cache-aside (cache hit measured in staging)
  4. All query parameters are validated via Pydantic models; invalid inputs return structured error responses, not 500s
**Plans**: 3 plans

Plans:
- [ ] 02-01-PLAN.md — Leaderboard routers (returns + volume), Pydantic schemas, Alembic migration ix_trades_trade_date, TDD query tests (Wave 1)
- [ ] 02-02-PLAN.md — Redis cache-aside on leaderboard endpoints, ISR invalidation webhook (Wave 2, depends on 02-01)
- [ ] 02-03-PLAN.md — Feed, politician profile, and ticker endpoints with typed response models (Wave 2, parallel to 02-02)

### Phase 3: Frontend Core
**Goal**: Every core page of the site renders real data with ISR caching, legal disclaimers are visible on every analysis page, and the site is usable on mobile — making the site ready for its first real visitors.
**Depends on**: Phase 2
**Requirements**: FEED-01, FEED-02, FEED-03, PROF-01, PROF-02, PROF-03, PROF-04, TICK-01, TICK-02, TICK-03, LEGAL-01
**Success Criteria** (what must be TRUE):
  1. A visitor can view a chronological feed of recent congressional trade disclosures, filtered by chamber, party, or date range, showing trader name, ticker, trade type, disclosure date, and disclosed dollar range
  2. A visitor can navigate to any Congress member's profile page and see their complete trade history in a sortable/filterable table, summary metrics (total trades, sectors, estimated performance vs S&P 500), and their chamber, state, party, and committee assignments
  3. A visitor can navigate to any traded ticker's page and see all Congress members who have traded it, each trade's details, and a timeline chart of congressional trading activity in that stock
  4. Every leaderboard page and analysis surface displays a visible disclaimer that data is from public STOCK Act disclosures, returns are estimates only, and this is not financial advice
  5. All pages load and are usable on a mobile-width viewport without horizontal scrolling
**Plans**: 5 plans

Plans:
- [ ] 03-01-PLAN.md — Next.js 16 scaffold, shadcn/ui init, root layout + nav, ISR revalidate Route Handler, shared types and apiFetch wrapper, Disclaimer component
- [ ] 03-02-PLAN.md — Activity feed page (/feed) with ISR, chamber/party filter controls (nuqs), FeedTable
- [ ] 03-03-PLAN.md — Returns and volume leaderboard pages with LEGAL-01 Disclaimer banner
- [ ] 03-04-PLAN.md — Politician profile pages with PoliticianMetrics cards and TanStack sortable/filterable TradeTable
- [ ] 03-05-PLAN.md — Ticker pages with TickerTradesTable and TradingTimeline area chart (Recharts)

### Phase 4: Search and Discoverability
**Goal**: Visitors can find any Congress member or stock through autocomplete search, and every page state has a stable URL that can be linked and shared — making the site useful to journalists and findable via search engines.
**Depends on**: Phase 3
**Requirements**: SRCH-01, SRCH-02, SRCH-03, SHARE-01
**Success Criteria** (what must be TRUE):
  1. A visitor can type a Congress member's name into the search box and see autocomplete suggestions; selecting one navigates to that member's profile page
  2. A visitor can type a ticker symbol or company name into the search box and see autocomplete suggestions; selecting one navigates to that ticker's page
  3. Every leaderboard filter state, politician profile, and ticker page has a canonical URL that, when opened in a new tab, renders the same content — links shared by journalists resolve correctly
**Plans**: 2 plans

Plans:
- [ ] 04-01-PLAN.md — Alembic migration (pg_trgm + GIN indexes), FastAPI search endpoints (/search/politicians, /search/tickers), feed chamber/party filtering
- [ ] 04-02-PLAN.md — Next.js Route Handler proxy, SearchCombobox in site nav, canonical metadata on all five page types

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Foundation | 4/4 | Complete | 2026-03-12 |
| 2. API Layer | 3/3 | Complete | 2026-03-13 |
| 3. Frontend Core | 5/5 | Complete | 2026-03-13 |
| 4. Search and Discoverability | 0/2 | Not started | - |
