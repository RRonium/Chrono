"use client";

import React, { useEffect, useRef, useState } from "react";
import { BarChart3, Download, Maximize2, Minimize2, RotateCcw, SendHorizontal, Sparkles, Table2, Trash2 } from "lucide-react";
import { fetchAgentStatus, sendChat, type Artifact, type ChatMessage } from "@/lib/agent";
import { formatValue } from "@/lib/countries/format";
import type { CountryProfile, CountryMarket } from "@/lib/countries/types";
import { BarChart, LineChart } from "./Charts";

const STORAGE_PREFIX = "chrono:agent:";
const MIN_PANE = 220;
const MAX_PANE = 1000;

type Saved = { messages: ChatMessage[]; artifacts: Artifact[] };

function loadConversation(iso: string): Saved {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + iso);
    if (raw) return JSON.parse(raw) as Saved;
  } catch {}
  return { messages: [], artifacts: [] };
}

function saveConversation(iso: string, saved: Saved) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + iso, JSON.stringify(saved));
  } catch {
    // Storage full: keep the conversation but drop drawn images, which are the large part.
    try {
      const slim = saved.artifacts.map((a) => (a.type === "image" ? { ...a, data: "" } : a));
      window.localStorage.setItem(STORAGE_PREFIX + iso, JSON.stringify({ ...saved, artifacts: slim }));
    } catch {}
  }
}

// A panel whose height the user drags from its bottom edge.
function ResizablePanel({ height, onHeight, children, label }: { height: number; onHeight: (h: number) => void; children: React.ReactNode; label: string }) {
  const start = useRef<{ y: number; h: number } | null>(null);
  return (
    <div className="hud-panel rounded-lg flex flex-col overflow-hidden" style={{ height }}>
      {children}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label={`Resize ${label}`}
        aria-valuenow={height}
        tabIndex={0}
        className="group h-2.5 shrink-0 cursor-row-resize touch-none flex items-center justify-center border-t border-white/5 outline-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          start.current = { y: e.clientY, h: height };
        }}
        onPointerMove={(e) => {
          if (start.current) onHeight(Math.min(MAX_PANE, Math.max(MIN_PANE, start.current.h + e.clientY - start.current.y)));
        }}
        onPointerUp={() => (start.current = null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") onHeight(Math.max(MIN_PANE, height - 24));
          if (e.key === "ArrowDown") onHeight(Math.min(MAX_PANE, height + 24));
        }}
      >
        <span className="h-0.5 w-10 rounded bg-gold/25 group-hover:bg-gold/70 group-focus-visible:bg-gold" />
      </div>
    </div>
  );
}

// Just enough Markdown for chat replies: headings, bullets, **bold**, and clickable "chart 2" / "table 1" references.
function RichText({ text, onReference }: { text: string; onReference: (id: number) => void }) {
  const inline = (line: string, key: string) =>
    line.split(/(\*\*[^*]+\*\*|\b(?:[Cc]hart|[Tt]able)s? \d+\b)/g).map((part, i) => {
      if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={`${key}-${i}`} className="text-ink font-semibold">{part.slice(2, -2)}</strong>;
      const ref = part.match(/^(?:[Cc]hart|[Tt]able)s? (\d+)$/);
      if (ref) {
        return (
          <button key={`${key}-${i}`} onClick={() => onReference(Number(ref[1]))} className="text-gold-soft underline decoration-gold/40 underline-offset-2 hover:text-gold">
            {part}
          </button>
        );
      }
      return <React.Fragment key={`${key}-${i}`}>{part}</React.Fragment>;
    });

  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      const items = bullets;
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="list-disc pl-4 space-y-1 marker:text-gold/60">
          {items.map((b, i) => <li key={i}>{inline(b, `li-${blocks.length}-${i}`)}</li>)}
        </ul>,
      );
      bullets = [];
    }
  };
  text.split("\n").forEach((raw, i) => {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/) || line.match(/^\d+\.\s+(.*)$/);
    if (bullet) return void bullets.push(bullet[1]);
    flush();
    if (!line) return;
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    blocks.push(
      heading ? (
        <p key={i} className="font-display text-[13px] tracking-wide text-gold-soft pt-1">{inline(heading[1], `h-${i}`)}</p>
      ) : (
        <p key={i}>{inline(line, `p-${i}`)}</p>
      ),
    );
  });
  flush();
  return <div className="space-y-2">{blocks}</div>;
}

