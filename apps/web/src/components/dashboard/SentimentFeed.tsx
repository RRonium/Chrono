import React, { useEffect, useState } from "react";
import { fetchNews } from "@/lib/api";

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

const SOURCE_NAMES: Record<string, string> = {
  moneycontrol: "Moneycontrol",
  economic_times: "Economic Times",
  ndtv_profit: "NDTV Profit",
  livemint: "Mint",
  business_standard: "Business Standard",
  hindu_businessline: "BusinessLine",
  cnbc: "CNBC",
  yahoo_finance: "Yahoo Finance",
  reuters: "Reuters",
  reuters_rss: "Reuters",
  bbc_business: "BBC Business",
  nikkei_asia: "Nikkei Asia",
  scmp_business: "SCMP",
  bloomberg: "Bloomberg",
  financial_times: "Financial Times",
  handelsblatt: "Handelsblatt",
};

function sourceName(source: string | undefined): string {
  if (!source) return "Feed";
  return SOURCE_NAMES[source.toLowerCase()] ?? source.replace(/_/g, " ");
}

const REGIONS = ["ALL", "IND", "USA", "GBR", "DEU", "JPN", "CHN"];

function urgencyColor(urgency: number): string {
  if (urgency > 0.7) return "bg-cyber-red";
  if (urgency > 0.4) return "bg-amber-500";
  return "bg-cyber-green";
}

// With `iso`, the feed shows one country's stories (live, plus stored ones fetched for it) and no region tabs.
export function SentimentFeed({ articles: liveArticles, iso, title = "GLOBAL NEWSWIRE" }: { articles?: any[]; iso?: string; title?: string }) {
  const [region, setRegion] = useState(iso ?? "ALL");
  const [stored, setStored] = useState<any[]>([]);
  useEffect(() => {
    if (!iso) return;
    fetchNews(iso).then((rows) => setStored(Array.isArray(rows) ? rows : []));
  }, [iso]);

  const inRegion = (a: any) => region === "ALL" || (a.iso_code || "USA") === region;
  const seen = new Set<string>();
  const live = [...(Array.isArray(liveArticles) ? liveArticles : []), ...stored].filter((a: any) => {
    const key = a.url || a.title;
    if (!key || seen.has(key) || (iso && !inRegion(a))) return false;
    seen.add(key);
    return true;
  });
  const isSample = live.length === 0;
  const all = isSample ? DEMO_FALLBACK_ARTICLES : live;
  const shown = all.filter(inRegion);

  return (
    <div className={`hud-panel rounded-lg p-4 flex flex-col ${iso ? "max-h-[26rem]" : "h-[26rem]"}`}>
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-display text-sm tracking-[0.15em] text-gold">{title}</h3>
        {isSample && shown.length === 0 ? null : isSample ? (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-amber-500/40 text-amber-400">SAMPLE DATA</span>
        ) : (
          <span className="text-[10px] font-mono text-cyber-green">● {live.length} LIVE</span>
        )}
      </div>
      <div className={`flex gap-1 mb-3 font-mono text-[10px] ${iso ? "hidden" : ""}`}>
        {REGIONS.map((r) => (
          <button
            key={r}
            onClick={() => setRegion(r)}
            className={`px-2 py-0.5 rounded border ${region === r ? "border-gold text-gold bg-gold/10" : "border-white/10 text-ink-faint hover:text-ink"}`}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
        {shown.length === 0 && (
          <p className="text-xs font-mono text-ink-faint">
            {iso
              ? `No stories tagged ${iso} yet. The scrapers currently tag ${REGIONS.slice(1).join(", ")}.`
              : "No stories for this region yet."}
          </p>
        )}
        {shown.map((article: any, idx: number) => {
          const sentiment: string | undefined = article.sentiment?.label;
          const urgency = typeof article.urgency === "number" ? article.urgency : null;
          const badgeClass =
            sentiment === "BULLISH"
              ? "text-emerald-400 border-emerald-500/40"
              : sentiment === "BEARISH"
                ? "text-rose-400 border-rose-500/40"
                : "text-ink-muted border-white/15";
          const published = article.published_at ? new Date(article.published_at) : null;
          const timeStr = published && !isNaN(published.getTime())
            ? published.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
            : "";
          const articleUrl = resolveArticleUrl(article);

          return (
            <div key={article.url && article.url !== "#" ? article.url : `story-${idx}`} className="border-b border-white/5 pb-2.5">
              <div className="flex justify-between items-start gap-2 mb-1">
                <a href={articleUrl ?? undefined} target="_blank" rel="noopener noreferrer" className="text-[13px] leading-snug text-ink hover:text-gold-soft transition-colors line-clamp-2">
                  {article.title}
                </a>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-ink-muted border border-white/10 shrink-0">
                  {article.iso_code || "USA"}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono text-ink-faint">
                <div className="flex items-center space-x-2">
                  <span className="text-gold-dim">{sourceName(article.source)}</span>
                  <span suppressHydrationWarning>{timeStr}</span>
                </div>
                <div className="flex items-center space-x-2">
                  {urgency !== null && (
                    <span className="flex items-center gap-1" title={`Urgency ${(urgency * 100).toFixed(0)}%`}>
                      <span className="w-10 h-1 rounded bg-white/10 overflow-hidden">
                        <span className={`block h-full ${urgencyColor(urgency)}`} style={{ width: `${urgency * 100}%` }} />
                      </span>
                      {(urgency * 100).toFixed(0)}
                    </span>
                  )}
                  {sentiment && <span className={`px-1.5 py-0.5 rounded border text-[9px] ${badgeClass}`}>{sentiment}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
