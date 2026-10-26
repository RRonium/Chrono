import requests
from bs4 import BeautifulSoup
from datetime import datetime, timezone
from services.ingestion.etl.iso_tagger import map_text_to_iso

def scrape_moneycontrol():
    url = "https://www.moneycontrol.com/news/business/"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    articles = []
    try:
        response = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.text, "html.parser")
        items = soup.find_all("li", class_="clearfix")
        if not items:
            items = soup.find_all("div", class_="news_list")
        
        for item in items[:15]:
            title_elem = item.find("h2") or item.find("a")
            if not title_elem:
                continue
            title = title_elem.get_text(strip=True)
            link_elem = item.find("a")
            link = link_elem["href"] if link_elem and "href" in link_elem.attrs else url
            
            # The page shows human-readable times ("Oct 26, 2026 11:02 PM IST"); store ISO UTC
            # so MongoDB can sort Moneycontrol articles alongside every other source.
            date_str = datetime.now(timezone.utc).isoformat()
            
            iso_code = map_text_to_iso(title)
            article = {
                "title": title,
                "url": link,
                "source": "moneycontrol",
                "published_at": date_str,
                "content": title,
                "iso_code": iso_code,
                "type": "news"
            }
            articles.append(article)
    except Exception as e:
        pass
    return articles