function toCsv(artifact: Artifact): string {
  const esc = (v: unknown) => (v === null || v === undefined ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  let rows: unknown[][] = [];
  if (artifact.type === "table") rows = [artifact.columns.map((c) => c.label), ...artifact.rows];
  else if (artifact.type === "chart" && artifact.kind === "bar") rows = [["", ...artifact.series.map((s) => s.label)], ...artifact.categories.map((c, i) => [c, ...artifact.series.map((s) => s.values[i])])];
  else if (artifact.type === "chart") {
    const years = Array.from(new Set(artifact.series.flatMap((s) => s.points.map((p) => p[0])))).sort();
    rows = [["Year", ...artifact.series.map((s) => s.label)], ...years.map((y) => [y, ...artifact.series.map((s) => s.points.find((p) => p[0] === y)?.[1] ?? null)])];
  }
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}

function download(artifact: Artifact, country: string) {
  const name = `${country}-${artifact.id}-${artifact.title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80);
  const href = artifact.type === "image" ? `data:${artifact.mime};base64,${artifact.data}` : URL.createObjectURL(new Blob([toCsv(artifact)], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = href;
  a.download = `${name}.${artifact.type === "image" ? "png" : "csv"}`;
  a.click();
  if (artifact.type !== "image") URL.revokeObjectURL(href);
}

function ArtifactView({ artifact, height }: { artifact: Artifact; height: number }) {
  if (artifact.type === "image") {
    return artifact.data ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`data:${artifact.mime};base64,${artifact.data}`} alt={artifact.title} className="max-h-full max-w-full mx-auto rounded" />
    ) : (
      <p className="font-mono text-xs text-ink-faint">This image was too large to keep after reload. Ask again to redraw it.</p>
    );
  }
  if (artifact.type === "table") {
    return (
      <div className="overflow-auto scrollbar-thin rounded border border-white/10">
        <table className="w-full text-left font-mono text-[11px]">
          <thead className="sticky top-0 bg-[#0d182b]">
            <tr>
              {artifact.columns.map((c) => (
                <th key={c.label} className="px-2 py-1.5 font-normal text-ink-faint border-b border-white/10">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {artifact.rows.map((row, i) => (
              <tr key={i} className="odd:bg-white/[0.02]">
                {row.map((cell, j) => (
                  <td key={j} className={`px-2 py-1 ${j ? "text-right tabular-nums text-ink" : "text-ink-muted"}`}>
                    {cell === null ? "–" : typeof cell === "number" && artifact.columns[j]?.unit ? formatValue(cell, artifact.columns[j].unit!) : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (artifact.kind === "bar") {
    return <BarChart title={artifact.title} unit={artifact.unit} categories={artifact.categories} series={artifact.series} height={height} />;
  }
  return <LineChart title={artifact.title} unit={artifact.unit} series={artifact.series.map((s) => ({ id: s.label, ...s }))} height={height} />;
}

export function CountryAgent({ profile, market }: { profile: CountryProfile; market: CountryMarket | null }) {
  const iso = profile.iso3;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState<"checking" | "ready" | "no-key" | "offline">("checking");
  const [chatHeight, setChatHeight] = useState(440);
  const [chartsHeight, setChartsHeight] = useState(380);
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);

  useEffect(() => {
    const saved = loadConversation(iso);
    setMessages(saved.messages);
    setArtifacts(saved.artifacts);
    setSelected(saved.artifacts.at(-1)?.id ?? null);
    loaded.current = true;
    fetchAgentStatus().then((s) => setStatus(!s ? "offline" : s.configured ? "ready" : "no-key"));
  }, [iso]);

  useEffect(() => {
    if (loaded.current) saveConversation(iso, { messages, artifacts });
  }, [iso, messages, artifacts]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    if (!busy) return;
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [busy]);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;
    const history = messages;
    setMessages([...history, { role: "user", text }]);
    setInput("");
    setBusy(true);
    try {
      const offset = artifacts.reduce((max, a) => Math.max(max, a.id), 0);
      const reply = await sendChat(iso, history, text, offset);
      setArtifacts((current) => [...current, ...reply.artifacts]);
      if (reply.artifacts.length) setSelected(reply.artifacts[reply.artifacts.length - 1].id);
      setMessages((current) => [...current, { role: "model", text: reply.reply, artifactIds: reply.artifacts.map((a) => a.id), steps: reply.steps }]);
      setStatus("ready");
    } catch (err) {
      setMessages((current) => [...current, { role: "model", text: err instanceof Error ? err.message : String(err), error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setMessages([]);
    setArtifacts([]);
    setSelected(null);
  };

  const index = market?.indices[0]?.name;
  const suggestions = [
    `How is ${profile.name}'s economy doing right now?`,
    "Chart inflation against GDP growth since 2010",
    profile.borders.length ? `Compare ${profile.name} with its neighbours on GDP per capita` : `Compare ${profile.name} with its region on GDP per capita`,
    index ? `What drives the ${index}?` : "What are the biggest economic risks?",
  ];
  const current = artifacts.find((a) => a.id === selected) ?? artifacts.at(-1) ?? null;
  const offlineNote =
    status === "offline"
      ? "The chat needs the Chrono backend, which isn't reachable. Start it and reload."
      : status === "no-key"
        ? "The backend has no GEMINI_API_KEY. Add it to .env and restart the backend."
        : null;

  return (
    <section className="space-y-4" aria-label={`Ask Chrono about ${profile.name}`}>
      <ResizablePanel label="chat" height={expanded ? Math.max(chatHeight, 720) : chatHeight} onHeight={(h) => { setExpanded(false); setChatHeight(h); }}>
        <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-white/5">
          <Sparkles className="h-4 w-4 text-gold" />
          <h3 className="font-display text-sm tracking-[0.15em] text-gold">ASK CHRONO · {profile.name.toUpperCase()}</h3>
          <span className="ml-auto font-mono text-[10px] text-ink-faint">Gemini</span>
          <button onClick={() => setExpanded((e) => !e)} className="p-1 text-ink-faint hover:text-gold" title={expanded ? "Shrink" : "Expand"} aria-label={expanded ? "Shrink chat" : "Expand chat"}>
            {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          <button onClick={reset} disabled={busy || !messages.length} className="p-1 text-ink-faint hover:text-gold disabled:opacity-30" title="New conversation" aria-label="New conversation">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-4 py-3 space-y-3 text-[13px] leading-relaxed text-ink-muted">
          {messages.length === 0 && (
            <div className="space-y-3">
              <p>
                Ask anything about {profile.name}&apos;s economy, markets or news. Answers use Chrono&apos;s data, and charts and
                tables appear in the pane below.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    disabled={busy || status !== "ready"}
                    className="rounded border border-gold/30 bg-gold/5 px-2 py-1 text-left font-mono text-[10px] text-gold-soft hover:border-gold/70 disabled:opacity-40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-lg rounded-br-sm border border-gold/25 bg-gold/10 px-3 py-2 text-ink">{m.text}</div>
              </div>
            ) : (
              <div key={i} className="flex gap-2">
                <Sparkles className={`mt-1 h-3.5 w-3.5 shrink-0 ${m.error ? "text-cyber-red" : "text-gold"}`} />
                <div className="min-w-0 flex-1 space-y-2">
                  {m.steps && m.steps.length > 0 && (
                    <details className="font-mono text-[10px] text-ink-faint">
                      <summary className="cursor-pointer select-none hover:text-ink-muted">{m.steps.length} step{m.steps.length > 1 ? "s" : ""}</summary>
                      <ul className="mt-1 space-y-0.5 pl-3">{m.steps.map((s, j) => <li key={j}>· {s}</li>)}</ul>
                    </details>
                  )}
                  <div className={m.error ? "text-cyber-red/90 font-mono text-xs" : ""}>
                    <RichText text={m.text} onReference={setSelected} />
                  </div>
                  {m.artifactIds && m.artifactIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {m.artifactIds.map((id) => {
                        const a = artifacts.find((x) => x.id === id);
                        if (!a) return null;
                        return (
                          <button key={id} onClick={() => setSelected(id)} className="flex items-center gap-1 rounded border border-white/10 bg-black/30 px-2 py-0.5 font-mono text-[10px] text-ink-muted hover:border-gold/50 hover:text-gold-soft">
                            {a.type === "table" ? <Table2 className="h-3 w-3" /> : <BarChart3 className="h-3 w-3" />}
                            {a.type === "table" ? "Table" : "Chart"} {id} ↓
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ),
          )}
          {busy && (
            <div className="flex items-center gap-2 font-mono text-[11px] text-ink-faint">
              <Sparkles className="h-3.5 w-3.5 text-gold animate-pulse" />
              Analysing {profile.name}: fetching data and drawing charts… {elapsed}s
            </div>
          )}
        </div>

        <form
          className="flex items-center gap-2 border-t border-white/5 px-3 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          {offlineNote ? (
            <p className="flex-1 font-mono text-[11px] text-amber-400">{offlineNote}</p>
          ) : (
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask about ${profile.name}'s economy…`}
              maxLength={4000}
              disabled={status === "checking"}
              className="flex-1 bg-black/30 rounded border border-white/10 px-3 py-1.5 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-gold/50"
              aria-label="Message"
            />
          )}
          <button type="submit" disabled={busy || !input.trim() || status !== "ready"} className="rounded border border-gold/40 bg-gold/10 p-1.5 text-gold hover:bg-gold/20 disabled:opacity-30" aria-label="Send">
            <SendHorizontal className="h-4 w-4" />
          </button>
        </form>
      </ResizablePanel>

      <ResizablePanel label="charts and tables" height={chartsHeight} onHeight={setChartsHeight}>
        <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-white/5">
          <BarChart3 className="h-4 w-4 text-gold" />
          <h3 className="font-display text-sm tracking-[0.15em] text-gold">CHARTS &amp; TABLES</h3>
          <span className="font-mono text-[10px] text-ink-faint">({artifacts.length})</span>
          {current && (
            <>
              <button onClick={() => download(current, iso)} className="ml-auto p-1 text-ink-faint hover:text-gold" title={current.type === "image" ? "Download PNG" : "Download CSV"} aria-label="Download">
                <Download className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => {
                  setArtifacts((list) => list.filter((a) => a.id !== current.id));
                  setSelected(null);
                }}
                className="p-1 text-ink-faint hover:text-gold"
                title="Remove"
                aria-label="Remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
        {artifacts.length > 0 && (
          <div className="flex gap-1 overflow-x-auto scrollbar-none px-4 pt-2 font-mono text-[10px]" role="tablist">
            {artifacts.map((a) => (
              <button
                key={a.id}
                role="tab"
                aria-selected={current?.id === a.id}
                onClick={() => setSelected(a.id)}
                title={a.title}
                className={`shrink-0 px-2 py-0.5 rounded border ${current?.id === a.id ? "border-gold text-gold bg-gold/10" : "border-white/10 text-ink-faint hover:text-ink"}`}
              >
                {a.type === "table" ? "Table" : "Chart"} {a.id}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-auto scrollbar-thin px-4 py-3 flex flex-col">
          {current ? (
            <>
              <div className="flex-1 min-h-0">
                <ArtifactView artifact={current} height={Math.max(150, chartsHeight - 170)} />
              </div>
              <p className="mt-2 font-mono text-[10px] text-ink-faint">
                {"note" in current && current.note ? `${current.note} · ` : ""}
                {current.source}
              </p>
            </>
          ) : (
            <p className="m-auto font-mono text-[11px] text-ink-faint text-center">Charts and tables from the conversation appear here.</p>
          )}
        </div>
      </ResizablePanel>
    </section>
  );
}
