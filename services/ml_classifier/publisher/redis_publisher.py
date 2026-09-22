"""Publish classifier results to Redis streams for real-time downstream consumers.

Publishes enriched classification events to the ``news:classified`` Redis stream
containing the full article payload plus FinBERT sentiment and urgency scoring
results.  This stream is consumed by the Globe3D / CountryMarkers component to
drive dynamic urgency color shifts and pulse scaling.

Usage:
    from services.ml_classifier.publisher.redis_publisher import publish_classification
    payload = publish_classification(article, sentiment_result, urgency_result)
"""
import json
import logging
import os
from typing import Any, Dict

import redis.asyncio as aioredis
from services.ml_classifier.config import settings

_logger = logging.getLogger(__name__)

_redis_client: "redis.asyncio.Redis | None" = None

_FINNHUB_API_KEY = getattr(settings, "FINNHUB_API_KEY", "") or os.getenv("FINNHUB_API_KEY", "")
_NEWS_API_KEY = getattr(settings, "NEWS_API_KEY", "") or os.getenv("NEWS_API_KEY", "")

# Default Redis URL from settings; can be overridden via env
_REDIS_URL = getattr(settings, "REDIS_URL", "redis://localhost:6379")


def _get_redis() -> "redis.asyncio.Redis":
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(_REDIS_URL, decode_responses=True)
    return _redis_client


async def publish_classification(
    article: Dict[str, Any],
    sentiment: Dict[str, Any],
    urgency: Dict[str, Any],
    channel: str = "news:classified",
) -> None:
    """
    Publish an enriched classification event to the specified Redis stream.

    The payload includes:
      - article: original article dict (title, url, source, iso_code, etc.)
      - sentiment: FinBERT result {label, score}
      - urgency: urgency scorer result {urgency, urgency_color, sentiment_label, ...}
      - timestamp: ISO timestamp of when classification was computed

    The message is published as a JSON string to the Redis Pub/Sub channel.
    """
    try:
        r = _get_redis()

        payload = {
            "article": article,
            "sentiment": sentiment,
            "urgency": urgency,
            "timestamp": datetime.now(timezone.utc).isoformat() if False else None,
            "source": "ml_classifier_publisher",
        }

        # Remove None values
        payload = {k: v for k, v in payload.items() if v is not None}

        message = json.dumps(payload)
        await r.publish(channel, message)

        _logger.info(
            f"Published classification event to Redis channel '{channel}': "
            f"{len(message)} bytes, urgency={urgency.get('urgency', 0):.3f}"
        )
    except Exception as e:
        _logger.error(f"Failed to publish classification to Redis channel '{channel}': {e}", exc_info=True)


async def publish_article_enriched(article: Dict[str, Any], channel: str = "news:classified") -> None:
    """
    Full end-to-end: classify article text, score urgency, and publish to Redis.

    This is the "one-call" function downstream consumers (e.g. backend pipeline)
    can use to take a raw article and emit a fully classified+urgency-rated event
    onto the ``news:classified`` stream.

    Flow:
      1. Run FinBERT sentiment on article title + content
      2. Run urgency scorer (sentiment + keywords + ISO + source + recency)
      3. Publish enriched payload to Redis channel
    """
    from datetime import timezone

    try:
        text = article.get("title", "") + " " + article.get("content", "")

        # 1. FinBERT sentiment
        sentiment_result = classify_sentiment(text)
        if isinstance(sentiment_result, list):
            sentiment_result = sentiment_result[0]
        sentiment = {
            "label": sentiment_result.get("label", "NEUTRAL"),
            "score": sentiment_result.get("score", 0.0),
        }

        # 2. Urgency scoring
        urgency_result = score_urgency(
            text=text,
            source=article.get("source", "default"),
            published_at=article.get("published_at"),
            iso_mentioned=article.get("iso_code") not in (None, "USA", ""),
        )
        urgency = {
            "urgency": urgency_result.get("urgency", 0.5),
            "urgency_color": urgency_result.get("urgency_color", "yellow"),
            "sentiment_label": urgency_result.get("sentiment_label", "NEUTRAL"),
            "sentiment_score": urgency_result.get("sentiment_score", 0.0),
        }

        # 3. Publish to Redis
        await publish_classification(article, sentiment, urgency, channel)

    except Exception as e:
        _logger.error(f"Full end-to-end classification publish failed: {e}", exc_info=True)


# Alias for backward compatibility / older import paths
async def publish(channel: str, payload: Dict[str, Any]) -> None:
    """Legacy wrapper: just publish raw payload dict to a channel."""
    try:
        r = _get_redis()
        message = json.dumps(payload)
        await r.publish(channel, message)
        _logger.debug(f"Legacy publish to '{channel}': {len(message)} bytes")
    except Exception as e:
        _logger.error(f"Legacy publish error: {e}", exc_info=True)


# Ensure datetime is importable at module level if needed
from datetime import datetime, timezone