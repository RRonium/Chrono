import requests
import logging
import time
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

NEWS_API_ENDPOINT = "https://newsapi.org/v2/everything"


def _build_newsapi_payload(q="business", sources=None, page_size=20):
    """Build NewsAPI request payload."""
    payload = {
        "apiKey": "",  # Expected to be set per deployment; fallback to env var later
        "q": q,
        "pageSize": page_size,
        "language": "en",
        "sortBy": "publishedAt",
    }
    if sources:
        payload["sources"] = ",".join(sources)
    return payload


def scrape_newsapi_topheadlines(sources=None):
    """Fetch top headlines from NewsAPI as a fallback/supplementary pipeline."""
    articles = []
    api_key = ""  # Should come from settings.NEWS_API_KEY or env

    if not api_key:
        logger.warning("NewsAPI key not configured; skipping NewsAPI pipeline.")
        return articles

    try:
        payload = _build_newsapi_payload(q="business", sources=sources, page_size=20)
        # Override with actual key from environment
        payload["apiKey"] = api_key
        response = requests.get(NEWS_API_ENDPOINT, params=payload, timeout=15)
        response.raise_for_status()
        data = response.json()

        if data.get("status") != "ok":
            logger.warning(f"NewsAPI returned status: {data.get('status')} - {data.get('message', 'unknown')}")
            return articles

        for item in data.get("articles", [])[:20]:
            title = item.get("title", "")
            url = item.get("url", "")
            published_at = item.get("publishedAt", datetime.now(timezone.utc).isoformat())
            iso_code = ""
            if title:
                from services.ingestion.etl.iso_tagger import map_text_to_iso
                iso_code = map_text_to_iso(title)

            article = {
                "title": title,
                "url": url,
                "source": item.get("source", {}).get("name", "newsapi") if isinstance(item.get("source"), dict) else item.get("source", "newsapi"),
                "published_at": published_at or datetime.now(timezone.utc).isoformat(),
                "content": item.get("description", title) or title,
                "iso_code": iso_code,
                "type": "news",
            }
            articles.append(article)

        logger.info(f"NewsAPI scraper produced {len(articles)} articles")

    except Exception as e:
        logger.error(f"NewsAPI scraper error: {e}", exc_info=True)

    return articles


def scrape_newsapi_everything(q="crypto", from_date=None, to_date=None, page_size=20):
    """Fetch everything from NewsAPI for broad coverage."""
    articles = []

    if not NEWS_API_ENDPOINT or NEWS_API_ENDPOINT == "https://newsapi.org/v2/everything":
        logger.warning("NewsAPI endpoint not properly configured; skipping NewsAPI everything pipeline.")
        return articles

    try:
        params = {
            "apiKey": "",
            "q": q,
            "pageSize": page_size,
            "language": "en",
            "sortBy": "publishedAt",
        }
        response = requests.get(NEWS_API_ENDPOINT, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()

        if data.get("status") != "ok":
            logger.warning(f"NewsAPI everything status: {data.get('status')} - {data.get('message', 'unknown')}")
            return articles

        for item in data.get("articles", [])[:page_size]:
            title = item.get("title", "")
            url = item.get("url", "")
            published_at = item.get("publishedAt", datetime.now(timezone.utc).isoformat())
            iso_code = ""
            if title:
                from services.ingestion.etl.iso_tagger import map_text_to_iso
                iso_code = map_text_to_iso(title)

            article = {
                "title": title,
                "url": url,
                "source": item.get("source", {}).get("name", "newsapi") if isinstance(item.get("source"), dict) else item.get("source", "newsapi"),
                "published_at": published_at or datetime.now(timezone.utc).isoformat(),
                "content": item.get("description", title) or title,
                "iso_code": iso_code,
                "type": "news",
            }
            articles.append(article)

        logger.info(f"NewsAPI everything scraper produced {len(articles)} articles")
    except Exception as e:
        logger.error(f"NewsAPI everything scraper error: {e}", exc_info=True)

    return articles


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    # Quick smoke test
    # articles = scrape_newsapi_topheadlines()
    # print(f"NewsAPI top headlines: {len(articles)} articles")
    pass