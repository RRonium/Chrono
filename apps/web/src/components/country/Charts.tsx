"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { IndicatorUnit, SeriesPoint } from "@/lib/countries/types";
import { formatValue } from "@/lib/countries/format";

// Categorical slots validated for CVD and contrast on the #0b1424 panel surface.
export const SERIES_COLORS = ["#3987e5", "#c98500", "#199e70"];

export type ChartSeries = { id: string; label: string; points: SeriesPoint[] };

const HEIGHT = 170;
const PAD = { top: 10, right: 12, bottom: 22, left: 44 };

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || Math.abs(max) || 1;
  const step0 = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= step0) ?? step0;
  const ticks: number[] = [];
  const last = Math.ceil(max / step) * step;
  for (let v = Math.floor(min / step) * step; v <= last + step * 0.001; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

// Multi-series line chart on one y-axis, with a year crosshair and tooltip on hover.
export function LineChart({ series, unit, title }: { series: ChartSeries[]; unit: IndicatorUnit; title: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hoverYear, setHoverYear] = useState<number | null>(null);
  const visible = useMemo(() => series.filter((s) => s.points.length > 1), [series]);

  const scale = useMemo(() => {
    const points = visible.flatMap((s) => s.points);
    if (!points.length || !width) return null;
    const years = points.map(([year]) => year);
    const values = points.map(([, value]) => value);
    const ticks = niceTicks(Math.min(0, ...values), Math.max(...values));
    const [x0, x1] = [Math.min(...years), Math.max(...years)];
    const [y0, y1] = [ticks[0], ticks[ticks.length - 1]];
    const plotW = width - PAD.left - PAD.right;
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    return {
      ticks,
      x0,
      x1,
      x: (year: number) => PAD.left + ((year - x0) / (x1 - x0 || 1)) * plotW,
      y: (value: number) => PAD.top + (1 - (value - y0) / (y1 - y0 || 1)) * plotH,
      yearAt: (px: number) => Math.round(x0 + ((px - PAD.left) / plotW) * (x1 - x0)),
    };
  }, [visible, width]);

  if (!visible.length) return null;

  const hovered = hoverYear === null ? [] : visible.map((s) => ({ s, point: s.points.find(([year]) => year === hoverYear) }));
  const yearStep = scale ? Math.max(1, Math.ceil((scale.x1 - scale.x0) / Math.max(2, Math.floor(width / 70)))) : 1;

  return (
    <figure className="m-0">
      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-1.5">
        <span className="font-mono text-[11px] text-ink-muted">{title}</span>
        {visible.length > 1 && (
          <span className="flex gap-3 font-mono text-[10px] text-ink-muted">
            {visible.map((s) => (
              <span key={s.id} className="flex items-center gap-1">
                <span className="inline-block h-0.5 w-3 rounded" style={{ background: SERIES_COLORS[series.indexOf(s)] }} />
                {s.label}
              </span>
            ))}
          </span>
        )}
      </figcaption>
      <div ref={ref} className="relative w-full" style={{ height: HEIGHT }}>
        {scale && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={title}
            onPointerMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const year = scale.yearAt(event.clientX - rect.left);
              setHoverYear(Math.min(scale.x1, Math.max(scale.x0, year)));
            }}
            onPointerLeave={() => setHoverYear(null)}
          >
            {scale.ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={scale.y(tick)}
                  y2={scale.y(tick)}
                  stroke={tick === 0 ? "rgba(230,237,247,0.35)" : "rgba(255,255,255,0.06)"}
                />
                <text x={PAD.left - 6} y={scale.y(tick)} dy="0.32em" textAnchor="end" className="fill-ink-faint font-mono text-[9px]">
                  {formatValue(tick, unit)}
                </text>
              </g>
            ))}
            {Array.from({ length: scale.x1 - scale.x0 + 1 }, (_, i) => scale.x0 + i)
              .filter((year) => (year - scale.x0) % yearStep === 0)
              .map((year) => (
                <text key={year} x={scale.x(year)} y={HEIGHT - 6} textAnchor="middle" className="fill-ink-faint font-mono text-[9px]">
                  {year}
                </text>
              ))}
            {visible.map((s) => (
              <polyline
                key={s.id}
                fill="none"
                stroke={SERIES_COLORS[series.indexOf(s)]}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                points={s.points.map(([year, value]) => `${scale.x(year)},${scale.y(value)}`).join(" ")}
              />
            ))}
            {hoverYear !== null && (
              <g pointerEvents="none">
                <line x1={scale.x(hoverYear)} x2={scale.x(hoverYear)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="rgba(232,200,130,0.5)" />
                {hovered.map(({ s, point }) =>
                  point ? (
                    <circle key={s.id} cx={scale.x(point[0])} cy={scale.y(point[1])} r={4} fill={SERIES_COLORS[series.indexOf(s)]} stroke="#0b1424" strokeWidth={2} />
                  ) : null,
                )}
              </g>
            )}
          </svg>
        )}
        {scale && hoverYear !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded border border-gold/40 bg-[#07101e]/95 px-2 py-1 font-mono text-[10px] text-ink shadow-lg"
            style={scale.x(hoverYear) > width / 2 ? { right: width - scale.x(hoverYear) + 8 } : { left: scale.x(hoverYear) + 8 }}
          >
            <div className="text-gold-soft">{hoverYear}</div>
            {hovered.map(({ s, point }) => (
              <div key={s.id} className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="inline-block h-0.5 w-2.5 rounded" style={{ background: SERIES_COLORS[series.indexOf(s)] }} />
                <span className="text-ink-muted">{s.label}</span>
                <span className="ml-auto tabular-nums">{point ? formatValue(point[1], unit) : "–"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}

export function Sparkline({ points }: { points: SeriesPoint[] }) {
  if (points.length < 2) return null;
  const recent = points.slice(-12);
  const values = recent.map(([, v]) => v);
  const [min, max] = [Math.min(...values), Math.max(...values)];
  const path = recent
    .map(([, v], i) => `${(i / (recent.length - 1)) * 100},${max === min ? 12 : 22 - ((v - min) / (max - min)) * 20}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="h-6 w-full" aria-hidden>
      <polyline points={path} fill="none" stroke="#d4a64a" strokeOpacity={0.7} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// One horizontal 100% bar split into segments with a 2px surface gap between them.
export function ShareBar({ parts }: { parts: { label: string; value: number }[] }) {
  const total = parts.reduce((sum, p) => sum + p.value, 0) || 1;
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded">
        {parts.map((p, i) => (
          <div
            key={p.label}
            title={`${p.label}: ${p.value.toFixed(1)}% of GDP`}
            style={{ width: `${(p.value / total) * 100}%`, background: SERIES_COLORS[i] }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-ink-muted">
        {parts.map((p, i) => (
          <span key={p.label} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: SERIES_COLORS[i] }} />
            {p.label} <span className="text-ink tabular-nums">{p.value.toFixed(1)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}
