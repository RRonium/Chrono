"""Financial news from public RSS feeds.

RSS needs no API key and is the officially published way these sites syndicate
headlines, so it is far less fragile than scraping their HTML. To add a source,
append a FeedSource to RSS_FEEDS. Publishers occasionally move their feed URLs;
a feed that fails is logged and skipped without affecting the others.

Google News RSS is used for sites that do not publish a usable feed (for
example NDTV Profit): the `site:` query returns that site's recent headlines.
"""
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.parse import quote_plus

import feedparser
import requests

from services.ingestion.etl.iso_tagger import match_text_to_iso

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}
MAX_ITEMS_PER_FEED = 15


@dataclass(frozen=True)
class FeedSource:
    source: str          # stored on each article, used for credibility scoring and display
    url: str
    default_iso: str     # country used when the headline names no country


def google_news_site(site: str, query: str = "markets OR stocks OR economy") -> str:
    q = quote_plus(f"site:{site} {query}")
    return f"https://news.google.com/rss/search?q={q}&hl=en-IN&gl=IN&ceid=IN:en"


RSS_FEEDS: list[FeedSource] = [
    # India
    FeedSource("ndtv_profit", google_news_site("ndtvprofit.com"), "IND"),
    FeedSource("livemint", "https://www.livemint.com/rss/markets", "IND"),
    FeedSource("business_standard", "https://www.business-standard.com/rss/markets-106.rss", "IND"),
    FeedSource("economic_times", "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms", "IND"),
    FeedSource("moneycontrol", "https://www.moneycontrol.com/rss/latestnews.xml", "IND"),
    FeedSource("hindu_businessline", "https://www.thehindubusinessline.com/markets/feeder/default.rss", "IND"),
    # United States and global
    FeedSource("cnbc", "https://www.cnbc.com/id/100003114/device/rss/rss.html", "USA"),
    FeedSource("yahoo_finance", "https://finance.yahoo.com/news/rssindex", "USA"),
    FeedSource("reuters", google_news_site("reuters.com", "markets OR business"), "USA"),
    # Europe and Asia
    FeedSource("bbc_business", "https://feeds.bbci.co.uk/news/business/rss.xml", "GBR"),
    FeedSource("nikkei_asia", google_news_site("asia.nikkei.com", "markets OR economy"), "JPN"),
    FeedSource("scmp_business", "https://www.scmp.com/rss/92/feed", "CHN"),
]


def _published_iso(entry) -> str:
    parsed = entry.get("published_parsed") or entry.get("updated_parsed")
    if parsed:
        return datetime.fromtimestamp(time.mktime(parsed), tz=timezone.utc).isoformat()
    return datetime.now(timezone.utc).isoformat()


def fetch_feed(feed: FeedSource) -> list[dict]:
    try:
        response = requests.get(feed.url, headers=HEADERS, timeout=15)
        response.raise_for_status()
        parsed = feedparser.parse(response.content)
    except Exception as e:
        logger.warning(f"RSS feed {feed.source} failed: {e}")
        return []

    articles = []
    for entry in parsed.entries[:MAX_ITEMS_PER_FEED]:
        title = (entry.get("title") or "").strip()
        link = (entry.get("link") or "").strip()
        if not title or not link:
            continue
        summary = (entry.get("summary") or "").strip()
        articles.append({
            "title": title,
            "url": link,
            "source": feed.source,
            "published_at": _published_iso(entry),
            "content": summary or title,
            "iso_code": match_text_to_iso(title) or feed.default_iso,
            "type": "news",
        })
    logger.info(f"RSS feed {feed.source}: {len(articles)} articles")
    return articles


def scrape_rss_feeds(feeds: list[FeedSource] | None = None) -> list[dict]:
    """Fetch every configured feed in parallel and return the combined articles."""
    feeds = feeds or RSS_FEEDS
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = pool.map(fetch_feed, feeds)
    return [article for batch in results for article in batch]


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    for feed in RSS_FEEDS:
        print(f"{feed.source:20s} {len(fetch_feed(feed)):3d}  {feed.url}")
