import type { IndicatorUnit, SeriesPoint } from "./types";

export function countryHref(iso3: string): string {
  return `/country/${iso3.toLowerCase()}/`;
}

export function latestPoint(series: SeriesPoint[] | undefined): SeriesPoint | null {
  return series && series.length ? series[series.length - 1] : null;
}

export function compactNumber(value: number, digits = 2): string {
  const abs = Math.abs(value);
  const units: [number, string][] = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
  for (const [size, suffix] of units) {
    if (abs >= size) return `${(value / size).toFixed(digits)}${suffix}`;
  }
  return value.toFixed(abs < 10 ? 2 : 0);
}

export function formatValue(value: number, unit: IndicatorUnit): string {
  switch (unit) {
    case "usd":
      return `$${compactNumber(value)}`;
    case "pct":
    case "pct_gdp":
      return `${value.toFixed(1)}%`;
    case "people":
      return compactNumber(value);
    case "lcu_per_usd":
      return value >= 100 ? value.toFixed(0) : value.toFixed(value >= 10 ? 1 : 3);
    default:
      return compactNumber(value);
  }
}

// Change from the previous data point: percentage points for rates, percent for levels.
export function formatChange(series: SeriesPoint[] | undefined, unit: IndicatorUnit): { text: string; direction: -1 | 0 | 1 } | null {
  if (!series || series.length < 2) return null;
  const [, last] = series[series.length - 1];
  const [, prev] = series[series.length - 2];
  const isRate = unit === "pct" || unit === "pct_gdp";
  const delta = isRate ? last - prev : prev !== 0 ? ((last - prev) / Math.abs(prev)) * 100 : 0;
  const direction = Math.abs(delta) < 0.05 ? 0 : delta > 0 ? 1 : -1;
  const sign = delta > 0 ? "+" : "";
  return { text: `${sign}${delta.toFixed(1)}${isRate ? " pp" : "%"}`, direction };
}
