"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/dashboard/Header";
import { MarketTicker } from "@/components/dashboard/MarketTicker";
import { Globe3D } from "@/components/globe/Globe3D";
import { TechnicalsPanel } from "@/components/dashboard/TechnicalsPanel";
import { SentimentFeed } from "@/components/dashboard/SentimentFeed";
import { useWebSocket } from "@/hooks/useWebSocket";
import { countryHref } from "@/lib/countries/format";

export default function DashboardPage() {
  const { ticks, articles, connected } = useWebSocket();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-cyber-bg flex flex-col">
      <Header connected={connected} />
      <MarketTicker ticks={ticks} />
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4">
        <div className="lg:col-span-8 hud-panel rounded-lg relative overflow-hidden h-[600px] lg:h-auto lg:min-h-[640px]">
          <Globe3D onSelectHub={(iso) => router.push(countryHref(iso))} />
          <div className="absolute top-4 left-4 font-display text-xs tracking-[0.2em] text-gold/80">WORLD MARKETS</div>
          <div className="absolute bottom-4 left-4 flex items-center gap-3 font-mono text-[10px] text-ink-muted bg-black/50 px-3 py-1.5 rounded border border-white/10">
            <span><span className="text-cyber-green">●</span> Calm</span>
            <span><span className="text-amber-500">●</span> Elevated</span>
            <span><span className="text-cyber-red">●</span> Critical</span>
            <span><span className="text-gold">●</span> No signal</span>
            <span className="text-ink-faint">· Drag to rotate · click a country to open its page</span>
          </div>
        </div>
        <div className="lg:col-span-4 flex flex-col space-y-4">
          <TechnicalsPanel symbol="AAPL" />
          <SentimentFeed articles={articles} />
        </div>
      </div>
    </div>
  );
}
