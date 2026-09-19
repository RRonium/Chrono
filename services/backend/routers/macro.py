from fastapi import APIRouter, HTTPException
from services.backend.database.mongodb import get_mongo_db

router = APIRouter(prefix="/api/v1/macro", tags=["macro"])

@router.get("/indicators/{iso_code}")
async def get_macro_indicators(iso_code: str):
    db = get_mongo_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    
    cursor = db.economic_indicators.find({"country_code": iso_code.upper()}).sort("date", -1).limit(20)
    indicators = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        indicators.append(doc)
    return indicators
