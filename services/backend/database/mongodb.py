from motor.motor_asyncio import AsyncIOMotorClient
from services.backend.config import settings

mongo_client = None
mongo_db = None

async def connect_mongo():
    global mongo_client, mongo_db
    if not mongo_client:
        mongo_client = AsyncIOMotorClient(settings.MONGO_URI)
        mongo_db = mongo_client.chrono_news

async def disconnect_mongo():
    global mongo_client
    if mongo_client:
        mongo_client.close()
        mongo_client = None

def get_mongo_db():
    return mongo_db
