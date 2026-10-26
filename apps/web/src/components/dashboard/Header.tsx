import React, { useEffect, useState } from "react";
import { Globe2 } from "lucide-react";
import { GLOBAL_HUBS, Hub } from "@/lib/constants";

// Regular session hours only; exchange holidays and lunch breaks are not modelled.
function marketStatus(hub: Hub, now: Date): { time: string; open: boolean } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: hub.timezone,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  const weekday = get("weekday");
  const minutes = hour * 60 + minute;
  const weekend = weekday === "Sat" || weekday === "Sun";
  return {
    time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    open: !weekend && minutes >= hub.open[0] && minutes < hub.open[1],
  };
}

function MarketClocks() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  if (!now) return null;

  return (
    <div className="hidden xl:flex items-center divide-x divide-white/10 font-mono text-[10px]">
      {GLOBAL_HUBS.map((hub) => {
        const { time, open } = marketStatus(hub, now);
        return (
          <div key={hub.iso} className="px-3 flex flex-col items-center leading-tight">
            <span className="text-ink-faint tracking-wider">{hub.exchange.split(" ")[0]}</span>
            <span className="text-ink tabular-nums text-xs">{time}</span>
            <span className={open ? "text-cyber-green" : "text-ink-faint"}>{open ? "● OPEN" : "○ CLOSED"}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Header({ connected }: { connected: boolean }) {
  return (
    <header className="bg-[#07101e] border-b border-cyber-border px-6 py-3 flex items-center justify-between gap-6">
      <div className="flex items-center space-x-3">
        <Globe2 className="w-7 h-7 text-gold" />
        <div className="leading-tight">
          <h1 className="font-display text-xl tracking-[0.25em] text-ink">CHRONO</h1>
          <p className="font-mono text-[10px] tracking-[0.2em] text-gold-dim">GLOBAL MARKETS COMMAND CENTER</p>
        </div>
      </div>
      <MarketClocks />
      <div className="flex items-center space-x-2 font-mono text-[11px] px-3 py-1.5 rounded border border-white/10 bg-black/30">
        <span className={`w-2 h-2 rounded-full ${connected ? "bg-cyber-green animate-pulse" : "bg-cyber-red"}`} />
        <span className="text-ink-muted">{connected ? "LIVE FEED" : "DISCONNECTED"}</span>
      </div>
    </header>
  );
}
