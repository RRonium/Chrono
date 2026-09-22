import asyncio
import logging
from fastapi import WebSocket
from services.backend.database.redis_client import get_redis

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Client connected. Active WebSocket clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"Client disconnected. Active WebSocket clients: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.warning(f"Error sending to WebSocket client: {e}")
                dead_connections.append(connection)
        for dead in dead_connections:
            self.disconnect(dead)

connection_manager = ConnectionManager()

async def redis_listener():
    """
    Subscribes to Redis channels once at startup.
    Subscribes to market ticks, raw news, and classified news streams.
    Handles reconnection without spinning tight loops.
    """
    logger.info("Initializing Redis PubSub listener daemon...")
    channels = ["market:ticks:all", "news:articles", "news:classified"]

    while True:
        try:
            r = get_redis()
            if not r:
                await asyncio.sleep(2)
                continue

            pubsub = r.pubsub()
            await pubsub.subscribe(*channels)
            logger.info(f"Redis PubSub subscribed to: {channels}")

            async for message in pubsub.listen():
                if message and message.get("type") == "message":
                    data = message.get("data")
                    if data:
                        await connection_manager.broadcast(data)

        except asyncio.CancelledError:
            logger.info("Redis listener task cancelled.")
            break
        except Exception as e:
            logger.error(f"Redis listener connection lost: {e}. Reconnecting in 3s...")
            await asyncio.sleep(3)
