from fastapi import APIRouter, HTTPException, Query
from services.backend.database.mongodb import get_mongo_db

router = APIRouter(prefix="/api/v1/news", tags=["news"])

@router.get("")
async def get_news(iso_code: str = Query(None), limit: int = Query(20, ge=1, le=100)):
    db = get_mongo_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    
    query = {}
    if iso_code:
        query["iso_code"] = iso_code.upper()
    
    cursor = db.news_articles.find(query).sort("published_at", -1).limit(limit)
    articles = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        articles.append(doc)
    return articles
