from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.backend.agent import gemini
from services.backend.agent.chat import run_turn
from services.backend.routers.countries import read_country_file

router = APIRouter(prefix="/api/v1/agent", tags=["agent"])


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(user|model)$")
    text: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[ChatMessage] = []
    artifact_offset: int = Field(0, ge=0)  # charts already in the conversation, so numbering continues


@router.get("/status")
async def agent_status():
    return {"configured": bool(gemini.api_key()), "models": gemini.models()}


@router.post("/{iso_code}/chat")
async def chat(iso_code: str, request: ChatRequest):
    iso = iso_code.upper()
    if not iso.isalpha() or len(iso) != 3 or read_country_file(iso, "profile.json") is None:
        raise HTTPException(status_code=404, detail="Country not found")
    try:
        return await run_turn(iso, [m.model_dump() for m in request.history], request.message, request.artifact_offset)
    except gemini.GeminiError as exc:
        raise HTTPException(status_code=exc.status, detail=str(exc))
