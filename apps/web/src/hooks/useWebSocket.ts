import { useEffect, useState } from "react";

export function useWebSocket() {
  const [ticks, setTicks] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8000/ws/live");

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "market") {
          setTicks((prev) => [data, ...prev.slice(0, 49)]);
        } else if (data.type === "news") {
          setArticles((prev) => [data, ...prev.slice(0, 49)]);
        }
      } catch (e) {}
    };

    ws.onclose = () => {
      setConnected(false);
    };

    return () => {
      ws.close();
    };
  }, []);

  return { ticks, articles, connected };
}
