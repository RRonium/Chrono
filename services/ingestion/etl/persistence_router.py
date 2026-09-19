import psycopg2
from pymongo import MongoClient
import redis
import json
from services.ingestion.config import settings

def get_postgres_connection():
    return psycopg2.connect(settings.TIMESCALE_URL)

def get_mongo_client():
    return MongoClient(settings.MONGO_URI)

def get_redis_client():
    return redis.Redis.from_url(settings.REDIS_URL)

def route_record(record: dict):
    rec_type = record.get("type")
    
    if rec_type == "market":
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
            pass
        
        try:
            r = get_redis_client()
            channel = f"market:ticks:{record['symbol']}"
            r.publish(channel, json.dumps(record))
            r.publish("market:ticks:all", json.dumps(record))
        except Exception as e:
            pass

    elif rec_type == "news":
        try:
            client = get_mongo_client()
            db = client.chrono_news
            db.news_articles.update_one(
                {"url": record["url"]},
                {"$set": record},
                upsert=True
            )
            client.close()
        except Exception as e:
            pass

        try:
            r = get_redis_client()
            r.publish("news:articles", json.dumps(record))
        except Exception as e:
            pass

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
            pass
