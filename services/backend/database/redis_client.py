import redis.asyncio as aioredis
from services.backend.config import settings

redis_client = None

async def connect_redis():
    global redis_client
    if not redis_client:
        redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

async def disconnect_redis():
    global redis_client
    if redis_client:
        await redis_client.close()
        redis_client = None

def get_redis():
    return redis_client
