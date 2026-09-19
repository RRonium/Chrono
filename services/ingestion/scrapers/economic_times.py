import requests
from bs4 import BeautifulSoup
from datetime import datetime, timezone
from services.ingestion.etl.iso_tagger import map_text_to_iso

def scrape_economic_times():
    url = "https://economictimes.indiatimes.com/news/economy"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    articles = []
    try:
        response = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.text, "html.parser")
        divs = soup.find_all("div", class_="story-box")
        if not divs:
            divs = soup.find_all("div", class_="eachStory")
        
        for div in divs[:15]:
            title_elem = div.find("h3") or div.find("a")
            if not title_elem:
                continue
            title = title_elem.get_text(strip=True)
            link_elem = div.find("a")
            link = "https://economictimes.indiatimes.com" + link_elem["href"] if link_elem and "href" in link_elem.attrs else url
            
            iso_code = map_text_to_iso(title)
            article = {
                "title": title,
                "url": link,
                "source": "economic_times",
                "published_at": datetime.now(timezone.utc).isoformat(),
                "content": title,
                "iso_code": iso_code,
                "type": "news"
            }
            articles.append(article)
    except Exception as e:
        pass
    return articles
