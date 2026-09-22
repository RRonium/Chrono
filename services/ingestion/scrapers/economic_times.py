import requests
from bs4 import BeautifulSoup
from datetime import datetime, timezone
from services.ingestion.etl.iso_tagger import map_text_to_iso
import logging

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}


def _safe_find_first(soup_or_element, *args, **kwargs):
    """Try multiple selectors; return first match or None."""
    if hasattr(soup_or_element, 'find'):
        for selector in args:
            result = soup_or_element.find(selector)
            if result:
                return result
    return None


def _safe_text(element):
    """Extract stripped text safely."""
    if element:
        return element.get_text(strip=True)
    return ""


def scrape_economic_times():
    url = "https://economictimes.indiatimes.com/news/economy"
    articles = []
    retries = 3
    backoff = 2

    for attempt in range(retries):
        try:
            response = requests.get(url, headers=HEADERS, timeout=15)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")

            # Updated selectors for current Economic Times layout
            divs = soup.find_all("div", class_="eachStory")
            if not divs:
                divs = soup.find_all("div", class_="story-box")
            if not divs:
                divs = soup.find_all("article")
            if not divs:
                divs = soup.find_all("li", class_="clearfix")

            logger.info(f"Economic Times found {len(divs)} article containers (attempt {attempt + 1})")
            items = divs[:15]

            for div in items:
                title_elem = _safe_find_first(div, "h3", "h2", "a", "h4")
                if not title_elem:
                    continue
                title = _safe_text(title_elem)
                if not title or len(title) < 5:
                    continue

                link_elem = _safe_find_first(div, "a")
                link = ""
                if link_elem and link_elem.has_attr("href"):
                    href = link_elem["href"]
                    link = href if href.startswith("http") else url + href

                iso_code = map_text_to_iso(title)
                article = {
                    "title": title,
                    "url": link,
                    "source": "economic_times",
                    "published_at": datetime.now(timezone.utc).isoformat(),
                    "content": title,
                    "iso_code": iso_code,
                    "type": "news",
                }
                articles.append(article)

            break  # success, exit retry loop

        except Exception as e:
            logger.warning(f"Economic Times scrape attempt {attempt + 1} failed: {e}")
            if attempt < retries - 1:
                time.sleep(backoff * (attempt + 1))

    logger.info(f"Economic Times scraper produced {len(articles)} articles")
    return articles


def scrape_with_retry(scraper_func, max_retries=3, base_delay=2):
    """Generic retry wrapper for scrapers."""
    last_exception = None
    for attempt in range(max_retries):
        try:
            result = scraper_func()
            if result:
                return result
        except Exception as e:
            last_exception = e
            logger.warning(f"Scraper attempt {attempt + 1}/{max_retries} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(base_delay * (attempt + 1))
    logger.error(f"All {max_retries} scraper attempts failed. Last error: {last_exception}")
    return []


def scrape_moneycontrol():
    url = "https://www.moneycontrol.com/news/business/"
    articles = []

    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        items = soup.find_all("li", class_="clearfix")
        if not items:
            items = soup.find_all("div", class_="news_list")

        logger.info(f"Moneycontrol found {len(items)} article containers")
        items = items[:15]

        for item in items:
            title_elem = _safe_find_first(item, "h2", "a")
            if not title_elem:
                continue
            title = _safe_text(title_elem)
            if not title or len(title) < 5:
                continue

            link_elem = _safe_find_first(item, "a")
            link = ""
            if link_elem and link_elem.has_attr("href"):
                href = link_elem["href"]
                link = href if href.startswith("http") else url + href

            iso_code = map_text_to_iso(title)
            article = {
                "title": title,
                "url": link,
                "source": "moneycontrol",
                "published_at": datetime.now(timezone.utc).isoformat(),
                "content": title,
                "iso_code": iso_code,
                "type": "news",
            }
            articles.append(article)

        logger.info(f"Moneycontrol scraper produced {len(articles)} articles")

    except Exception as e:
        logger.error(f"Moneycontrol scraper fatal error: {e}", exc_info=True)

    return articles


def scrape_reuters_rss():
    """Scrape Reuters business news via RSS feed."""
    url = "https://www.reuters.com/rssBusinessNews"
    articles = []

    try:
        import feedparser
        feed = feedparser.parse(url)

        for entry in feed.entries[:20]:
            title = entry.get("title", "")
            link = entry.get("link", "")
            published = entry.get("published", "")
            iso_code = map_text_to_iso(title)

            article = {
                "title": title,
                "url": link,
                "source": "reuters_rss",
                "published_at": published or datetime.now(timezone.utc).isoformat(),
                "content": title,
                "iso_code": iso_code,
                "type": "news",
            }
            articles.append(article)

        logger.info(f"Reuters RSS scraper produced {len(articles)} articles")
    except Exception as e:
        logger.error(f"Reuters RSS scraper error: {e}", exc_info=True)

    return articles


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    # Quick smoke test
    mc_articles = scrape_moneycontrol()
    et_articles = scrape_economic_times()
    reuters_articles = scrape_reuters_rss()
    print(f"Moneycontrol: {len(mc_articles)} | Economic Times: {len(et_articles)} | Reuters RSS: {len(reuters_articles)} articles")