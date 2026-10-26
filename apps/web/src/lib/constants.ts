export type Hub = {
  name: string;
  lat: number;
  lng: number;
  symbol: string;
  iso: string;
  exchange: string;
  index: string;
  timezone: string;
  open: [number, number]; // [open, close] in minutes after local midnight, Monday to Friday
  currency: string;
  labelLeft?: boolean; // place the globe label left of the marker to avoid a neighbour
};

export const GLOBAL_HUBS: Hub[] = [
  { name: "USA", lat: 40.7069, lng: -74.0113, symbol: "^GSPC", iso: "USA", exchange: "NYSE / NASDAQ", index: "S&P 500", timezone: "America/New_York", open: [570, 960], currency: "USD" },
  { name: "India", lat: 19.0760, lng: 72.8777, symbol: "^NSEI", iso: "IND", exchange: "NSE / BSE", index: "NIFTY 50", timezone: "Asia/Kolkata", open: [555, 930], currency: "INR" },
  { name: "Germany", lat: 50.1109, lng: 8.6821, symbol: "BMW.DE", iso: "DEU", exchange: "Xetra", index: "DAX", timezone: "Europe/Berlin", open: [540, 1050], currency: "EUR" },
  { name: "UK", lat: 51.5074, lng: -0.1278, symbol: "SHEL.L", iso: "GBR", exchange: "LSE", index: "FTSE 100", timezone: "Europe/London", open: [480, 990], currency: "GBP", labelLeft: true },
  { name: "Japan", lat: 35.6762, lng: 139.6503, symbol: "7203.T", iso: "JPN", exchange: "TSE", index: "Nikkei 225", timezone: "Asia/Tokyo", open: [540, 900], currency: "JPY" },
  { name: "China", lat: 31.2304, lng: 121.4737, symbol: "000001.SS", iso: "CHN", exchange: "SSE", index: "SSE Composite", timezone: "Asia/Shanghai", open: [570, 900], currency: "CNY" },
];

// Friendly names so the ticker shows "NIFTY 50", not "^NSEI"
export const SYMBOL_LABELS: Record<string, string> = {
  "^GSPC": "S&P 500",
  "^NSEI": "NIFTY 50",
  "RELIANCE.NS": "RELIANCE",
  "TATAMOTORS.NS": "TATA MOTORS",
  "BINANCE:BTCUSDT": "BITCOIN",
  "BINANCE:ETHUSDT": "ETHEREUM",
};

export function symbolLabel(symbol: string): string {
  return SYMBOL_LABELS[symbol] ?? symbol;
}

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const ANALYTICS_URL = process.env.NEXT_PUBLIC_ANALYTICS_URL ?? "http://localhost:8001";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/live";
