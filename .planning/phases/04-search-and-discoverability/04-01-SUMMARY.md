---
phase: 04-search-and-discoverability
plan: "01"
subsystem: backend
tags: [search, pg_trgm, redis, alembic, fastapi]
dependency_graph:
  requires:
    - 02-api-layer (Redis cache pattern, get_redis dependency)
    - 01-data-foundation (politicians and trades tables, Alembic chain)
  provides:
    - GET /search/politicians — pg_trgm word_similarity autocomplete, Redis 30s TTL
    - GET /search/tickers — ILIKE prefix search, Redis 30s TTL
    - GET /feed chamber/party filtering — WHERE clauses on Politician.chamber/.party
  affects:
    - 04-02 (frontend autocomplete wires to these endpoints)
tech_stack:
  added: [pg_trgm PostgreSQL extension]
  patterns:
    - GIN trigram indexes on politicians.full_name and trades.ticker
    - word_similarity <% operator for partial name matching (not similarity())
    - ILIKE prefix for short tickers (no trigrams extractable from 1-2 char strings)
    - hashlib.md5 cache key derivation (lowercase/uppercase normalized)
key_files:
  created:
    - backend/alembic/versions/0003_add_trgm_search_indexes.py
    - backend/app/schemas/search.py
    - backend/app/api/search.py
  modified:
    - backend/app/api/feed.py
    - backend/app/main.py
decisions:
  - word_similarity <% used (not similarity()) — handles partial matches like "pelosi" -> "Nancy Pelosi"; <% uses word_similarity_threshold not full-string threshold
  - ILIKE prefix for ticker search — 1-2 char tickers (AA, C, F) have no extractable trigrams so similarity() would miss them; ILIKE works for all lengths
  - CREATE EXTENSION placed first in upgrade() — GIN index creation fails with "type gtrgm does not exist" if extension not present
  - chamber/party filters in feed applied to both base_join and count_stmt — ensures total count matches filtered result set
metrics:
  duration: 1 min
  completed_date: "2026-03-13"
  tasks_completed: 2
  files_created: 3
  files_modified: 2
---

# Phase 4 Plan 01: pg_trgm Search Endpoints and Feed Filtering Summary

**One-liner:** pg_trgm GIN indexes with word_similarity politician autocomplete and ILIKE ticker prefix search, both Redis-cached 30s, plus feed chamber/party WHERE filtering.

## What Was Built

### Task 1: Alembic Migration 0003
Migration `0003_add_trgm_search_indexes.py` with revision chain `0001 -> 0002 -> 0003`:
- `CREATE EXTENSION IF NOT EXISTS pg_trgm` — idempotent, must run before index creation
- GIN trigram index `ix_politicians_full_name_trgm` on `politicians.full_name`
- GIN trigram index `ix_trades_ticker_trgm` on `trades.ticker`
- `downgrade()` drops both indexes then drops the extension

SQL verification via `alembic upgrade 0003 --sql` confirms extension creation precedes index creation.

### Task 2: Search Schemas, Endpoints, and Feed Filtering

**`backend/app/schemas/search.py`** — four Pydantic models: `PoliticianSuggestion`, `TickerSuggestion`, `PoliticianSearchResponse`, `TickerSearchResponse`.

**`backend/app/api/search.py`** — two endpoints:
- `GET /search/politicians?q={query}` (min_length=2) — uses `word_similarity <% operator` via `func.lower(q).op("<%")(func.lower(Politician.full_name))`, ordered by descending similarity, filters `active == True`, limit 8. Redis cache key: `search:pol:{md5(q.lower())}`
- `GET /search/tickers?q={prefix}` (min_length=1) — uses `Trade.ticker.ilike(f"{q.upper()}%")`, distinct, ordered, limit 10. Redis cache key: `search:tick:{md5(q.upper())}`

Both endpoints use `redis.setex(key, 30, ...)` for 30s TTL. Cache payloads use `json.dumps(..., default=str)` for UUID serialization.

**`backend/app/api/feed.py`** — added `chamber` and `party` query params, applied as `WHERE Politician.chamber == chamber` and `WHERE Politician.party == party` to both the data query and the count query.

**`backend/app/main.py`** — `search_router` registered via `app.include_router(search_router)`.

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Hash | Description |
|------|-------------|
| 11ab075 | feat(04-01): Alembic migration 0003 — pg_trgm extension and GIN indexes |
| 6b5d816 | feat(04-01): search endpoints, schemas, and feed chamber/party filtering |

## Self-Check: PASSED
