import re

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

TEXT_ISO_KEYWORDS = [
    ("IND", ["india", "sensex", "nifty", "rupee", "mumbai", "rbi", "modi", "reliance", "sebi", "bse", "nse"]),
    ("GBR", ["uk", "britain", "british", "london", "ftse", "pound", "boe", "sterling"]),
    ("DEU", ["germany", "frankfurt", "dax", "berlin", "ecb", "bundesbank"]),
    ("JPN", ["japan", "tokyo", "nikkei", "yen", "boj"]),
    ("CHN", ["china", "beijing", "shanghai", "yuan", "pboc", "hang seng"]),
]

def match_text_to_iso(text: str):
    """Return the ISO code whose keywords appear in the text, or None if nothing matches."""
    words = set(re.findall(r"[a-z]+", text.lower()))
    lower = text.lower()
    for iso, keywords in TEXT_ISO_KEYWORDS:
        for kw in keywords:
            if (" " in kw and kw in lower) or kw in words:
                return iso
    return None

def map_text_to_iso(text: str) -> str:
    return match_text_to_iso(text) or "USA"

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
