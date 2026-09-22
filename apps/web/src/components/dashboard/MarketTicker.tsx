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
    <div className="bg-[#12121a] border-b border-cyan-500/20 py-2.5 px-4 overflow-hidden flex items-center font-mono text-xs shadow-[0_0_10px_rgba(0,240,255,0.05)]">
      <span className="text-cyan-400 mr-4 uppercase tracking-widest shrink-0 font-bold">LIVE TICKS:</span>
      <div className="flex space-x-8 overflow-x-auto whitespace-nowrap scrollbar-none">
        {latestBySymbol.length === 0 ? (
          <span className="text-slate-500">Waiting for live market feeds...</span>
        ) : (
          latestBySymbol.map((tick, idx) => {
            const changePct = typeof tick.change_pct === "number" ? tick.change_pct : 0.0;
            const isPositive = changePct >= 0;
            const sign = isPositive ? "+" : "";

            return (
              <div key={tick.symbol || idx} className="flex items-center space-x-2 bg-black/40 px-3 py-1 rounded border border-cyan-500/20">
                <span className="font-bold text-cyan-300">{tick.symbol}</span>
                <span className="text-white">${typeof tick.price === "number" ? tick.price.toFixed(2) : tick.price}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    isPositive
                      ? "bg-emerald-500/20 text-[#00ff9d] border border-emerald-500/40"
                      : "bg-rose-500/20 text-[#ff0055] border border-rose-500/40"
                  }`}
                >
                  {sign}{changePct.toFixed(2)}%
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
