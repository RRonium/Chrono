import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from services.backend.config import settings

logger = logging.getLogger(__name__)
mongo_client = None
mongo_db = None

async def connect_mongo(retries=5, delay=2):
    global mongo_client, mongo_db
    if not mongo_client:
        for attempt in range(1, retries + 1):
            try:
                mongo_client = AsyncIOMotorClient(settings.MONGO_URI, serverSelectionTimeoutMS=3000)
                # Test connection
                await mongo_client.admin.command('ping')
                mongo_db = mongo_client.chrono_news
                logger.info("Successfully connected to MongoDB")
                break
            except Exception as e:
                logger.warning(f"MongoDB connection attempt {attempt}/{retries} failed: {e}")
                if attempt == retries:
                    raise
                await asyncio.sleep(delay)

async def disconnect_mongo():
    global mongo_client, mongo_db
    if mongo_client:
        mongo_client.close()
        mongo_client = None
        mongo_db = None

def get_mongo_db():
    return mongo_db
