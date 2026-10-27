import React from "react";

const MAX_HEADLINES = 20;

// Same thresholds as the classifier and the globe markers: green <= 0.4, amber <= 0.7, red above.
function urgencyTone(urgency: number | null): { dot: string; text: string } {
  if (urgency === null) return { dot: "bg-gold", text: "text-ink-muted" };
  if (urgency > 0.7) return { dot: "bg-cyber-red", text: "text-cyber-red" };
  if (urgency > 0.4) return { dot: "bg-amber-500", text: "text-amber-400" };
  return { dot: "bg-cyber-green", text: "text-ink-muted" };
}

function HeadlineItem({ article }: { article: any }) {
  const urgency = typeof article.urgency === "number" ? article.urgency : null;
  const { dot, text } = urgencyTone(urgency);
  return (
    <div className="flex items-center gap-2 whitespace-nowrap px-6 border-r border-white/5">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      <span className="text-[10px] text-ink-faint">{article.iso_code || "USA"}</span>
      <span className={text}>{article.title}</span>
      {urgency !== null && <span className="tabular-nums text-[10px] text-ink-faint">{(urgency * 100).toFixed(0)}</span>}
    </div>
  );
}

// Scrolling strip of the newest headlines, each coloured by its urgency score.
export function HeadlineTicker({ articles }: { articles: any[] }) {
  const items = React.useMemo(
    () => (Array.isArray(articles) ? articles : []).filter((a) => a?.title).slice(0, MAX_HEADLINES),
    [articles],
  );
  if (items.length === 0) return null;

  return (
    <div className="h-8 bg-[#060d18] border-b border-cyber-border flex items-center font-mono text-[11px]">
      <span className="shrink-0 h-full flex items-center px-4 bg-gold/5 border-r border-cyber-border text-gold-dim font-bold tracking-[0.2em] text-[10px]">
        NEWS
      </span>
      <div className="ticker-wrap relative flex-1 overflow-hidden">
        <div className="ticker-track" style={{ animationDuration: `${Math.max(60, items.length * 12)}s` }}>
          {[...items, ...items].map((article, idx) => (
            <HeadlineItem key={`${article.url || article.title}-${idx}`} article={article} />
          ))}
        </div>
      </div>
    </div>
  );
}
