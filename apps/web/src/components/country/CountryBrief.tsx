"use client";

import React, { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { fetchAgentBrief } from "@/lib/api";

// The analytics service's agent brief (formerly the globe popup). Collapses to one line when offline.
export function CountryBrief({ iso }: { iso: string }) {
  const [brief, setBrief] = useState<any>(undefined);

  useEffect(() => {
    fetchAgentBrief(iso).then(setBrief);
  }, [iso]);

  return (
    <section className="hud-panel rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-gold" />
        <h3 className="font-display text-sm tracking-[0.15em] text-gold">AI MARKET BRIEF</h3>
      </div>
      {brief === undefined ? (
        <p className="font-mono text-xs text-ink-faint">Synthesizing macro & market data...</p>
      ) : brief ? (
        <div className="space-y-3 font-mono text-xs">
          <div className="flex gap-6">
            <div>
              <span className="block text-ink-faint mb-0.5">TREND</span>
              <span className={`text-sm font-bold ${brief.trend === "BULLISH" ? "text-cyber-green" : "text-cyber-red"}`}>{brief.trend}</span>
            </div>
            <div>
              <span className="block text-ink-faint mb-0.5">SENTIMENT</span>
              <span className="text-sm text-ink">{brief.sentiment_score}</span>
            </div>
          </div>
          <p className="text-[13px] leading-relaxed text-ink font-sans">{brief.summary}</p>
        </div>
      ) : (
        <p className="font-mono text-xs text-ink-faint">The analytics service is offline, so no brief is available right now.</p>
      )}
    </section>
  );
}
