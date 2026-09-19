SYMBOL_ISO_MAP = {
    "AAPL": "USA",
    "MSFT": "USA",
    "TSLA": "USA",
    "GOOGL": "USA",
    "^GSPC": "USA",
    "RELIANCE.NS": "IND",
    "TATAMOTORS.NS": "IND",
    "SBIN.NS": "IND",
    "^NSEI": "IND",
    "BMW.DE": "DEU",
    "SAP.DE": "DEU",
    "SHEL.L": "GBR",
    "AZN.L": "GBR",
    "7203.T": "JPN",
    "6758.T": "JPN"
}

def map_symbol_to_iso(symbol: str) -> str:
    return SYMBOL_ISO_MAP.get(symbol.upper(), "USA")

def map_text_to_iso(text: str) -> str:
    lower = text.lower()
    if any(kw in lower for kw in ["india", "sensex", "nifty", "rupee", "mumbai", "RBI", "modi", "reliance"]):
        return "IND"
    if any(kw in lower for kw in ["uk", "britain", "london", "ftse", "pound", "boe"]):
        return "GBR"
    if any(kw in lower for kw in ["germany", "frankfurt", "dax", "berlin", "ecb"]):
        return "DEU"
    if any(kw in lower for kw in ["japan", "tokyo", "nikkei", "yen", "boj"]):
        return "JPN"
    return "USA"

def tag_country(record: dict, country_code: str = None) -> dict:
    if "iso_code" in record and record["iso_code"]:
        return record
    if "symbol" in record:
        record["iso_code"] = map_symbol_to_iso(record["symbol"])
    elif "title" in record:
        record["iso_code"] = map_text_to_iso(record["title"])
    else:
        record["iso_code"] = country_code or "USA"
    return record
