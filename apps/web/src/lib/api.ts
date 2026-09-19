const BACKEND_URL = "http://localhost:8000";
const ANALYTICS_URL = "http://localhost:8001";

export async function fetchLatestTick(symbol: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/market/ticks/${symbol}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

export async function fetchOHLC(symbol: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/market/ohlc/${symbol}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    return [];
  }
}

export async function fetchNews(isoCode?: string) {
  try {
    const url = isoCode ? `${BACKEND_URL}/api/v1/news?iso_code=${isoCode}` : `${BACKEND_URL}/api/v1/news`;
    const res = await fetch(url);
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    return [];
  }
}

export async function fetchAgentBrief(isoCode: string) {
  try {
    const res = await fetch(`${ANALYTICS_URL}/api/v1/agents/brief/${isoCode}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}
