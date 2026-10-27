"""Re-score every stored news article with the current sentiment and urgency models.

Articles stored before a scoring change keep their old values until a scraper sees
them again, so run this once after changing the urgency scorer:

    docker compose exec ingestion python -m services.ingestion.etl.rescore_news
"""

import logging

from pymongo import MongoClient, UpdateOne

from services.ingestion.config import settings
from services.ml_classifier.model.finbert_sentiment import classify_sentiment
from services.ml_classifier.model.urgency_scorer import score_urgency

logger = logging.getLogger(__name__)


def rescore_all() -> int:
    client = MongoClient(settings.MONGO_URI)
    try:
        articles = client.chrono_news.news_articles
        updates = []
        for doc in articles.find({}, {"title": 1, "content": 1, "source": 1, "published_at": 1, "iso_code": 1}):
            text = f"{doc.get('title', '')} {doc.get('content', '')}".strip()
            if not text:
                continue
            urgency = score_urgency(
                text=text,
                source=doc.get("source", "default"),
                published_at=doc.get("published_at"),
                iso_mentioned=doc.get("iso_code") not in (None, "USA", ""),
            )
            sentiment = classify_sentiment(text)[0]
            updates.append(UpdateOne({"_id": doc["_id"]}, {"$set": {
                "sentiment": {"label": sentiment.get("label", "NEUTRAL"), "score": sentiment.get("score", 0.0)},
                "urgency": urgency.get("urgency", 0.5),
                "urgency_color": urgency.get("urgency_color", "yellow"),
            }}))
        if updates:
            articles.bulk_write(updates)
        return len(updates)
    finally:
        client.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(f"Re-scored {rescore_all()} articles")
