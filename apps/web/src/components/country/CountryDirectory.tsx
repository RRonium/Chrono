"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Header } from "@/components/dashboard/Header";
import { MarketTicker } from "@/components/dashboard/MarketTicker";
import { useWebSocket } from "@/hooks/useWebSocket";
import { compactNumber, countryHref } from "@/lib/countries/format";
import type { CountryIndexEntry } from "@/lib/countries/types";

// Every country page, grouped by region, with a name / ISO filter.
export function CountryDirectory({ countries }: { countries: CountryIndexEntry[] }) {
  const { ticks, connected } = useWebSocket();
  const [query, setQuery] = useState("");

  const regions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const groups = new Map<string, CountryIndexEntry[]>();
    for (const country of countries) {
      if (q && !country.name.toLowerCase().includes(q) && !country.iso3.toLowerCase().startsWith(q)) continue;
      const region = country.region || "Other";
      groups.set(region, [...(groups.get(region) ?? []), country]);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [countries, query]);

  return (
    <div className="min-h-screen bg-cyber-bg flex flex-col">
      <Header connected={connected} />
      <MarketTicker ticks={ticks} />
      <main className="p-4 space-y-4">
        <div className="hud-panel rounded-lg p-4 flex flex-wrap items-center gap-3">
          <h2 className="font-display text-sm tracking-[0.15em] text-gold">COUNTRIES</h2>
          <span className="font-mono text-[10px] text-ink-faint">{countries.length} pages · ★ tracked exchange</span>
          <label className="ml-auto flex items-center gap-2 rounded border border-white/10 bg-black/30 px-2 py-1">
            <Search className="h-3.5 w-3.5 text-ink-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or ISO code"
              className="w-56 bg-transparent font-mono text-xs text-ink outline-none placeholder:text-ink-faint"
              aria-label="Search countries"
            />
          </label>
        </div>
        {regions.map(([region, list]) => (
          <section key={region} className="hud-panel rounded-lg p-4">
            <h3 className="font-display text-xs tracking-[0.2em] text-gold/80 mb-3">{region.toUpperCase()}</h3>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-1.5">
              {list.map((c) => (
                <Link
                  key={c.iso3}
                  href={countryHref(c.iso3)}
                  className="flex items-center gap-2 rounded border border-white/5 bg-black/20 px-2 py-1.5 text-[13px] text-ink-muted hover:border-gold/50 hover:text-gold-soft"
                >
                  <span aria-hidden>{c.flag}</span>
                  <span className="truncate">{c.name}</span>
                  {c.hasMarket && <span className="text-gold" title="Tracked exchange">★</span>}
                  {c.gdp !== null && <span className="ml-auto font-mono text-[10px] text-ink-faint">${compactNumber(c.gdp, 1)}</span>}
                </Link>
              ))}
            </div>
          </section>
        ))}
        {regions.length === 0 && <p className="font-mono text-xs text-ink-faint px-1">No country matches “{query}”.</p>}
      </main>
    </div>
  );
}
