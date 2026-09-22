import React from "react";

export function MarketTicker({ ticks }: { ticks: any[] }) {
  // Deduplicate ticks to show the latest price for each unique symbol
  const latestBySymbol = React.useMemo(() => {
    const map = new Map<string, any>();
    ticks.forEach((tick) => {
      if (tick && tick.symbol && !map.has(tick.symbol)) {
        map.set(tick.symbol, tick);
      }
    });
    return Array.from(map.values());
  }, [ticks]);

  return (
    <div className="h-12 bg-[#12121a] border-b border-cyan-500/20 px-4 overflow-hidden flex items-center font-mono text-xs shadow-[0_0_10px_rgba(0,240,255,0.05)]">
      <span className="text-cyan-400 mr-4 uppercase tracking-widest shrink-0 font-bold">LIVE TICKS:</span>
      <div className="flex space-x-8 overflow-x-auto whitespace-nowrap scrollbar-none">
        {latestBySymbol.length === 0 ? (
          <span className="text-slate-500">Waiting for live market feeds...</span>
        ) : (
          latestBySymbol.map((tick, idx) => {
            const price = typeof tick.price === "number" ? tick.price : parseFloat(tick.price) || 0;
            const prevClose = typeof tick.prev_close === "number" ? tick.prev_close : (typeof tick.open === "number" ? tick.open : price);
            
            let changePercent = typeof tick.change_pct === "number" ? tick.change_pct : 0.0;
            if (prevClose > 0 && price !== prevClose) {
              changePercent = ((price - prevClose) / prevClose) * 100;
            }

            const isPositive = changePercent >= 0;
            const sign = isPositive ? "+" : "";

            const isINR = tick.currency === "INR" || tick.symbol?.includes(".NS") || tick.symbol?.includes("NSEI");
            const currencySymbol = isINR ? "₹" : "$";

            return (
              <div key={tick.symbol || idx} className="w-[210px] min-w-[210px] h-8 flex items-center space-x-2 bg-black/40 px-3 rounded border border-cyan-500/20">
                <span className="w-[72px] truncate font-bold text-cyan-300">{tick.symbol}</span>
                <span className="w-[78px] text-white tabular-nums">{currencySymbol}{price.toFixed(2)}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    isPositive
                      ? "text-emerald-400 bg-emerald-950/40 border border-emerald-500/40"
                      : "text-rose-400 bg-rose-950/40 border border-rose-500/40"
                  }`}
                >
                  {sign}{changePercent.toFixed(2)}%
                </span>
                <span className="text-slate-400 text-[10px]">[{tick.iso_code || "GLB"}]</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
