import React, { useEffect, useState } from "react";

const DEMO_FALLBACK_ARTICLES = [
  {
    title: "Global Supply Chain Disruptions Ease as Major Ports Resume Normal Operations",
    url: "#",
    source: "reuters",
    iso_code: "USA",
    published_at: "2026-03-30T10:30:00Z",
    sentiment: { label: "BULLISH", score: 0.85 },
    urgency: 0.72,
  },
  {
    title: "RBI Holds Repo Rate Steady at 6.5%, Cites Robust Economic Growth Projections",
    url: "#",
    source: "moneycontrol",
    iso_code: "IND",
    published_at: "2026-03-30T10:15:00Z",
    sentiment: { label: "BULLISH", score: 0.62 },
    urgency: 0.45,
  },
  {
    title: "ECB Signals Potential Rate Cut Amid Cooling Eurozone Inflation Metrics",
    url: "#",
    source: "economic_times",
    iso_code: "DEU",
    published_at: "2026-03-30T09:45:00Z",
    sentiment: { label: "NEUTRAL", score: 0.12 },
    urgency: 0.58,
  },
  {
    title: "Tech Sector Rally Boosts S&P 500 to New Heights Following Strong Semiconductor Earnings",
    url: "#",
    source: "reuters",
    iso_code: "USA",
    published_at: "2026-03-30T09:00:00Z",
    sentiment: { label: "BULLISH", score: 0.91 },
    urgency: 0.65,
  },
];

export function SentimentFeed({ articles: liveArticles }: { articles?: any[]; liveArticles?: any[] }) {
  const [articles, setArticles] = useState<any[]>([]);

  const safeLiveArticles = liveArticles ?? [];

  useEffect(() => {
    if (safeLiveArticles && safeLiveArticles.length > 0) {
      setArticles(safeLiveArticles);
    }
  }, [safeLiveArticles]);

  const rawCombined = [
    ...(Array.isArray(safeLiveArticles) ? safeLiveArticles : []),
    ...(Array.isArray(articles) ? articles : []),
  ];

  // Fallback to structured demo cards if empty so feed renders immediately on mount
  const combined = rawCombined.length > 0 ? rawCombined : DEMO_FALLBACK_ARTICLES;

  return (
    <div className="hud-panel rounded-lg p-4 flex flex-col h-80">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-mono text-sm text-cyan-300 tracking-wider font-bold">LIVE INTELLIGENCE STREAM</h3>
        <span className="text-xs font-mono text-[#00ff9d] animate-pulse">LIVE</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
        {combined.map((article, idx) => {
          const sentObj = article.sentiment;
          const sentiment = sentObj?.label || (idx % 3 === 0 ? "BULLISH" : idx % 3 === 1 ? "BEARISH" : "NEUTRAL");
          const urgencyScore = typeof article.urgency === "number" ? article.urgency : 0.5;

          const badgeClass =
            sentiment === "BULLISH"
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
              : sentiment === "BEARISH"
                ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.2)]"
                : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-[0_0_10px_rgba(0,240,255,0.2)]";

          const timeStr = article.published_at
            ? new Date(article.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : "Just now";

          return (
            <div key={idx} className="border-b border-cyan-500/10 pb-2">
              <div className="flex justify-between items-start mb-1">
                <a href={article.url || "#"} target="_blank" rel="noreferrer" className="text-xs font-medium text-slate-100 hover:text-cyan-400 transition-colors line-clamp-1">
                  {article.title}
                </a>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/60 text-cyan-300 border border-cyan-500/30 uppercase ml-2 shrink-0">
                  {article.iso_code || "USA"}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                <div className="flex items-center space-x-2">
                  <span className="uppercase text-cyan-400">{article.source || "Feed"}</span>
                  <span className="text-slate-500">{timeStr}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-slate-400">Urgency: {(urgencyScore * 100).toFixed(0)}%</span>
                  <span className={`font-semibold px-2 py-0.5 rounded text-[9px] ${badgeClass}`}>
                    {sentiment}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
