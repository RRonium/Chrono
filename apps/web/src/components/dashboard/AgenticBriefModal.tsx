import React, { useEffect, useState } from "react";
import { fetchAgentBrief } from "@/lib/api";
import { X, Sparkles } from "lucide-react";

export function AgenticBriefModal({ isoCode, onClose }: { isoCode: string | null; onClose: () => void }) {
  const [brief, setBrief] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isoCode) {
      setLoading(true);
      fetchAgentBrief(isoCode).then((res) => {
        setBrief(res);
        setLoading(false);
      });
    }
  }, [isoCode]);

  if (!isoCode) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-cyber-card border border-cyber-accent rounded-lg max-w-lg w-full p-6 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center space-x-2 mb-4">
          <Sparkles className="w-5 h-5 text-cyber-accent animate-spin" />
          <h2 className="text-lg font-bold font-mono text-white">EXECUTIVE AGENT BRIEF ({isoCode})</h2>
        </div>
        {loading ? (
          <p className="font-mono text-xs text-slate-400">Synthesizing macro & market data...</p>
        ) : brief ? (
          <div className="space-y-4 font-mono text-xs">
            <div className="bg-cyber-bg p-3 rounded border border-cyber-border">
              <span className="text-slate-400 block mb-1">MARKET TREND</span>
              <span className={`text-sm font-bold ${brief.trend === "BULLISH" ? "text-cyber-green" : "text-cyber-red"}`}>
                {brief.trend}
              </span>
            </div>
            <div className="bg-cyber-bg p-3 rounded border border-cyber-border">
              <span className="text-slate-400 block mb-1">SENTIMENT SCORE</span>
              <span className="text-white text-sm">{brief.sentiment_score}</span>
            </div>
            <div className="bg-cyber-bg p-3 rounded border border-cyber-border">
              <span className="text-slate-400 block mb-1">EXECUTIVE SUMMARY</span>
              <p className="text-slate-200 text-sm leading-relaxed">{brief.summary}</p>
            </div>
          </div>
        ) : (
          <p className="font-mono text-xs text-red-400">Failed to load agent brief.</p>
        )}
      </div>
    </div>
  );
}
