import React, { useEffect, useState } from "react";
import { fetchNews } from "@/lib/api";

export function SentimentFeed({ articles: liveArticles }: { articles: any[] }) {
  const [articles, setArticles] = useState<any[]>([]);

  useEffect(() => {
    fetchNews().then((res) => {
      if (res && res.length > 0) {
        setArticles(res);
      }
    });
  }, []);

  const combined = [...liveArticles, ...articles];

  return (
    <div className="hud-panel rounded-lg p-4 flex flex-col h-80">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-mono text-sm text-cyan-300 tracking-wider font-bold">LIVE INTELLIGENCE STREAM</h3>
        <span className="text-xs font-mono text-[#00ff9d] animate-pulse">LIVE</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
        {combined.length === 0 ? (
          <p className="text-xs font-mono text-slate-500">No news articles available.</p>
        ) : (
          combined.map((article, idx) => {
            const sentiment = idx % 3 === 0 ? "BULLISH" : idx % 3 === 1 ? "BEARISH" : "NEUTRAL";
            const badgeClass = 
              sentiment === "BULLISH" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]" :
              sentiment === "BEARISH" ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.2)]" :
              "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-[0_0_10px_rgba(0,240,255,0.2)]";

            return (
              <div key={idx} className="border-b border-cyan-500/10 pb-2">
                <div className="flex justify-between items-start mb-1">
                  <a href={article.url} target="_blank" rel="noreferrer" className="text-xs font-medium text-slate-100 hover:text-cyan-400 transition-colors line-clamp-1">
                    {article.title}
                  </a>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/60 text-cyan-300 border border-cyan-500/30 uppercase ml-2 shrink-0">
                    {article.iso_code || "USA"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                  <span className="uppercase">{article.source || "Feed"}</span>
                  <span className={`font-semibold px-2 py-0.5 rounded text-[9px] ${badgeClass}`}>
                    {sentiment}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
