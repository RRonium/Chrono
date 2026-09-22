import { useEffect, useState } from "react";

const MARKET_DISPLAY_INTERVAL_MS = 4000;

export function useWebSocket() {
  const [ticks, setTicks] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8000/ws/live");
    const pendingTicks = new Map<string, any>();
    const flushTicks = window.setInterval(() => {
      if (pendingTicks.size === 0) return;

      setTicks((previous) => {
        const latest = new Map(previous.map((tick) => [tick.symbol, tick]));
        pendingTicks.forEach((tick, symbol) => latest.set(symbol, tick));
        return Array.from(latest.values()).slice(-50).reverse();
      });
      pendingTicks.clear();
    }, MARKET_DISPLAY_INTERVAL_MS);

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "market") {
          if (data.symbol) pendingTicks.set(data.symbol, data);
        } else if (data.type === "news") {
          setArticles((prev) => [data, ...prev.slice(0, 49)]);
        }
      } catch (e) {}
    };

    ws.onclose = () => {
      setConnected(false);
    };

    return () => {
      window.clearInterval(flushTicks);
      ws.close();
    };
  }, []);

  return { ticks, articles, connected };
}