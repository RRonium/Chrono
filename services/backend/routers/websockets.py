from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.backend.services.pubsub import connection_manager

router = APIRouter(tags=["websockets"])

@router.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await connection_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        connection_manager.disconnect(websocket)
