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
    Eliminates fallback routines to stale previous_close so stale values are not masked.
    Calculates change_pct directly against prior tick.
    """
    if symbols is None:
        symbols = ["AAPL", "MSFT", "RELIANCE.NS", "TATAMOTORS.NS", "TSLA", "GOOGL", "^NSEI", "^GSPC"]

    ticks = []
    for symbol in symbols:
        try:
            ticker = yf.Ticker(symbol)
            # Use fast_info directly for real-time last_price without stale 1m candle delay
            info = ticker.fast_info
            current_price = getattr(info, "last_price", None)
            
            # If fast_info doesn't return last_price, inspect 1d latest row
            if current_price is None or current_price <= 0:
                hist = ticker.history(period="1d", interval="1m")
                if not hist.empty:
                    latest = hist.iloc[-1]
                    current_price = float(latest["Close"])
                else:
                    logger.warning(f"No current real-time tick available for {symbol}, skipping.")
                    continue

            timestamp = datetime.now(timezone.utc)
            prev_price = _last_known_prices.get(symbol, current_price)
            change_pct = round(((current_price - prev_price) / prev_price * 100.0), 2) if prev_price > 0 else 0.0
            _last_known_prices[symbol] = current_price

            iso_code = map_symbol_to_iso(symbol)
            tick = {
                "time": timestamp.isoformat(),
                "symbol": symbol,
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
            logger.error(f"Error fetching real-time market tick for {symbol}: {e}")

    return ticks
