# data/countries

One folder per country or territory, named by its ISO 3166-1 alpha-3 code (Kosovo uses the World
Bank's `XKX`). The web app builds a page per folder at `/country/<iso>/`, and the backend serves the
same files at `/api/v1/countries/{iso}`.

```
data/countries/
├── index.json            generated: every country (name, flag, region, latest GDP, hasMarket) + indicator definitions and sources
├── IND/
│   ├── profile.json      generated: names, capital, currency, languages, neighbours, income group, ranks, World Bank time series
│   ├── boundary.geojson  generated: Natural Earth 1:50m outline used by the map (missing for a few tiny territories)
│   └── market.json       hand-written: exchanges, indices, largest companies, central bank, regulator, sectors
└── ...
```

## Generated files

`python scripts/refresh_country_data.py` rebuilds `index.json`, `profile.json` and
`boundary.geojson` from:

| Data | Source | Licence |
|---|---|---|
| Economic indicators (2000 onwards), income group | World Bank Indicators API | CC BY 4.0 |
| Names, capital, currency, languages, flag, neighbours | [mledoze/countries](https://github.com/mledoze/countries) | ODbL |
| Outlines | Natural Earth 1:50m admin-0 countries | Public domain |

The **Refresh country data** workflow runs it monthly (and on demand from the Actions tab), commits
any change as RRonium and redeploys GitHub Pages. If the World Bank API is unreachable the script
keeps the indicators already on disk; `--offline-wb` does that on purpose.

The indicator list lives in `INDICATORS` at the top of the script. Add one there and it appears in
`index.json` (`meta.indicators`) and every `profile.json`; to show it on the page, add its id to a
section in `apps/web/src/components/country/CountryPanel.tsx`.

## Hand-written files

The script never touches these, so they are the place for per-country analysis:

- `market.json` marks a country as a tracked market (its page gets the markets block, live quotes
  for any symbol the ingestion worker streams, and the price chart). Shape: `CountryMarket` in
  `apps/web/src/lib/countries/types.ts`.
- Suggested next: `notes.md` for written analysis, or `analysis/*.json` for model output per
  country, loaded the same way in `apps/web/src/lib/countries/server.ts`.
