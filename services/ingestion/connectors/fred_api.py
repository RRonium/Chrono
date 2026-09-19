import requests
from services.ingestion.config import settings

def fetch_fred_indicator(series_id="GDP"):
    api_key = settings.FRED_API_KEY
    if not api_key:
        return [{"series_id": series_id, "value": 0.0, "date": "2026-01-01"}]
    url = f"https://api.stlouisfed.org/fred/series/observations?series_id={series_id}&api_key={api_key}&file_type=json"
    try:
        response = requests.get(url, timeout=10)
        data = response.json()
        observations = data.get("observations", [])
        results = []
        for obs in observations[-10:]:
            results.append({
                "series_id": series_id,
                "value": float(obs["value"]) if obs["value"] != "." else 0.0,
                "date": obs["date"],
                "country_code": "USA",
                "type": "economic"
            })
        return results
    except Exception as e:
        return []
