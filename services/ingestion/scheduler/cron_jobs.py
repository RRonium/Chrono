import asyncio
import logging
import os
from datetime import timezone
from typing import Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from services.ingestion.connectors.finnhub_stream import start_finnhub_stream, _streamer_instance
from services.ingestion.scrapers.moneycontrol import scrape_moneycontrol
from services.ingestion.scrapers.economic_times import scrape_economic_times
from services.ingestion.scrapers.newsapi_fallback import scrape_newsapi_topheadlines
from services.ingestion.scrapers.rss_feeds import scrape_rss_feeds
from services.ingestion.connectors.finnhub_news import fetch_finnhub_news
from services.ingestion.connectors.country_markets import fetch_country_quotes
from services.ingestion.etl.transform import transform_record
from services.ingestion.etl.iso_tagger import tag_country
from services.ingestion.etl.persistence_router import route_record
from services.ml_classifier.model.finbert_sentiment import classify_sentiment
from services.ml_classifier.model.urgency_scorer import score_urgency
from services.ingestion.config import settings

logger = logging.getLogger(__name__)

# Initialize Finnhub streamer with API key from settings
FINNHUB_API_KEY = settings.FINNHUB_API_KEY or os.getenv("FINNHUB_API_KEY", "")
DEFAULT_TICKERS = [
    "AAPL", "MSFT", "GOOGL", "TSLA", "BINANCE:BTCUSDT", "BINANCE:ETHUSDT"
]
CORE_YAHOO_SYMBOLS = ["RELIANCE.NS", "TATAMOTORS.NS", "^NSEI", "^GSPC"]
# Every symbol on the country pages; slower than the core ticker to stay under Yahoo's rate limits.
COUNTRY_MARKET_INTERVAL_SECONDS = int(os.getenv("COUNTRY_MARKET_INTERVAL_SECONDS", "120"))
# A scraper stuck on a dead connection must not hold the news job forever, or every later run is skipped.
SCRAPER_TIMEOUT_SECONDS = int(os.getenv("SCRAPER_TIMEOUT_SECONDS", "45"))

if FINNHUB_API_KEY:
    _streamer_instance = start_finnhub_stream(api_key=FINNHUB_API_KEY, symbols=DEFAULT_TICKERS)
    logger.info(f"Finnhub stream initialized with {len(DEFAULT_TICKERS)} tickers")
else:
    _streamer_instance = None
    logger.warning("No FINNHUB_API_KEY configured. Finnhub real-time stream disabled.")


def run_market_pipeline():
    """Run Yahoo proxy polling for regional/index symbols.

    Finnhub handles its subscribed US/crypto symbols independently. Yahoo
    remains active for NSE and index symbols because Finnhub does not provide
    those instruments reliably through the same stream.
    """
    from services.ingestion.connectors.yahoo_finance import fetch_yahoo_ticks

    yahoo_symbols = list(CORE_YAHOO_SYMBOLS)
    if not (_streamer_instance and _streamer_instance.is_running):
        yahoo_symbols.extend(["AAPL", "MSFT", "GOOGL", "TSLA"])

    try:
        ticks = fetch_yahoo_ticks(symbols=yahoo_symbols)
        for tick in ticks:
            transformed = transform_record(tick)
            tagged = tag_country(transformed)
            route_record(tagged)
        logger.info(f"Yahoo fallback pipeline: {len(ticks)} market ticks processed")
    except Exception as e:
        logger.error(f"Yahoo fallback pipeline error: {e}", exc_info=True)


def run_country_market_pipeline():
    """Poll every index and company listed in data/countries/*/market.json."""
    exclude = set(CORE_YAHOO_SYMBOLS) | set(DEFAULT_TICKERS)
    try:
        quotes = fetch_country_quotes(exclude=exclude)
        for quote in quotes:
            route_record(transform_record(quote))
        logger.info(f"Country market pipeline: {len(quotes)} quotes processed")
    except Exception as e:
        logger.error(f"Country market pipeline error: {e}", exc_info=True)


async def _safe_scrape(scraper_coro_or_func, name: str):
    """Safely run a scraper (sync or async) and return results."""
    try:
        if asyncio.iscoroutinefunction(scraper_coro_or_func) or asyncio.iscoroutine(scraper_coro_or_func):
            res = await asyncio.wait_for(scraper_coro_or_func(), SCRAPER_TIMEOUT_SECONDS)
        else:
            # Run blocking scraper in executor
            loop = asyncio.get_running_loop()
            res = await asyncio.wait_for(loop.run_in_executor(None, scraper_coro_or_func), SCRAPER_TIMEOUT_SECONDS)
        logger.info(f"Pipeline: {name} produced {len(res) if isinstance(res, list) else 0} articles")
        return res if isinstance(res, list) else []
    except asyncio.TimeoutError:
        logger.warning(f"{name} scrape timed out after {SCRAPER_TIMEOUT_SECONDS}s; skipping this round")
        return []
    except Exception as e:
        logger.error(f"{name} scrape error: {e}", exc_info=True)
        return []


