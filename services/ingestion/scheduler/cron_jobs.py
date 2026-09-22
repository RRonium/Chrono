import asyncio
import logging
import os
from datetime import timezone
from typing import Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from services.ingestion.connectors.finnhub_stream import start_finnhub_stream, _streamer_instance
from services.ingestion.connectors.moneycontrol import scrape_moneycontrol
from services.ingestion.scrapers.economic_times import scrape_economic_times, scrape_reuters_rss
from services.ingestion.scrapers.newsapi_fallback import scrape_newsapi_topheadlines
from services.ingestion.etl.transform import transform_record
from services.ingestion.etl.iso_tagger import tag_country
from services.ingestion.etl.persistence_router import route_record
from services.ml_classifier.publisher.redis_publisher import publish_article_enriched
from services.ml_classifier.model.finbert_sentiment import classify_sentiment
from services.ml_classifier.model.urgency_scorer import score_urgency
from services.ingestion.config import settings

logger = logging.getLogger(__name__)

# Initialize Finnhub streamer with API key from settings
FINNHUB_API_KEY = settings.FINNHUB_API_KEY or os.getenv("FINNHUB_API_KEY", "")
DEFAULT_TICKERS = [
    "AAPL", "MSFT", "GOOGL", "TSLA", "BINANCE:BTCUSDT", "BINANCE:ETHUSDT"
]

if FINNHUB_API_KEY:
    _streamer_instance = start_finnhub_stream(api_key=FINNHUB_API_KEY, symbols=DEFAULT_TICKERS)
    logger.info(f"Finnhub stream initialized with {len(DEFAULT_TICKERS)} tickers")
else:
    _streamer_instance = None
    logger.warning("No FINNHUB_API_KEY configured. Finnhub real-time stream disabled.")


def run_market_pipeline():
    """Run market data pipeline — either live via Finnhub or fallback to Yahoo."""
    if _streamer_instance and _streamer_instance.is_running:
        logger.debug("Finnhub live stream is active; market pipeline bypasses polling.")
        # The Finnhub WebSocket internally routes via route_record() through on_message handler
        # No additional polling needed; ticks flow asynchronously.
        return

    # Fallback: Yahoo Finance polling pipeline
    from services.ingestion.connectors.yahoo_finance import fetch_yahoo_ticks
    try:
        ticks = fetch_yahoo_ticks()
        for tick in ticks:
            transformed = transform_record(tick)
            tagged = tag_country(transformed)
            route_record(tagged)
        logger.info(f"Yahoo fallback pipeline: {len(ticks)} market ticks processed")
    except Exception as e:
        logger.error(f"Yahoo fallback pipeline error: {e}", exc_info=True)


async def run_news_pipeline():
    """Run news pipeline: Moneycontrol + Economic Times + Reuters RSS + NewsAPI fallback."""
    all_articles = []

    # 1. Moneycontrol
    try:
        articles_mc = scrape_moneycontrol()
        all_articles.extend(articles_mc)
        logger.info(f"Pipeline: Moneycontrol produced {len(articles_mc)} articles")
    except Exception as e:
        logger.error(f"Moneycontrol scrape error: {e}", exc_info=True)

    # 2. Economic Times
    try:
        articles_et = scrape_economic_times()
        all_articles.extend(articles_et)
        logger.info(f"Pipeline: Economic Times produced {len(articles_et)} articles")
    except Exception as e:
        logger.error(f"Economic Times scrape error: {e}", exc_info=True)

    # 3. Reuters RSS
    try:
        articles_reuters = scrape_reuters_rss()
        all_articles.extend(articles_reuters)
        logger.info(f"Pipeline: Reuters RSS produced {len(articles_reuters)} articles")
    except Exception as e:
        logger.error(f"Reuters RSS scrape error: {e}", exc_info=True)

    # 4. NewsAPI fallback
    try:
        articles_na = scrape_newsapi_topheadlines()
        all_articles.extend(articles_na)
        logger.info(f"Pipeline: NewsAPI produced {len(articles_na)} articles")
    except Exception as e:
        logger.error(f"NewsAPI scrape error: {e}", exc_info=True)

    # Transform, tag, route, and enrich with ML classification
    for article in all_articles:
        try:
            transformed = transform_record(article)
            tagged = tag_country(transformed)
            route_record(tagged)

            # --- NEW: Classify sentiment and score urgency ---
            text = article.get("title", "") + " " + article.get("content", "")
            if text.strip():
                # Urgency scoring (before attaching to article dict)
                urgency_result = score_urgency(
                    text=text,
                    source=article.get("source", "default"),
                    published_at=article.get("published_at"),
                    iso_mentioned=article.get("iso_code") not in (None, "USA", ""),
                )
                urgency = urgency_result.get("urgency", 0.5)

                # FinBERT sentiment
                sent_result = classify_sentiment(text)
                if isinstance(sent_result, list) and len(sent_result) > 0:
                    sent_result = sent_result[0]
                sentiment = {
                    "label": sent_result.get("label", "NEUTRAL"),
                    "score": sent_result.get("score", 0.0),
                }

                # Attach sentiment and urgency to article dict before publishing
                article["sentiment"] = sentiment
                article["urgency"] = urgency

                # Publish enriched payload to Redis news:classified stream
                await publish_article_enriched(article, channel="news:classified")
        except Exception as e:
            logger.error(f"Error routing/ enriching article '{article.get('title', 'unknown')}': {e}", exc_info=False)

    logger.info(f"News pipeline completed: total {len(all_articles)} articles processed across all sources")


def setup_scheduler():
    scheduler = AsyncIOScheduler()

    # Market data: event-driven (Finnhub) or 5s polling fallback
    if _streamer_instance and _streamer_instance.is_running:
        logger.info("Market pipeline configured as event-driven via Finnhub WebSocket.")
        # No periodic job needed; Finnhub pushes ticks in real-time.
    else:
        scheduler.add_job(
            run_market_pipeline,
            IntervalTrigger(seconds=5),
            id="market_pipeline",
            replace_existing=True,
        )
        logger.info("Market pipeline scheduled every 5s via Yahoo Finance fallback.")

    # News pipeline: every 60 seconds (near real-time)
    scheduler.add_job(
        run_news_pipeline,
        IntervalTrigger(seconds=60),
        id="news_pipeline",
        replace_existing=True,
    )
    logger.info("News pipeline scheduled every 60s.")

    # Economic pipeline: hourly
    scheduler.add_job(
        run_economic_pipeline,
        IntervalTrigger(hours=1),
        id="economic_pipeline",
        replace_existing=True,
    )
    logger.info("Economic pipeline scheduled hourly.")

    return scheduler


def run_scheduled_jobs():
    scheduler = setup_scheduler()
    scheduler.start()
    
    # Execute news pipeline immediately on startup
    loop = asyncio.get_event_loop()
    try:
        loop.run_until_complete(run_news_pipeline())
        logger.info("Initial startup news pipeline executed successfully.")
    except Exception as e:
        logger.error(f"Failed to execute initial startup news pipeline: {e}")

    # Keep the main thread alive; the scheduler runs in its own threads
    import signal
    import sys

    def shutdown(signum, frame):
        logger.info("Shutting down scheduler...")
        scheduler.shutdown(wait=False)
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Main thread waits using asyncio event loop
    loop.run_forever()