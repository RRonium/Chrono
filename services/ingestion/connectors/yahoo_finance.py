import logging
from datetime import datetime, timezone
import yfinance as yf
from services.ingestion.etl.iso_tagger import map_symbol_to_iso

logger = logging.getLogger(__name__)

# Keep last observed prices in memory for real percentage change calculation
_last_known_prices: dict[str, float] = {}

def fetch_yahoo_ticks(symbols=None):
    """
    Fetch market ticks using fast_info / 1d history.
    Sanitizes symbols to prevent '$' prefix issues.
    Calculates change_pct directly against prior tick.
    """
    if symbols is None:
        symbols = ["AAPL", "MSFT", "RELIANCE.NS", "TATAMOTORS.NS", "TSLA", "GOOGL", "^NSEI", "^GSPC"]

    ticks = []
    for symbol in symbols:
        clean_symbol = symbol.replace('$', '').strip()
        if not clean_symbol:
            continue
        try:
            ticker = yf.Ticker(clean_symbol)
            info = ticker.fast_info
            current_price = getattr(info, "last_price", None)
            
            if current_price is None or current_price <= 0:
                hist = ticker.history(period="1d", interval="1m")
                if not hist.empty:
                    latest = hist.iloc[-1]
                    current_price = float(latest["Close"])
                else:
                    logger.warning(f"No current real-time tick available for {clean_symbol}, skipping.")
                    continue

            timestamp = datetime.now(timezone.utc)
            prev_price = _last_known_prices.get(clean_symbol, current_price)
            change_pct = round(((current_price - prev_price) / prev_price * 100.0), 2) if prev_price > 0 else 0.0
            _last_known_prices[clean_symbol] = current_price

            iso_code = map_symbol_to_iso(clean_symbol)
            tick = {
                "time": timestamp.isoformat(),
                "symbol": clean_symbol,
                "price": round(float(current_price), 4),
                "open": round(float(current_price), 4),
                "high": round(float(current_price), 4),
                "low": round(float(current_price), 4),
                "close": round(float(current_price), 4),
                "volume": float(getattr(info, "last_volume", 0.0) or 0.0),
                "change_pct": change_pct,
                "iso_code": iso_code,
                "type": "market"
            }
            ticks.append(tick)
        except Exception as e:
            logger.error(f"Error fetching real-time market tick for {clean_symbol}: {e}")

    return ticks
