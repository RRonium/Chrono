import asyncio
import logging
import asyncpg
from services.backend.config import settings

logger = logging.getLogger(__name__)
postgres_pool = None

async def connect_postgres(retries=5, delay=2):
    global postgres_pool
    if not postgres_pool:
        for attempt in range(1, retries + 1):
            try:
                postgres_pool = await asyncpg.create_pool(settings.TIMESCALE_URL)
                logger.info("Successfully connected to PostgreSQL/TimescaleDB")
                break
            except Exception as e:
                logger.warning(f"PostgreSQL connection attempt {attempt}/{retries} failed: {e}")
                if attempt == retries:
                    raise
                await asyncio.sleep(delay)

async def disconnect_postgres():
    global postgres_pool
    if postgres_pool:
        await postgres_pool.close()
        postgres_pool = None

async def get_db_pool():
    return postgres_pool
