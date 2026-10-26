// Build-time loaders for data/countries/. Server components only: this reads the filesystem.
import fs from "fs";
import path from "path";
import type { CountryBoundary, CountryIndexEntry, CountryIndexMeta, CountryMarket, CountryPageData, CountryProfile } from "./types";

// `next build` runs in apps/web, so the repo-level data folder is two levels up.
const DATA_DIR = path.join(process.cwd(), "..", "..", "data", "countries");

function readJson<T>(...parts: string[]): T | null {
  const file = path.join(DATA_DIR, ...parts);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as T) : null;
}

export function loadCountryIndex(): { meta: CountryIndexMeta; countries: CountryIndexEntry[] } {
  const index = readJson<{ meta: CountryIndexMeta; countries: CountryIndexEntry[] }>("index.json");
  if (!index) throw new Error(`Missing ${DATA_DIR}/index.json. Run scripts/refresh_country_data.py.`);
  return index;
}

export function loadCountry(iso3: string): CountryPageData | null {
  const profile = readJson<CountryProfile>(iso3, "profile.json");
  if (!profile) return null;
  const { meta, countries } = loadCountryIndex();
  const byIso = new Map(countries.map((c) => [c.iso3, c]));
  return {
    profile,
    market: readJson<CountryMarket>(iso3, "market.json"),
    boundary: readJson<CountryBoundary>(iso3, "boundary.geojson"),
    neighbours: profile.borders
      .map((iso) => byIso.get(iso))
      .filter((c): c is CountryIndexEntry => Boolean(c))
      .map(({ iso3, name, flag }) => ({ iso3, name, flag })),
    meta,
  };
}
