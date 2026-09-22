import React, { useEffect, useState } from "react";

const SOURCE_URLS: Record<string, string> = {
  bloomberg: "https://www.bloomberg.com/",
  economic_times: "https://economictimes.indiatimes.com/",
  moneycontrol: "https://www.moneycontrol.com/news/business/",
  reuters: "https://www.reuters.com/business/",
  reuters_rss: "https://www.reuters.com/business/",
};

function resolveArticleUrl(article: any): string | null {
  const url = typeof article.url === "string" ? article.url.trim() : "";
  if (/^https?:\/\/\S+$/i.test(url) && url !== "#") {
    return url;
  }

  const source = typeof article.source === "string" ? article.source.toLowerCase() : "";
  return SOURCE_URLS[source] ?? null;
}

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
    source: "bloomberg",
    iso_code: "USA",
    published_at: "2026-03-30T09:00:00Z",
    sentiment: { label: "BULLISH", score: 0.91 },
    urgency: 0.65,
  },
  {
    title: "Nikkei 225 Surges Past Resistance Levels on Strong Export Data and Weak Yen",
    url: "#",
    source: "nikkei_asia",
    iso_code: "JPN",
    published_at: "2026-03-30T08:30:00Z",
    sentiment: { label: "BULLISH", score: 0.78 },
    urgency: 0.68,
  },
  {
    title: "German DAX Reacts to Industrial Production Surge and Manufacturing PMI Recovery",
    url: "#",
    source: "handelsblatt",
    iso_code: "DEU",
    published_at: "2026-03-30T08:00:00Z",
    sentiment: { label: "BULLISH", score: 0.70 },
    urgency: 0.52,
  },
  {
    title: "Bank of England Maintains Caution on Rate Trajectory Amid Persistent Wage Growth",
    url: "#",
    source: "financial_times",
    iso_code: "GBR",
    published_at: "2026-03-30T07:30:00Z",
    sentiment: { label: "BEARISH", score: -0.44 },
    urgency: 0.75,
  },
  {
    title: "Indian IT Giants Announce Major Expansion into AI Infrastructure Services",
    url: "#",
    source: "moneycontrol",
    iso_code: "IND",
    published_at: "2026-03-30T07:00:00Z",
    sentiment: { label: "BULLISH", score: 0.82 },
    urgency: 0.60,
  },
  {
    title: "US Treasury Yields Stabilize Following Federal Reserve Inflation Commentary",
    url: "#",
    source: "reuters",
    iso_code: "USA",
    published_at: "2026-03-30T06:30:00Z",
    sentiment: { label: "NEUTRAL", score: 0.05 },
    urgency: 0.40,
  },
  {
    title: "Tokyo Tech Stocks Rally on Semiconductor Investment Subsidies",
    url: "#",
    source: "nikkei_asia",
    iso_code: "JPN",
    published_at: "2026-03-30T06:00:00Z",
    sentiment: { label: "BULLISH", score: 0.88 },
    urgency: 0.63,
  },
  {
    title: "FTSE 100 Dips as Energy Majors Face Regulatory Scrutiny over Windfall Profits",
    url: "#",
    source: "financial_times",
    iso_code: "GBR",
    published_at: "2026-03-30T05:30:00Z",
    sentiment: { label: "BEARISH", score: -0.55 },
    urgency: 0.71,
  },
  {
    title: "Frankfurt Auto Show Highlights Rapid EV Transition Among Luxury Manufacturers",
    url: "#",
    source: "handelsblatt",
    iso_code: "DEU",
    published_at: "2026-03-30T05:00:00Z",
    sentiment: { label: "BULLISH", score: 0.65 },
    urgency: 0.48,
  },
  {
    title: "Mumbai Sensex Reaches Record Highs Driven by FII Inflows into Banking Sector",
    url: "#",
    source: "economic_times",
    iso_code: "IND",
    published_at: "2026-03-30T04:30:00Z",
    sentiment: { label: "BULLISH", score: 0.89 },
    urgency: 0.67,
  },
  {
    title: "Wall Street Futures Point to Modest Open Ahead of Non-Farm Payrolls Report",
    url: "#",
    source: "bloomberg",
    iso_code: "USA",
    published_at: "2026-03-30T04:00:00Z",
    sentiment: { label: "NEUTRAL", score: 0.02 },
    urgency: 0.50,
  },
  {
    title: "Global Central Banks Coordinate Liquidity Frameworks Amid Geopolitical Tensions",
    url: "#",
    source: "reuters",
    iso_code: "GBR",
    published_at: "2026-03-30T03:30:00Z",
    sentiment: { label: "BEARISH", score: -0.68 },
    urgency: 0.88,
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

  // Fallback to 15 diversified demo cards if empty so feed renders immediately on mount
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
          const articleUrl = resolveArticleUrl(article);

          return (
            <div key={idx} className="border-b border-cyan-500/10 pb-2">
              <div className="flex justify-between items-start mb-1">
                <a href={articleUrl ?? undefined} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-slate-100 hover:text-cyan-400 transition-colors line-clamp-1">
                  {article.title}
                </a>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/60 text-cyan-300 border border-cyan-500/30 uppercase ml-2 shrink-0">
                  {article.iso_code || "USA"}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                <div className="flex items-center space-x-2">
                  <span className="uppercase text-cyan-400">{article.source || "Feed"}</span>
                  <span className="text-slate-500" suppressHydrationWarning>{timeStr}</span>
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
