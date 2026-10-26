"""Market news from Finnhub's REST API (free tier, same FINNHUB_API_KEY as the trade stream).

Endpoint: GET https://finnhub.io/api/v1/news?category=general
The free plan allows 60 calls a minute; the news pipeline calls this once a minute.
"""
import logging
from datetime import datetime, timezone

import requests

from services.ingestion.config import settings
from services.ingestion.etl.iso_tagger import map_text_to_iso

logger = logging.getLogger(__name__)

FINNHUB_NEWS_URL = "https://finnhub.io/api/v1/news"


def fetch_finnhub_news(category: str = "general", limit: int = 30) -> list[dict]:
    api_key = settings.FINNHUB_API_KEY
    if not api_key:
        logger.info("No FINNHUB_API_KEY configured; skipping Finnhub news.")
        return []

    try:
        response = requests.get(FINNHUB_NEWS_URL, params={"category": category, "token": api_key}, timeout=15)
        response.raise_for_status()
        items = response.json()
    except Exception as e:
        logger.warning(f"Finnhub news request failed: {e}")
        return []

    articles = []
    for item in items[:limit]:
        title = (item.get("headline") or "").strip()
        url = (item.get("url") or "").strip()
        if not title or not url:
            continue
        published = item.get("datetime")
        published_at = (
            datetime.fromtimestamp(published, tz=timezone.utc).isoformat()
            if published else datetime.now(timezone.utc).isoformat()
        )
        articles.append({
            "title": title,
            "url": url,
            "source": (item.get("source") or "finnhub").lower().replace(" ", "_"),
            "published_at": published_at,
            "content": item.get("summary") or title,
            "iso_code": map_text_to_iso(title),
            "type": "news",
        })
    logger.info(f"Finnhub news: {len(articles)} articles")
    return articles
