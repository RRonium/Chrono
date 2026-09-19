import requests

def fetch_world_bank_indicator(country="USA", indicator="NY.GDP.MKTP.CD"):
    url = f"https://api.worldbank.org/v2/country/{country}/indicator/{indicator}?format=json&per_page=5"
    try:
        response = requests.get(url, timeout=10)
        data = response.json()
        if len(data) > 1 and data[1]:
            results = []
            for item in data[1]:
                val = item.get("value")
                if val is not None:
                    results.append({
                        "indicator": indicator,
                        "value": float(val),
                        "date": item.get("date"),
                        "country_code": country,
                        "type": "economic"
                    })
            return results
        return []
    except Exception as e:
        return []
