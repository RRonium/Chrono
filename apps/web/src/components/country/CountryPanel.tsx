"use client";

import React from "react";
import Link from "next/link";
import { SentimentFeed } from "@/components/dashboard/SentimentFeed";
import { countryHref, formatChange, formatValue, latestPoint } from "@/lib/countries/format";
import type { CountryPageData, IndicatorDef, SeriesPoint } from "@/lib/countries/types";
import { LineChart, ShareBar, Sparkline } from "./Charts";
import { CountryBrief } from "./CountryBrief";
import { MarketSection } from "./MarketSection";

const HEADLINE = [
  "gdp",
  "gdp_growth",
  "gdp_per_capita",
  "inflation",
  "unemployment",
  "population",
  "gov_debt",
  "current_account",
  "exchange_rate",
  "reserves",
  "market_cap",
  "real_interest_rate",
];

const CHART_LABELS: Record<string, string> = {
  gdp_growth: "GDP growth",
  inflation: "Inflation",
  unemployment: "Unemployment",
  gdp_per_capita: "Nominal",
  gdp_per_capita_ppp: "PPP",
  exports: "Exports",
  imports: "Imports",
  current_account: "Current account",
};

const RANK_LABELS: Record<string, string> = { gdp: "GDP", gdp_per_capita: "GDP per capita", population: "Population" };

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="hud-panel rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm tracking-[0.15em] text-gold">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function StatTile({ def, series, label }: { def: IndicatorDef; series: SeriesPoint[]; label?: string }) {
  const latest = latestPoint(series)!;
  const change = formatChange(series, def.unit);
  return (
    <div className="rounded border border-white/10 bg-black/25 p-3 flex flex-col gap-1" title={`${def.label} · World Bank ${def.code}`}>
      <div className="font-mono text-[10px] tracking-wide text-ink-faint truncate">{(label ?? def.label).toUpperCase()}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-lg text-ink tabular-nums">{formatValue(latest[1], def.unit)}</span>
        <span className="font-mono text-[10px] text-ink-faint">{latest[0]}</span>
      </div>
      {change && (
        <div className="font-mono text-[10px] text-ink-muted tabular-nums">
          {change.direction > 0 ? "▲" : change.direction < 0 ? "▼" : "■"} {change.text} y/y
        </div>
      )}
      <Sparkline points={series} />
    </div>
  );
}

