---
phase: 02-api-layer
plan: "02"
subsystem: api
tags: [redis, cache-aside, fastapi, leaderboard, isr, httpx]
dependency_graph:
  requires:
    - 02-01 (leaderboard router, schemas, cache key helpers)
  provides:
    - Redis connection pool lifecycle (create_pool, get_redis, _pool)
    - Cache-aside on GET /leaderboard/returns (cached=True on hit, setex TTL=300)
    - Cache-aside on GET /leaderboard/volume (cached=True on hit, setex TTL=300)
    - POST /internal/revalidate-isr (deletes Redis keys, calls Next.js webhook)
  affects:
    - backend/app/main.py (lifespan extended with Redis pool init/shutdown)
    - backend/app/api/leaderboard.py (cache-aside added to both route handlers)
    - backend/app/api/internal.py (revalidate-isr endpoint added)
tech_stack:
  added:
    - redis>=7.3.0 (redis.asyncio — not aioredis)
  patterns:
    - Cache-aside: check Redis → on miss query DB → write to Redis with setex TTL=300
    - json.dumps(payload, default=str) for Decimal/UUID serialization safety
    - Module-level _pool with lifespan ownership — init on startup, aclose on shutdown
    - Redis key deletion before Next.js ISR webhook call to prevent stale-data race
key_files:
  created:
    - backend/app/cache.py
  modified:
    - backend/app/main.py
    - backend/app/api/leaderboard.py
    - backend/app/api/internal.py
    - backend/pyproject.toml
    - backend/uv.lock
decisions:
  - redis.asyncio (redis-py 7.x) used directly — aioredis is deprecated since redis-py 4.2.0
  - Redis keys deleted BEFORE Next.js ISR webhook call — prevents Next.js from re-caching stale data from a warm Redis key
  - Module-level _pool pattern (not app.state) — simpler, testable, matches cache key helper pattern already in place
  - json.dumps with default=str applied to all Redis writes — handles Decimal avg_return_pct and UUID politician_id values without custom serializers
metrics:
  duration: "3 min"
  completed_date: "2026-03-13"
  tasks_completed: 2
  files_modified: 6
---

# Phase 2 Plan 02: Redis Cache-Aside Layer and ISR Invalidation Summary

Redis cache-aside added to both leaderboard endpoints using redis.asyncio ConnectionPool, with a new POST /internal/revalidate-isr endpoint that invalidates Redis keys before triggering Next.js ISR revalidation webhooks.

## What Was Built

### Task 1: Redis cache module and lifespan wiring (commit: 9819c7b)

**backend/app/cache.py** — New module:
- `create_pool(redis_url)` — creates `ConnectionPool.from_url` with `decode_responses=True` and `max_connections=50`
- `get_redis()` — FastAPI async generator dependency: yields `Redis.from_pool(_pool)`, aclosed after each request
- `_pool: ConnectionPool | None` — module-level pool reference, owned by lifespan

**backend/app/main.py** — Lifespan extended:
- Added `from app import cache as redis_cache` and `from app.config import settings`
- Before `yield`: `redis_cache._pool = redis_cache.create_pool(settings.REDIS_URL)`
- After `yield`: `if redis_cache._pool: await redis_cache._pool.aclose()` then `await dispose_engine()`

**backend/pyproject.toml + uv.lock** — Added `redis>=7.3.0`

### Task 2: Cache-aside routes and ISR invalidation endpoint (commit: 8c34da7)

**backend/app/api/leaderboard.py** — Both route handlers updated:
- Added `import json`, `from redis.asyncio import Redis`, `from app.cache import get_redis`
- `GET /leaderboard/returns`: checks `redis.get(returns_cache_key(limit))`, returns `cached=True` on hit; on miss queries DB, calls `redis.setex(key, 300, json.dumps(payload, default=str))`, returns `cached=False`
- `GET /leaderboard/volume`: same pattern using `volume_cache_key(chamber, party, period, limit)`; reconstructs `VolumeLeaderboardEntry` list on cache hit

**backend/app/api/internal.py** — New endpoint:
- Added `import httpx`, `from redis.asyncio import Redis`, `from app.cache import get_redis`, `from app.api.leaderboard import returns_cache_key, volume_cache_key`
- `POST /internal/revalidate-isr`: validates INTERNAL_SECRET, deletes Redis keys for named tags (all limit variants for `leaderboard:returns`, default key for `leaderboard:volume`), then calls Next.js `/api/revalidate` per tag via httpx (skipped if `NEXTJS_URL` empty)
- Returns `{"status": "ok", "redis_keys_deleted": [...], "tags_revalidated": [...]}`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] redis-py not installed in venv**
- **Found during:** Task 1 verification — `ModuleNotFoundError: No module named 'redis'`
- **Issue:** redis-py 7.3.0 was not in pyproject.toml dependencies (noted as "already installed" in prompt context, but the uv venv lacked it)
- **Fix:** `uv add "redis>=7.3.0"` — added to pyproject.toml and uv.lock, installed in venv
- **Files modified:** `backend/pyproject.toml`, `backend/uv.lock`
- **Commit:** 9819c7b

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| test_api/test_leaderboard_queries | 7 | All pass |
| test_ingestion/test_normalizer | 8 | All pass |
| test_ingestion/test_prices | 2 | All pass |
| test_ingestion/test_returns | 4 | All pass |
| **Total passing** | **21** | |

No regressions. The leaderboard query tests continue to pass because `get_redis` is only injected into the route handlers — the standalone `query_returns_leaderboard` and `query_volume_leaderboard` functions tested directly are unchanged.

## Success Criteria Verification

- [x] cache.py provides `get_redis` dependency using redis.asyncio (not aioredis)
- [x] lifespan creates pool on startup (`redis_cache._pool = redis_cache.create_pool(settings.REDIS_URL)`) and closes on shutdown (`await redis_cache._pool.aclose()`)
- [x] Both leaderboard endpoints return `cached=True` on warm cache hit
- [x] `/internal/revalidate-isr` deletes Redis keys before calling Next.js webhook
- [x] All 21 prior tests still pass

## Self-Check: PASSED
