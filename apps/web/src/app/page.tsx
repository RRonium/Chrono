"use client";

import React, { useState } from "react";
import { Header } from "@/components/dashboard/Header";
import { MarketTicker } from "@/components/dashboard/MarketTicker";
import { Globe3D } from "@/components/globe/Globe3D";
import { TechnicalsPanel } from "@/components/dashboard/TechnicalsPanel";
import { SentimentFeed } from "@/components/dashboard/SentimentFeed";
import { AgenticBriefModal } from "@/components/dashboard/AgenticBriefModal";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function DashboardPage() {
  const { ticks, articles, connected } = useWebSocket();
  const [selectedHub, setSelectedHub] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-cyber-bg flex flex-col">
      <Header connected={connected} />
      <MarketTicker ticks={ticks} />
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4">
        <div className="lg:col-span-8 bg-cyber-card border border-cyber-border rounded-lg relative overflow-hidden h-[600px] lg:h-auto flex items-center justify-center">
          <Globe3D onSelectHub={(iso) => setSelectedHub(iso)} />
          <div className="absolute bottom-4 left-4 font-mono text-[10px] text-slate-500 bg-black/60 px-2 py-1 rounded border border-cyber-border">
            INTERACTIVE 3D SPHERE // CLICK NODE FOR AGENT BRIEF
          </div>
        </div>
        <div className="lg:col-span-4 flex flex-col space-y-4">
          <TechnicalsPanel symbol="AAPL" />
          <SentimentFeed articles={articles} />
        </div>
      </div>
      <AgenticBriefModal isoCode={selectedHub} onClose={() => setSelectedHub(null)} />
    </div>
  );
}