export function CountryPanel({ data, ticks, articles }: { data: CountryPageData; ticks: any[]; articles: any[] }) {
  const { profile, market, neighbours, meta } = data;
  const series = profile.indicators;
  const defs = meta.indicators;
  const has = (key: string) => (series[key]?.length ?? 0) > 0;
  const currency = profile.currencies[0];
  const tiles = HEADLINE.filter(has);
  const pick = (keys: string[]) => keys.filter(has).map((id) => ({ id, label: CHART_LABELS[id] ?? defs[id].label, points: series[id] }));

  const structureYear = Math.min(...["agriculture", "industry", "services"].map((k) => latestPoint(series[k])?.[0] ?? 0));
  const structure = ["agriculture", "industry", "services"]
    .map((k) => ({ label: defs[k].label, value: series[k]?.find(([year]) => year === structureYear)?.[1] }))
    .filter((p): p is { label: string; value: number } => typeof p.value === "number");

  const facts: [string, React.ReactNode][] = [
    ["Capital", profile.capital],
    ["Region", [profile.region, profile.subregion].filter(Boolean).join(" · ")],
    ["Income group", profile.incomeLevel],
    ["Currency", currency ? `${currency.name} (${currency.code}${currency.symbol ? ` ${currency.symbol}` : ""})` : null],
    ["Languages", profile.languages.slice(0, 4).join(", ")],
    ["Area", profile.areaKm2 ? `${profile.areaKm2.toLocaleString("en-US")} km²` : null],
  ];

  return (
    <div className="space-y-4 pb-6">
      <section className="hud-panel rounded-lg p-4">
        <div className="flex items-start gap-3">
          {profile.flag && <span className="text-4xl leading-none" aria-hidden>{profile.flag}</span>}
          <div className="min-w-0">
            <h2 className="font-display text-2xl tracking-wide text-ink">{profile.name}</h2>
            {profile.officialName && profile.officialName !== profile.name && (
              <p className="text-xs text-ink-muted">{profile.officialName}</p>
            )}
          </div>
          <span className="ml-auto font-mono text-[10px] text-ink-faint border border-white/10 rounded px-1.5 py-0.5">{profile.iso3}</span>
        </div>
        <dl className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-x-4 gap-y-2">
          {facts
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label}>
                <dt className="font-mono text-[10px] tracking-wide text-ink-faint">{label.toUpperCase()}</dt>
                <dd className="text-[13px] text-ink">{value}</dd>
              </div>
            ))}
        </dl>
        {profile.ranks && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(profile.ranks).map(([key, { rank, of }]) => (
              <span key={key} className="rounded border border-gold/30 bg-gold/5 px-2 py-0.5 font-mono text-[10px] text-gold-soft">
                #{rank} {RANK_LABELS[key] ?? key} <span className="text-ink-faint">of {of}</span>
              </span>
            ))}
          </div>
        )}
      </section>

      {market ? (
        <MarketSection iso={profile.iso3} market={market} ticks={ticks} />
      ) : (
        <Section title="MARKETS">
          <p className="text-[13px] leading-relaxed text-ink-muted">
            Chrono does not stream an exchange for {profile.name} yet. Live prices are tracked for the{" "}
            <Link href="/" className="text-gold-soft hover:underline">six hub markets</Link> on the globe.
            {has("market_cap") && (
              <> Listed companies here are worth {formatValue(latestPoint(series.market_cap)![1], "usd")} ({latestPoint(series.market_cap)![0]}).</>
            )}
          </p>
        </Section>
      )}

      {tiles.length > 0 ? (
        <Section title="KEY INDICATORS" aside={<span className="font-mono text-[10px] text-ink-faint">annual · World Bank</span>}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
            {tiles.map((key) => (
              <StatTile
                key={key}
                def={defs[key]}
                series={series[key]}
                label={key === "exchange_rate" && currency ? `${currency.code} per USD` : undefined}
              />
            ))}
          </div>
        </Section>
      ) : (
        <Section title="KEY INDICATORS">
          <p className="text-[13px] text-ink-muted">
            The World Bank does not publish economic indicators for {profile.name}. Figures for territories are usually
            reported under their sovereign state.
          </p>
        </Section>
      )}

      {(has("gdp_growth") || has("inflation") || has("gdp_per_capita") || has("exports")) && (
        <Section title="MACRO TRENDS" aside={<span className="font-mono text-[10px] text-ink-faint">since {Math.min(...Object.values(series).map((s) => s[0]?.[0] ?? 9999))}</span>}>
          <div className="space-y-5">
            <LineChart title="Growth, inflation and unemployment (%)" unit="pct" series={pick(["gdp_growth", "inflation", "unemployment"])} />
            <LineChart title="GDP per capita (US$, nominal vs PPP)" unit="usd" series={pick(["gdp_per_capita", "gdp_per_capita_ppp"])} />
            <LineChart title="Trade and current account (% of GDP)" unit="pct_gdp" series={pick(["exports", "imports", "current_account"])} />
          </div>
        </Section>
      )}

      {(structure.length === 3 || has("tax_revenue") || has("domestic_credit")) && (
        <Section title="ECONOMIC STRUCTURE">
          {structure.length === 3 && (
            <div className="mb-4">
              <div className="font-mono text-[10px] text-ink-faint mb-1.5">VALUE ADDED BY SECTOR, % OF GDP ({structureYear})</div>
              <ShareBar parts={structure} />
            </div>
          )}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
            {["tax_revenue", "domestic_credit", "fdi_inflows", "lending_rate", "market_cap_gdp"].filter(has).map((key) => (
              <StatTile key={key} def={defs[key]} series={series[key]} />
            ))}
          </div>
        </Section>
      )}

      <SentimentFeed articles={articles} iso={profile.iso3} title={`${profile.name.toUpperCase()} NEWSWIRE`} />

      <CountryBrief iso={profile.iso3} />

      {neighbours.length > 0 && (
        <Section title="NEIGHBOURS">
          <div className="flex flex-wrap gap-1.5">
            {neighbours.map((n) => (
              <Link
                key={n.iso3}
                href={countryHref(n.iso3)}
                className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-ink-muted hover:border-gold/50 hover:text-gold-soft"
              >
                {n.flag} {n.name}
              </Link>
            ))}
          </div>
        </Section>
      )}

      <p className="px-1 font-mono text-[10px] leading-relaxed text-ink-faint">
        Sources: {meta.sources.indicators}; {meta.sources.metadata}; {meta.sources.boundaries}.
        {profile.indicatorsUpdated && <> Indicators fetched {profile.indicatorsUpdated}.</>}
      </p>
    </div>
  );
}
