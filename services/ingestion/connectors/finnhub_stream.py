import json
import logging
import threading
import time
from datetime import datetime, timezone
import websocket
from services.ingestion.config import settings
from services.ingestion.etl.iso_tagger import map_symbol_to_iso
from services.ingestion.etl.persistence_router import route_record

logger = logging.getLogger(__name__)

DEFAULT_SYMBOLS = [
    "AAPL",
    "MSFT",
    "GOOGL",
    "TSLA",
    "BINANCE:BTCUSDT",
    "BINANCE:ETHUSDT",
]

# Track previous prices for real change calculation
_previous_prices: dict[str, float] = {}

class FinnhubStreamer:
    def __init__(self, api_key: str = None, symbols: list[str] = None):
        self.api_key = api_key or settings.FINNHUB_API_KEY
        self.symbols = symbols or DEFAULT_SYMBOLS
        self.ws = None
        self.thread = None
        self.is_running = False

    def _on_message(self, ws, message):
        try:
            data = json.loads(message)
            msg_type = data.get("type")
            if msg_type == "trade":
                trades = data.get("data", [])
                for trade in trades:
                    symbol = trade.get("s")
                    price = float(trade.get("p", 0.0))
                    volume = float(trade.get("v", 0.0))
                    t_ms = trade.get("t", int(time.time() * 1000))
                    timestamp = datetime.fromtimestamp(t_ms / 1000.0, tz=timezone.utc).isoformat()
                    
                    prev = _previous_prices.get(symbol, price)
                    change_pct = round(((price - prev) / prev * 100.0), 2) if prev > 0 else 0.0
                    _previous_prices[symbol] = price

                    record = {
                        "time": timestamp,
                        "symbol": symbol,
                        "price": round(price, 4),
                        "open": round(price, 4),
                        "high": round(price, 4),
                        "low": round(price, 4),
                        "close": round(price, 4),
                        "volume": round(volume, 4),
                        "change_pct": change_pct,
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
