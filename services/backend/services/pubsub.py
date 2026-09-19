import asyncio
import json
from fastapi import WebSocket
from services.backend.database.redis_client import get_redis

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                pass

connection_manager = ConnectionManager()

async def redis_listener():
    while True:
        try:
            r = get_redis()
            if r:
                pubsub = r.pubsub()
                await pubsub.subscribe("market:ticks:all", "news:articles")
                async for message in pubsub.listen():
                    if message and message["type"] == "message":
                        data = message["data"]
                        await connection_manager.broadcast(data)
            await asyncio.sleep(2)
        except Exception:
            await asyncio.sleep(5)
