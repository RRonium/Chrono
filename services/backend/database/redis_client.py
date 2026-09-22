import asyncio
import logging
import redis.asyncio as aioredis
from services.backend.config import settings

logger = logging.getLogger(__name__)
redis_client = None

async def connect_redis(retries=5, delay=2):
    global redis_client
    if not redis_client:
        for attempt in range(1, retries + 1):
            try:
                redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
                await redis_client.ping()
                logger.info("Successfully connected to Redis")
                break
            except Exception as e:
                logger.warning(f"Redis connection attempt {attempt}/{retries} failed: {e}")
                if attempt == retries:
                    raise
                await asyncio.sleep(delay)

async def disconnect_redis():
    global redis_client
    if redis_client:
        await redis_client.close()
        redis_client = None

def get_redis():
    return redis_client
