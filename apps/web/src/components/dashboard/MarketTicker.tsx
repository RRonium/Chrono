import React from "react";

export function MarketTicker({ ticks }: { ticks: any[] }) {
  return (
    <div className="bg-[#12121a] border-b border-cyan-500/20 py-2.5 px-4 overflow-hidden flex items-center font-mono text-xs shadow-[0_0_10px_rgba(0,240,255,0.05)]">
      <span className="text-cyan-400 mr-4 uppercase tracking-widest shrink-0 font-bold">LIVE TICKS:</span>
      <div className="flex space-x-8 overflow-x-auto whitespace-nowrap scrollbar-none">
        {ticks.length === 0 ? (
          <span className="text-slate-500">Waiting for live market feeds...</span>
        ) : (
          ticks.map((tick, idx) => {
            const isPositive = (idx % 2 === 0);
            return (
              <div key={idx} className="flex items-center space-x-2 bg-black/40 px-3 py-1 rounded border border-cyan-500/20">
                <span className="font-bold text-cyan-300">{tick.symbol}</span>
                <span className="text-white">${tick.price?.toFixed(2)}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${isPositive ? "bg-emerald-500/20 text-[#00ff9d] border border-emerald-500/40" : "bg-rose-500/20 text-[#ff0055] border border-rose-500/40"}`}>
                  {isPositive ? "+1.42%" : "-0.85%"}
                </span>
                <span className="text-slate-400 text-[10px]">[{tick.iso_code}]</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
