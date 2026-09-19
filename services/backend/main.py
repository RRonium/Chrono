import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from services.backend.config import settings
from services.backend.database.postgres import connect_postgres, disconnect_postgres
from services.backend.database.mongodb import connect_mongo, disconnect_mongo
from services.backend.database.redis_client import connect_redis, disconnect_redis
from services.backend.routers import market, macro, news, websockets
from services.backend.services.pubsub import redis_listener

app = FastAPI(title="Chrono Backend API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(market.router)
app.include_router(macro.router)
app.include_router(news.router)
app.include_router(websockets.router)

@app.on_event("startup")
async def startup_event():
    await connect_postgres()
    await connect_mongo()
    await connect_redis()
    asyncio.create_task(redis_listener())

@app.on_event("shutdown")
async def shutdown_event():
    await disconnect_postgres()
    await disconnect_mongo()
    await disconnect_redis()

@app.get("/")
def root():
    return {"status": "ok", "environment": settings.NODE_ENV}
