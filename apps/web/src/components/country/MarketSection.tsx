"use client";

import React, { useEffect, useState } from "react";
import { ExternalLink, Landmark } from "lucide-react";
import { GLOBAL_HUBS } from "@/lib/constants";
import { marketStatus } from "@/components/dashboard/Header";
import { changePercent, formatPrice } from "@/components/dashboard/MarketTicker";
import { TechnicalsPanel } from "@/components/dashboard/TechnicalsPanel";
import type { CountryMarket } from "@/lib/countries/types";

function SessionClock({ iso }: { iso: string }) {
  const hub = GLOBAL_HUBS.find((h) => h.iso === iso);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  if (!hub || !now) return null;
  const { time, open } = marketStatus(hub, now);
  return (
    <span className="font-mono text-[10px] text-ink-muted">
      {time} local · <span className={open ? "text-cyber-green" : "text-ink-faint"}>{open ? "● OPEN" : "○ CLOSED"}</span>
    </span>
  );
}

function Quote({ name, symbol, tick }: { name: string; symbol: string; tick?: any }) {
  const change = tick ? changePercent(tick) : null;
  return (
    <div className="flex items-baseline justify-between gap-2 py-1.5 border-b border-white/5 last:border-0">
      <div className="min-w-0">
        <div className="text-[13px] text-ink truncate">{name}</div>
        <div className="font-mono text-[10px] text-ink-faint">{symbol}</div>
      </div>
      {tick ? (
        <div className="text-right font-mono text-xs tabular-nums">
          <div className="text-ink">{formatPrice(tick)}</div>
          <div className={change! >= 0 ? "text-cyber-green" : "text-cyber-red"}>
            {change! >= 0 ? "▲" : "▼"} {Math.abs(change!).toFixed(2)}%
          </div>
        </div>
      ) : (
        <span className="font-mono text-[10px] text-ink-faint">no live feed</span>
      )}
    </div>
  );
}

export function MarketSection({ iso, market, ticks }: { iso: string; market: CountryMarket; ticks: any[] }) {
  const bySymbol = new Map(ticks.filter((t) => t?.symbol).map((t) => [String(t.symbol).toUpperCase(), t]));
  const chartSymbols = [...market.indices, ...market.companies].map((q) => q.symbol).slice(0, 6);

  return (
    <section className="space-y-4">
      <div className="hud-panel rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-sm tracking-[0.15em] text-gold">MARKETS</h3>
          <SessionClock iso={iso} />
        </div>
        <p className="text-[13px] leading-relaxed text-ink-muted mb-3">{market.summary}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="font-mono text-[10px] tracking-wider text-ink-faint mb-1">INDICES</div>
            {market.indices.map((q) => (
              <Quote key={q.symbol} {...q} tick={bySymbol.get(q.symbol.toUpperCase())} />
            ))}
          </div>
          <div>
            <div className="font-mono text-[10px] tracking-wider text-ink-faint mb-1">LARGEST LISTED COMPANIES</div>
            {market.companies.map((q) => (
              <Quote key={q.symbol} {...q} tick={bySymbol.get(q.symbol.toUpperCase())} />
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 font-mono text-[11px]">
          {market.exchanges.map((ex) => (
            <a key={ex.name} href={ex.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-ink-muted hover:text-gold-soft">
              <ExternalLink className="h-3 w-3 shrink-0" /> {ex.name} · {ex.city}
            </a>
          ))}
          {[market.centralBank, market.regulator].filter(Boolean).map((org) => (
            <a key={org!.name} href={org!.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-ink-muted hover:text-gold-soft">
              <Landmark className="h-3 w-3 shrink-0" /> {org!.name}
            </a>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {market.sectors.map((sector) => (
            <span key={sector} className="rounded border border-white/10 bg-black/30 px-2 py-0.5 font-mono text-[10px] text-ink-muted">
              {sector}
            </span>
          ))}
        </div>
      </div>
      <TechnicalsPanel symbol={chartSymbols[0]} symbols={chartSymbols} />
    </section>
  );
}
