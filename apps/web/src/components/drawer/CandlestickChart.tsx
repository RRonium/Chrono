export type Candle = { open: number; high: number; low: number; close: number };

export function CandlestickChart({ candles = [] }: { candles?: Candle[] }) {
  return <div aria-label="Candlestick chart" data-candle-count={candles.length} />;
}
