"""Quotes for the indices and companies listed in data/countries/<ISO>/market.json.

Every country page shows these symbols, so the worker polls all of them on a slower
interval than the core ticker symbols, one Yahoo Finance request per symbol.
"""
import json
import logging
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

import yfinance as yf

logger = logging.getLogger(__name__)

COUNTRIES_DIR = Path(os.getenv("COUNTRIES_DATA_DIR", Path(__file__).resolve().parents[3] / "data" / "countries"))

# Yahoo quotes some exchanges in minor units (pence, agorot, cents); show them in the major currency.
MINOR_UNITS = {"GBp": "GBP", "GBX": "GBP", "ILA": "ILS", "ZAc": "ZAR", "ZAC": "ZAR"}


@lru_cache(maxsize=1)
def load_country_symbols() -> dict[str, dict]:
    """Map each symbol in every market.json to {"iso_code", "kind", "name"}."""
    symbols: dict[str, dict] = {}
    for path in sorted(COUNTRIES_DIR.glob("*/market.json")):
        iso = path.parent.name
        try:
            market = json.loads(path.read_text())
        except (OSError, ValueError) as e:
            logger.warning(f"Skipping unreadable {path}: {e}")
            continue
        for kind, key in (("index", "indices"), ("equity", "companies")):
            for entry in market.get(key, []):
                symbol = entry["symbol"].strip().upper()
                symbols.setdefault(symbol, {"iso_code": iso, "kind": kind, "name": entry["name"]})
    if not symbols:
        logger.warning(f"No market.json files found under {COUNTRIES_DIR}; country quotes disabled.")
    return symbols


def fetch_quote(symbol: str, meta: dict) -> dict | None:
    """Latest price and previous session close for one symbol, or None if Yahoo has no data."""
    ticker = yf.Ticker(symbol)
    hist = ticker.history(period="5d", interval="1d")
    closes = hist["Close"].dropna() if not hist.empty else []
    if len(closes) == 0:
        logger.warning(f"No Yahoo data for {symbol}, skipping.")
        return None

    info = getattr(ticker, "history_metadata", None) or {}
    price = float(info.get("regularMarketPrice") or closes.iloc[-1])
    prev_close = float(closes.iloc[-2]) if len(closes) >= 2 else float(info.get("chartPreviousClose") or price)
    currency = info.get("currency")
    if currency in MINOR_UNITS:
        currency = MINOR_UNITS[currency]
        price /= 100
        prev_close /= 100

    return {
        "time": datetime.now(timezone.utc).isoformat(),
        "symbol": symbol,
        "price": round(price, 4),
        "prev_close": round(prev_close, 4),
        "change_pct": round((price - prev_close) / prev_close * 100, 2) if prev_close else 0.0,
        "volume": float(hist["Volume"].fillna(0).iloc[-1]) if "Volume" in hist else 0.0,
        "currency": None if meta["kind"] == "index" else currency,
        "kind": meta["kind"],
        "iso_code": meta["iso_code"],
        "source": "country",
        "type": "market",
    }


def fetch_country_quotes(exclude: set[str] = frozenset(), max_workers: int = 8) -> list[dict]:
    """Quotes for every country symbol not in `exclude`; failures are logged and skipped."""
    symbols = {s: m for s, m in load_country_symbols().items() if s not in exclude}

    def safe_fetch(item):
        symbol, meta = item
        try:
            return fetch_quote(symbol, meta)
        except Exception as e:
            logger.warning(f"Country quote failed for {symbol}: {e}")
            return None

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        return [q for q in pool.map(safe_fetch, symbols.items()) if q]
