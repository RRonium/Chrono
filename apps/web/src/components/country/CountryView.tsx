"use client";

import React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Header } from "@/components/dashboard/Header";
import { MarketTicker } from "@/components/dashboard/MarketTicker";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { CountryPageData } from "@/lib/countries/types";
import { CountryMap } from "./CountryMap";
import { CountryPanel } from "./CountryPanel";
import { SplitPane } from "./SplitPane";

// Country page: same shell as the dashboard, with the map where the globe was and the data on the right.
export function CountryView({ data }: { data: CountryPageData }) {
  const { ticks, articles, connected } = useWebSocket();
  const { profile, boundary } = data;

  return (
    <div className="min-h-screen lg:h-screen bg-cyber-bg flex flex-col lg:overflow-hidden">
      <Header connected={connected} />
      <MarketTicker ticks={ticks} />
      <nav className="flex items-center gap-2 px-4 pt-3 font-mono text-[11px] text-ink-faint" aria-label="Breadcrumb">
        <Link href="/" className="flex items-center gap-1 text-ink-muted hover:text-gold">
          <ChevronLeft className="h-3.5 w-3.5" /> WORLD
        </Link>
        <span>/</span>
        <Link href="/country/" className="text-ink-muted hover:text-gold">COUNTRIES</Link>
        <span>/</span>
        <span className="text-gold-soft">{profile.name.toUpperCase()}</span>
      </nav>
      <div className="flex-1 min-h-0 flex p-4 pt-3">
        <SplitPane
          left={
            <div className="hud-panel rounded-lg absolute inset-0 overflow-hidden">
              <CountryMap boundary={boundary} center={profile.latlng} name={profile.name} />
            </div>
          }
          right={
            <div className="h-full overflow-y-auto scrollbar-thin pt-4 lg:pt-0 lg:pr-1">
              <CountryPanel data={data} ticks={ticks} articles={articles} />
            </div>
          }
        />
      </div>
    </div>
  );
}
