import { useEffect, useSyncExternalStore } from "react";
import { API_URL, WS_URL } from "@/lib/constants";

const MARKET_DISPLAY_INTERVAL_MS = 4000;
const RECONNECT_DELAY_MS = 3000;
const MAX_ARTICLES = 100;

type LiveState = { ticks: any[]; articles: any[]; connected: boolean };

// One socket per browser tab, shared by every component that calls useWebSocket().
let state: LiveState = { ticks: [], articles: [], connected: false };
const listeners = new Set<() => void>();
let subscribers = 0;
let ws: WebSocket | null = null;
let flushTimer: number | undefined;
let reconnectTimer: number | undefined;
let historyLoaded = false;
const pendingTicks = new Map<string, any>();

function setState(patch: Partial<LiveState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function articleKey(article: any): string {
  return article.url || article.title;
}

function mergeArticles(incoming: any[], existing: any[]): any[] {
  const seen = new Set<string>();
  const merged: any[] = [];
  for (const article of [...incoming, ...existing]) {
    const key = articleKey(article);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(article);
  }
  return merged
    .sort((a, b) => Date.parse(b.published_at ?? 0) - Date.parse(a.published_at ?? 0))
    .slice(0, MAX_ARTICLES);
}

// Seed the feed with stored articles so it is not empty until the next scrape.
async function loadHistory() {
  if (historyLoaded) return;
  historyLoaded = true;
  try {
    const res = await fetch(`${API_URL}/api/v1/news?limit=60`);
    if (!res.ok) return;
    const stored = await res.json();
    if (Array.isArray(stored)) setState({ articles: mergeArticles(state.articles, stored) });
  } catch {
    historyLoaded = false;
  }
  // Latest quote per symbol, so country pages are filled before the next poll arrives.
  try {
    const res = await fetch(`${API_URL}/api/v1/market/latest`);
    if (!res.ok) return;
    const quotes = await res.json();
    if (!Array.isArray(quotes)) return;
    const latest = new Map(quotes.filter((tick) => tick?.symbol).map((tick) => [tick.symbol, tick]));
    state.ticks.forEach((tick) => latest.set(tick.symbol, tick));
    setState({ ticks: Array.from(latest.values()) });
  } catch {}
}

function connect() {
  ws = new WebSocket(WS_URL);
  ws.onopen = () => setState({ connected: true });
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "market") {
        if (data.symbol) pendingTicks.set(data.symbol, data);
      } else if (data.type === "news") {
        setState({ articles: mergeArticles([data], state.articles) });
      }
    } catch {}
  };
  ws.onclose = () => {
    setState({ connected: false });
    if (subscribers > 0) reconnectTimer = window.setTimeout(connect, RECONNECT_DELAY_MS);
  };
}

function start() {
  connect();
  loadHistory();
  flushTimer = window.setInterval(() => {
    if (pendingTicks.size === 0) return;
    const latest = new Map(state.ticks.map((tick) => [tick.symbol, tick]));
    pendingTicks.forEach((tick, symbol) => latest.set(symbol, tick));
    pendingTicks.clear();
    setState({ ticks: Array.from(latest.values()) });
  }, MARKET_DISPLAY_INTERVAL_MS);
}

function stop() {
  window.clearInterval(flushTimer);
  window.clearTimeout(reconnectTimer);
  ws?.close();
  ws = null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const serverState: LiveState = { ticks: [], articles: [], connected: false };

export function useWebSocket(): LiveState {
  useEffect(() => {
    subscribers += 1;
    if (subscribers === 1) start();
    return () => {
      subscribers -= 1;
      if (subscribers === 0) stop();
    };
  }, []);

  return useSyncExternalStore(subscribe, () => state, () => serverState);
}