async def run_news_pipeline():
    """Collect news from every source concurrently, score it, store it, and broadcast new articles."""
    scrapers = [
        _safe_scrape(scrape_moneycontrol, "Moneycontrol"),
        _safe_scrape(scrape_economic_times, "Economic Times"),
        _safe_scrape(scrape_rss_feeds, "RSS feeds"),
        _safe_scrape(fetch_finnhub_news, "Finnhub news"),
        _safe_scrape(scrape_newsapi_topheadlines, "NewsAPI"),
    ]

    results = await asyncio.gather(*scrapers, return_exceptions=True)
    all_articles = []
    for res in results:
        if isinstance(res, list):
            all_articles.extend(res)

    logger.info(f"Concurrent news collection gathered {len(all_articles)} total raw articles")

    # Score each article before it is stored, so MongoDB and the live
    # news:articles stream both carry sentiment and urgency for the globe markers.
    new_count = 0
    for article in all_articles:
        try:
            transformed = transform_record(article)
            tagged = tag_country(transformed)

            text = f"{tagged.get('title', '')} {tagged.get('content', '')}".strip()
            if text:
                urgency_result = score_urgency(
                    text=text,
                    source=tagged.get("source", "default"),
                    published_at=tagged.get("published_at"),
                    iso_mentioned=tagged.get("iso_code") not in (None, "USA", ""),
                )
                sent_result = classify_sentiment(text)
                if isinstance(sent_result, list) and len(sent_result) > 0:
                    sent_result = sent_result[0]
                tagged["sentiment"] = {
                    "label": sent_result.get("label", "NEUTRAL"),
                    "score": sent_result.get("score", 0.0),
                }
                tagged["urgency"] = urgency_result.get("urgency", 0.5)
                tagged["urgency_color"] = urgency_result.get("urgency_color", "yellow")

            if route_record(tagged):
                new_count += 1
        except Exception as e:
            logger.error(f"Error routing/enriching article '{article.get('title', 'unknown')}': {e}", exc_info=False)

    logger.info(f"News pipeline completed: {len(all_articles)} articles processed, {new_count} new")


def setup_scheduler():
    # coalesce + misfire grace: after a stall (e.g. a network outage) run each job once and carry on,
    # instead of dropping runs as "missed".
    scheduler = AsyncIOScheduler(job_defaults={"coalesce": True, "max_instances": 1, "misfire_grace_time": 30})

    scheduler.add_job(
        run_market_pipeline,
        IntervalTrigger(seconds=5),
        id="market_pipeline",
        replace_existing=True,
    )
    logger.info("Regional market pipeline scheduled every 5s via Yahoo Finance.")

    scheduler.add_job(
        run_country_market_pipeline,
        IntervalTrigger(seconds=COUNTRY_MARKET_INTERVAL_SECONDS),
        id="country_market_pipeline",
        replace_existing=True,
        max_instances=1,
    )
    logger.info(f"Country market pipeline scheduled every {COUNTRY_MARKET_INTERVAL_SECONDS}s via Yahoo Finance.")

    scheduler.add_job(
        run_news_pipeline,
        IntervalTrigger(seconds=60),
        id="news_pipeline",
        replace_existing=True,
    )
    logger.info("News pipeline scheduled every 60s.")

    scheduler.add_job(
        check_finnhub_stream,
        IntervalTrigger(seconds=60),
        id="finnhub_watchdog",
        replace_existing=True,
    )

    return scheduler


def check_finnhub_stream():
    """Restart the Finnhub reconnect thread if it has died."""
    global _streamer_instance
    if FINNHUB_API_KEY and not (_streamer_instance and _streamer_instance.is_alive):
        logger.warning("Finnhub stream thread is not running; restarting it")
        _streamer_instance = start_finnhub_stream(api_key=FINNHUB_API_KEY, symbols=DEFAULT_TICKERS)


async def run_scheduled_jobs():
    scheduler = setup_scheduler()
    scheduler.start()
    
    # Start both feeds immediately; recurring jobs continue on their intervals.
    asyncio.create_task(asyncio.to_thread(run_market_pipeline))
    asyncio.create_task(asyncio.to_thread(run_country_market_pipeline))
    try:
        await run_news_pipeline()
        logger.info("Initial startup news pipeline executed successfully.")
    except Exception as e:
        logger.error(f"Failed to execute initial startup news pipeline: {e}")

    import signal
    import sys

    def shutdown(signum, frame):
        logger.info("Shutting down scheduler...")
        scheduler.shutdown(wait=False)
        raise SystemExit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    await asyncio.Event().wait()
