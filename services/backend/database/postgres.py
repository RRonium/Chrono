import asyncpg
from services.backend.config import settings

postgres_pool = None

async def connect_postgres():
    global postgres_pool
    if not postgres_pool:
        postgres_pool = await asyncpg.create_pool(settings.TIMESCALE_URL)

async def disconnect_postgres():
    global postgres_pool
    if postgres_pool:
        await postgres_pool.close()
        postgres_pool = None

async def get_db_pool():
    return postgres_pool
