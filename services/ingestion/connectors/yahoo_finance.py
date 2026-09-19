import yfinance as yf
from datetime import datetime, timezone
from services.ingestion.etl.iso_tagger import map_symbol_to_iso

def fetch_yahoo_ticks(symbols=None):
    if symbols is None:
        symbols = ["AAPL", "MSFT", "RELIANCE.NS", "TATAMOTORS.NS", "TSLA", "GOOGL", "^NSEI", "^GSPC"]
    
    ticks = []
    for symbol in symbols:
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period="1d", interval="1m")
            if not hist.empty:
                latest = hist.iloc[-1]
                timestamp = latest.name.to_pydatetime()
                if timestamp.tzinfo is None:
                    timestamp = timestamp.replace(tzinfo=timezone.utc)
                else:
                    timestamp = timestamp.astimezone(timezone.utc)
                
                iso_code = map_symbol_to_iso(symbol)
                tick = {
                    "time": timestamp.isoformat(),
                    "symbol": symbol,
                    "price": float(latest["Close"]),
                    "open": float(latest["Open"]),
                    "high": float(latest["High"]),
                    "low": float(latest["Low"]),
                    "close": float(latest["Close"]),
                    "volume": float(latest["Volume"]) if "Volume" in latest else 0.0,
                    "iso_code": iso_code,
                    "type": "market"
                }
                ticks.append(tick)
            else:
                info = ticker.fast_info
                price = getattr(info, "last_price", None) or getattr(info, "previous_close", 0.0)
                timestamp = datetime.now(timezone.utc)
                iso_code = map_symbol_to_iso(symbol)
                tick = {
                    "time": timestamp.isoformat(),
                    "symbol": symbol,
                    "price": float(price),
                    "open": float(price),
                    "high": float(price),
                    "low": float(price),
                    "close": float(price),
                    "volume": 0.0,
                    "iso_code": iso_code,
                    "type": "market"
                }
                ticks.append(tick)
        except Exception as e:
            pass
    return ticks
