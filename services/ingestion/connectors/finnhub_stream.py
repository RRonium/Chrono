import json
import logging
import threading
import time
from datetime import datetime, timezone
import websocket
import yfinance as yf
from services.ingestion.config import settings
from services.ingestion.etl.iso_tagger import map_symbol_to_iso
from services.ingestion.etl.persistence_router import route_record, get_redis_client

logger = logging.getLogger(__name__)

DEFAULT_SYMBOLS = [
    "AAPL",
    "MSFT",
    "GOOGL",
    "TSLA",
    "RELIANCE.NS",
    "^NSEI",
    "BINANCE:BTCUSDT",
    "BINANCE:ETHUSDT",
]

# Track baseline previous close and session open prices
_previous_prices: dict[str, float] = {}
_session_open_prices: dict[str, float] = {}


def _initialize_baselines():
    """Fetch initial baseline quotes and prev_close for Indian assets or regional proxies via yfinance with symbol sanitization."""
    baseline_symbols = ["RELIANCE.NS", "^NSEI", "^GSPC"]
    try:
        r = get_redis_client()
        for sym in baseline_symbols:
            clean_sym = sym.replace('$', '').strip()
            if not clean_sym:
                continue
            try:
                ticker = yf.Ticker(clean_sym)
                info = ticker.fast_info
                pclose = getattr(info, "previous_close", None) or getattr(info, "last_price", 0.0)
                if pclose and pclose > 0:
                    _session_open_prices[clean_sym] = float(pclose)
                    _previous_prices[clean_sym] = float(pclose)
                    r.set(f"market:baseline:{clean_sym}", float(pclose))
                    logger.info(f"Initialized yfinance baseline for {clean_sym}: prev_close={pclose}")
            except Exception as e:
                logger.warning(f"Could not fetch yfinance baseline for {clean_sym}: {e}")
    except Exception as e:
        logger.warning(f"Redis baseline cache initialization error: {e}")


class FinnhubStreamer:
    def __init__(self, api_key: str = None, symbols: list[str] = None):
        self.api_key = api_key or settings.FINNHUB_API_KEY
        raw_symbols = symbols or DEFAULT_SYMBOLS
        # Sanitize all input symbols
        self.symbols = [s.replace('$', '').strip() for s in raw_symbols if s and s.replace('$', '').strip()]
        self.ws = None
        self.thread = None
        self.is_running = False
        # Initialize baselines on startup
        _initialize_baselines()

    def _on_message(self, ws, message):
        try:
            data = json.loads(message)
            msg_type = data.get("type")
            if msg_type == "trade":
                trades = data.get("data", [])
                for trade in trades:
                    raw_symbol = trade.get("s", "")
                    symbol = raw_symbol.replace('$', '').strip()
                    if not symbol:
                        continue
                    price = float(trade.get("p", 0.0))
                    volume = float(trade.get("v", 0.0))
                    t_ms = trade.get("t", int(time.time() * 1000))
                    timestamp = datetime.fromtimestamp(t_ms / 1000.0, tz=timezone.utc).isoformat()
                    
                    if symbol not in _session_open_prices:
                        try:
                            r = get_redis_client()
                            val = r.get(f"market:baseline:{symbol}")
                            if val:
                                _session_open_prices[symbol] = float(val)
                            else:
                                _session_open_prices[symbol] = price
                        except Exception:
                            _session_open_prices[symbol] = price

                    prev_close = _session_open_prices.get(symbol, price)
                    if prev_close <= 0:
                        prev_close = price

                    change_pct = round(((price - prev_close) / prev_close * 100.0), 2)
                    _previous_prices[symbol] = price

                    is_inr = "NS" in symbol or "NSEI" in symbol
                    currency = "INR" if is_inr else "USD"

                    record = {
                        "time": timestamp,
                        "symbol": symbol,
                        "price": round(price, 4),
                        "prev_close": round(prev_close, 4),
                        "open": round(prev_close, 4),
                        "high": round(max(price, prev_close), 4),
                        "low": round(min(price, prev_close), 4),
                        "close": round(price, 4),
                        "volume": round(volume, 4),
                        "change_pct": change_pct,
                        "currency": currency,
                        "iso_code": map_symbol_to_iso(symbol),
                        "type": "market",
                    }
                    route_record(record)
            elif msg_type == "ping":
                ws.send(json.dumps({"type": "pong"}))
        except Exception as e:
            logger.error(f"Error parsing Finnhub WebSocket message: {e}", exc_info=True)

    def _on_error(self, ws, error):
        logger.error(f"Finnhub WebSocket error: {error}")

    def _on_close(self, ws, close_status_code, close_msg):
        logger.warning(f"Finnhub WebSocket closed: code={close_status_code}, msg={close_msg}")
        self.is_running = False

    def _on_open(self, ws):
        logger.info("Finnhub WebSocket connected successfully")
        for sym in self.symbols:
            sub_msg = json.dumps({"type": "subscribe", "symbol": sym})
            ws.send(sub_msg)
            logger.info(f"Subscribed to Finnhub symbol: {sym}")

    def start(self):
        if not self.api_key:
            logger.warning("No FINNHUB_API_KEY provided. Finnhub real-time stream disabled.")
            return

        def run():
            url = f"wss://ws.finnhub.io?token={self.api_key}"
            while self.is_running:
                try:
                    self.ws = websocket.WebSocketApp(
                        url,
                        on_message=self._on_message,
                        on_error=self._on_error,
                        on_close=self._on_close,
                        on_open=self._on_open,
                    )
                    self.ws.run_forever(ping_interval=30, ping_timeout=10)
                except Exception as e:
                    logger.error(f"Finnhub WebSocket run_forever failure: {e}")
                time.sleep(3)

        self.is_running = True
        self.thread = threading.Thread(target=run, daemon=True)
        self.thread.start()

    def stop(self):
        self.is_running = False
        if self.ws:
            self.ws.close()

_streamer_instance: FinnhubStreamer | None = None

def start_finnhub_stream(api_key: str = None, symbols: list[str] = None):
    global _streamer_instance
    if _streamer_instance is None or not _streamer_instance.is_running:
        _streamer_instance = FinnhubStreamer(api_key=api_key, symbols=symbols)
        _streamer_instance.start()
    return _streamer_instance
