// Shapes of the files in data/countries/ (written by scripts/refresh_country_data.py,
// except market.json, which is hand-written for countries with a tracked exchange).

export type SeriesPoint = [year: number, value: number];

export type IndicatorUnit = "usd" | "pct" | "pct_gdp" | "people" | "lcu_per_usd" | "index";

export type IndicatorDef = { code: string; label: string; unit: IndicatorUnit; group: string };

export type CountryProfile = {
  iso3: string;
  iso2: string | null;
  name: string;
  officialName: string | null;
  flag: string | null;
  capital: string | null;
  region: string | null;
  subregion: string | null;
  incomeLevel: string | null;
  currencies: { code: string; name: string; symbol?: string }[];
  languages: string[];
  areaKm2: number | null;
  latlng: [number, number] | null;
  landlocked: boolean | null;
  independent: boolean | null;
  unMember: boolean | null;
  borders: string[];
  hasBoundary: boolean;
  indicatorsUpdated: string | null;
  indicators: Record<string, SeriesPoint[]>;
  ranks?: Record<string, { rank: number; of: number }>;
};

export type CountryMarket = {
  summary: string;
  exchanges: { name: string; city: string; website: string }[];
  indices: { name: string; symbol: string }[];
  centralBank: { name: string; website: string };
  regulator?: { name: string; website: string };
  companies: { name: string; symbol: string }[];
  sectors: string[];
};

export type CountryIndexEntry = {
  iso3: string;
  name: string;
  flag: string | null;
  region: string | null;
  subregion: string | null;
  gdp: number | null;
  hasMarket: boolean;
};

export type CountryIndexMeta = {
  generated: string;
  indicatorsUpdated: string | null;
  sources: Record<string, string>;
  indicators: Record<string, IndicatorDef>;
};

// GeoJSON Feature with a MultiPolygon of [lng, lat] rings
export type CountryBoundary = {
  type: "Feature";
  properties: { iso: string; name: string };
  geometry: { type: "MultiPolygon"; coordinates: number[][][][] };
};

export type CountryPageData = {
  profile: CountryProfile;
  market: CountryMarket | null;
  boundary: CountryBoundary | null;
  neighbours: { iso3: string; name: string; flag: string | null }[];
  meta: CountryIndexMeta;
};
