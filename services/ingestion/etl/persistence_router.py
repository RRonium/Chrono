import json
import logging
import psycopg2
from pymongo import MongoClient
import redis
from services.ingestion.config import settings

logger = logging.getLogger(__name__)

_redis_pool = None

def get_postgres_connection():
    return psycopg2.connect(settings.TIMESCALE_URL, connect_timeout=5)

def get_mongo_client():
    return MongoClient(settings.MONGO_URI)

def get_redis_client():
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = redis.ConnectionPool.from_url(settings.REDIS_URL, decode_responses=True)
    return redis.Redis(connection_pool=_redis_pool)

def route_record(record: dict) -> bool:
    """Persist and broadcast a record. For news, returns True when the article was new."""
    rec_type = record.get("type")
    
    if rec_type == "market":
        # 1. TimescaleDB tick persistence
        try:
            conn = get_postgres_connection()
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO market_ticks (time, symbol, price, volume, iso_code) VALUES (%s, %s, %s, %s, %s)",
                (record["time"], record["symbol"], record["price"], record.get("volume", 0.0), record["iso_code"])
            )
            conn.commit()
            cur.close()
            conn.close()
        except Exception as e:
            logger.error(f"Failed to persist market tick to TimescaleDB: {e}", exc_info=False)
        
        # 2. Redis Pub/Sub broadcast
        try:
            r = get_redis_client()
            payload = json.dumps(record)
            channel = f"market:ticks:{record['symbol']}"
            r.publish(channel, payload)
            r.publish("market:ticks:all", payload)
            # Latest quote per symbol, so a page opened between polls is filled straight away.
            r.hset("market:latest", record["symbol"], payload)
        except Exception as e:
            logger.error(f"Failed to publish market tick to Redis: {e}", exc_info=False)

    elif rec_type == "news":
        # 1. MongoDB news persistence (upsert by URL; only brand-new articles are broadcast)
        is_new = False
        try:
            client = get_mongo_client()
            db = client.chrono_news
            result = db.news_articles.update_one(
                {"url": record["url"]},
                {"$set": record},
                upsert=True
            )
            is_new = result.upserted_id is not None
            client.close()
        except Exception as e:
            logger.error(f"Failed to persist news article to MongoDB: {e}", exc_info=False)
            is_new = True  # still show it live if storage is down

        # 2. Redis news stream
        if is_new:
            try:
                r = get_redis_client()
                r.publish("news:articles", json.dumps(record, default=str))
            except Exception as e:
                logger.error(f"Failed to publish news article to Redis: {e}", exc_info=False)
        return is_new

    elif rec_type == "economic":
        try:
            client = get_mongo_client()
            db = client.chrono_news
            db.economic_indicators.update_one(
                {"series_id": record.get("series_id"), "date": record.get("date")},
                {"$set": record},
                upsert=True
            )
            client.close()
        except Exception as e:
            logger.error(f"Failed to persist economic indicator to MongoDB: {e}", exc_info=False)
