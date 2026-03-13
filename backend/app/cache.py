"""Redis connection pool and FastAPI dependency.

Uses redis-py 7.x redis.asyncio — do NOT import aioredis (deprecated since redis-py 4.2.0).
Pool is initialized in main.py lifespan and stored in module-level _pool.
get_redis() is a FastAPI dependency — yields one client per request, closes on exit.
"""
from collections.abc import AsyncGenerator

from redis.asyncio import Redis
from redis.asyncio.connection import ConnectionPool

_pool: ConnectionPool | None = None


def create_pool(redis_url: str) -> ConnectionPool:
    """Create the shared connection pool. Called once during lifespan startup."""
    return ConnectionPool.from_url(
        redis_url,
        decode_responses=True,   # Redis returns str, not bytes
        max_connections=50,      # matches SQLAlchemy pool_size(10) + max_overflow(20) with headroom
    )


async def get_redis() -> AsyncGenerator[Redis, None]:
    """FastAPI dependency — yields a Redis client backed by the shared pool.

    Redis.from_pool() gives this client ownership of the underlying connection;
    aclose() releases it back to the pool.
    """
    assert _pool is not None, "Redis pool not initialized — check lifespan setup"
    client = Redis.from_pool(_pool)
    try:
        yield client
    finally:
        await client.aclose()
