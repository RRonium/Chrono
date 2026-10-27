import React from "react";
import { symbolLabel } from "@/lib/constants";

export function changePercent(tick: any): number {
  const price = Number(tick.price) || 0;
  const prevClose = Number(tick.prev_close);
  if (prevClose > 0 && price > 0) return ((price - prevClose) / prevClose) * 100;
  return typeof tick.change_pct === "number" ? tick.change_pct : 0;
}

export function formatPrice(tick: any): string {
  const price = Number(tick.price) || 0;
  const symbol: string = tick.symbol ?? "";
  if (tick.kind === "index" || symbol.startsWith("^")) return price.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  const isINR = tick.currency === "INR" || symbol.endsWith(".NS") || symbol.endsWith(".BO");
  const currency = isINR ? "INR" : tick.currency || "USD";
  try {
    return new Intl.NumberFormat(isINR ? "en-IN" : "en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(price);
  } catch {
    return `${price.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`;
  }
}

function TickerItem({ tick }: { tick: any }) {
  const change = changePercent(tick);
  const up = change >= 0;
  return (
    <div className="flex items-baseline gap-2.5 whitespace-nowrap px-6 border-r border-white/5">
      <span className="font-semibold tracking-wide text-ink">{symbolLabel(tick.symbol)}</span>
      <span className="tabular-nums text-ink-muted">{formatPrice(tick)}</span>
      <span className={`tabular-nums text-[11px] font-semibold ${up ? "text-cyber-green" : "text-cyber-red"}`}>
        {up ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
      </span>
    </div>
  );
}

export function MarketTicker({ ticks }: { ticks: any[] }) {
  const items = React.useMemo(
    // Country-page quotes (source "country") stay off the scrolling ticker.
    () => [...ticks].filter((t) => t?.symbol && t.source !== "country").sort((a, b) => symbolLabel(a.symbol).localeCompare(symbolLabel(b.symbol))),
    [ticks],
  );

  return (
    <div className="h-11 bg-[#08111f] border-b border-cyber-border flex items-center font-mono text-xs">
      <span className="shrink-0 h-full flex items-center px-4 bg-gold/10 border-r border-cyber-border text-gold font-bold tracking-[0.2em] text-[10px]">
        MARKETS
      </span>
      <div className="ticker-wrap relative flex-1 overflow-hidden">
        {items.length === 0 ? (
          <span className="px-6 text-ink-faint">Waiting for live market feeds...</span>
        ) : (
          // The list is rendered twice so the scroll loops without a gap; hover pauses it.
          <div className="ticker-track" style={{ animationDuration: `${Math.max(30, items.length * 7)}s` }}>
            {[...items, ...items].map((tick, idx) => (
              <TickerItem key={`${tick.symbol}-${idx}`} tick={tick} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
