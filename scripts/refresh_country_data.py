"""Rebuild data/countries/ : one folder per country with its profile, map outline and indicators.

Sources (all free, no API key):
  - Natural Earth 1:50m admin-0 countries, for the map outline of each country
  - mledoze/countries, for names, capital, currency, languages, flag and neighbours
  - World Bank Indicators API, for the economic time series and income group

Hand-written files (market.json, notes.md) in a country folder are never touched.
If the World Bank API cannot be reached, the indicators already on disk are kept.

Usage (stdlib only, Python 3.9+):
    python scripts/refresh_country_data.py              # everything
    python scripts/refresh_country_data.py --offline-wb # keep current indicators, refresh the rest
"""

import argparse
import datetime as dt
import json
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "countries"

NATURAL_EARTH_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson"
COUNTRIES_URL = "https://raw.githubusercontent.com/mledoze/countries/master/countries.json"
WB_API = "https://api.worldbank.org/v2"

FIRST_YEAR = 2000

# id -> (World Bank code, label, unit, group). Units: usd, pct, pct_gdp, people, lcu_per_usd, index.
INDICATORS = {
    "gdp": ("NY.GDP.MKTP.CD", "GDP", "usd", "output"),
    "gdp_growth": ("NY.GDP.MKTP.KD.ZG", "Real GDP growth", "pct", "output"),
    "gdp_per_capita": ("NY.GDP.PCAP.CD", "GDP per capita", "usd", "output"),
    "gdp_per_capita_ppp": ("NY.GDP.PCAP.PP.CD", "GDP per capita (PPP)", "usd", "output"),
    "population": ("SP.POP.TOTL", "Population", "people", "output"),
    "inflation": ("FP.CPI.TOTL.ZG", "Inflation (CPI)", "pct", "prices"),
    "unemployment": ("SL.UEM.TOTL.ZS", "Unemployment", "pct", "prices"),
    "real_interest_rate": ("FR.INR.RINR", "Real interest rate", "pct", "prices"),
    "lending_rate": ("FR.INR.LEND", "Bank lending rate", "pct", "prices"),
    "exchange_rate": ("PA.NUS.FCRF", "Exchange rate (per USD)", "lcu_per_usd", "prices"),
    "gov_debt": ("GC.DOD.TOTL.GD.ZS", "Central government debt", "pct_gdp", "fiscal"),
    "tax_revenue": ("GC.TAX.TOTL.GD.ZS", "Tax revenue", "pct_gdp", "fiscal"),
    "current_account": ("BN.CAB.XOKA.GD.ZS", "Current account balance", "pct_gdp", "external"),
    "exports": ("NE.EXP.GNFS.ZS", "Exports of goods & services", "pct_gdp", "external"),
    "imports": ("NE.IMP.GNFS.ZS", "Imports of goods & services", "pct_gdp", "external"),
    "fdi_inflows": ("BX.KLT.DINV.WD.GD.ZS", "FDI net inflows", "pct_gdp", "external"),
    "reserves": ("FI.RES.TOTL.CD", "Total reserves (incl. gold)", "usd", "external"),
    "market_cap": ("CM.MKT.LCAP.CD", "Listed companies market cap", "usd", "markets"),
    "market_cap_gdp": ("CM.MKT.LCAP.GD.ZS", "Market cap", "pct_gdp", "markets"),
    "domestic_credit": ("FS.AST.PRVT.GD.ZS", "Credit to private sector", "pct_gdp", "markets"),
    "agriculture": ("NV.AGR.TOTL.ZS", "Agriculture", "pct_gdp", "structure"),
    "industry": ("NV.IND.TOTL.ZS", "Industry", "pct_gdp", "structure"),
    "services": ("NV.SRV.TOTL.ZS", "Services", "pct_gdp", "structure"),
}

RANKED = ["gdp", "gdp_per_capita", "population"]

# Natural Earth features without an ISO code: map to the page they belong to, or skip (None).
NE_OVERRIDES = {"Kosovo": "XKX", "N. Cyprus": "CYP", "Somaliland": "SOM", "Siachen Glacier": None}
# mledoze uses UNK for Kosovo; the World Bank uses XKX.
META_ALIASES = {"XKX": "UNK"}


def fetch_json(url: str, retries: int = 3):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "chrono-country-data/1.0"})
            with urllib.request.urlopen(req, timeout=60) as res:
                return json.load(res)
        except Exception as exc:  # network errors, 5xx, bad JSON
            if attempt == retries - 1:
                raise
            print(f"  retry {url}: {exc}", file=sys.stderr)
            time.sleep(2 ** attempt)


def page_iso(props: dict):
    if props["NAME"] in NE_OVERRIDES:
        return NE_OVERRIDES[props["NAME"]]
    iso = props["ISO_A3_EH"]
    return iso if iso != "-99" else None


def round_ring(ring):
    out = []
    for lng, lat in ring:
        point = [round(lng, 3), round(lat, 3)]
        if not out or out[-1] != point:
            out.append(point)
    return out if len(out) >= 4 else None


def boundaries() -> dict:
    """Merge Natural Earth features into one MultiPolygon per page code."""
    polygons: dict[str, list] = {}
    for feature in fetch_json(NATURAL_EARTH_URL)["features"]:
        iso = page_iso(feature["properties"])
        if not iso:
            continue
        geom = feature["geometry"]
        parts = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
        for polygon in parts:
            rings = [r for r in (round_ring(ring) for ring in polygon) if r]
            if rings:
                polygons.setdefault(iso, []).append(rings)
    return {iso: {"type": "MultiPolygon", "coordinates": parts} for iso, parts in polygons.items()}


def world_bank():
    """Returns (series by indicator id -> iso -> [[year, value]], country metadata by iso)."""
    meta = {}
    for row in fetch_json(f"{WB_API}/country?format=json&per_page=400")[1]:
        if row["region"]["value"] == "Aggregates":
            continue
        meta[row["id"]] = {"incomeLevel": row["incomeLevel"]["value"], "wbRegion": row["region"]["value"].strip()}

    year = dt.date.today().year
    series: dict[str, dict] = {}
    for key, (code, *_rest) in INDICATORS.items():
        print(f"  World Bank {code}")
        rows = fetch_json(f"{WB_API}/country/all/indicator/{code}?format=json&per_page=20000&date={FIRST_YEAR}:{year}")
        by_iso: dict[str, list] = {}
        for row in rows[1] or []:
            iso = row["countryiso3code"]
            if iso in meta and row["value"] is not None:
                by_iso.setdefault(iso, []).append([int(row["date"]), round(float(row["value"]), 4)])
        series[key] = {iso: sorted(points) for iso, points in by_iso.items()}
    return series, meta


def latest(points, max_age=6):
    if not points:
        return None
    year, value = points[-1]
    return value if year >= dt.date.today().year - max_age else None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--offline-wb", action="store_true", help="skip the World Bank API and keep indicators on disk")
    args = parser.parse_args()

    print("Natural Earth outlines")
    shapes = boundaries()
    print("Country metadata")
    countries = {c["cca3"]: c for c in fetch_json(COUNTRIES_URL)}

    wb_series, wb_meta, wb_ok = {}, {}, False
    if not args.offline_wb:
        try:
            wb_series, wb_meta = world_bank()
            wb_ok = True
        except Exception as exc:
            print(f"World Bank API unavailable, keeping indicators on disk: {exc}", file=sys.stderr)

    page_codes = {meta: page for page, meta in META_ALIASES.items()}
    on_disk = {p.parent.name for p in OUT.glob("*/profile.json")}
    isos = sorted(set(shapes) | {page_codes.get(i, i) for i in countries} | set(wb_meta) | on_disk)
    today = dt.date.today().isoformat()
    profiles = {}

    for iso in isos:
        folder = OUT / iso
        old = {}
        if (folder / "profile.json").exists():
            old = json.loads((folder / "profile.json").read_text())
        c = countries.get(META_ALIASES.get(iso, iso))
        if not c and not old.get("iso2"):
            continue  # World Bank-only groupings such as the Channel Islands (CHI)

        if wb_ok:
            indicators = {key: wb_series[key][iso] for key in INDICATORS if wb_series[key].get(iso)}
            income = wb_meta.get(iso, {}).get("incomeLevel")
            data_updated = today
        else:
            indicators = old.get("indicators", {})
            income = old.get("incomeLevel")
            data_updated = old.get("indicatorsUpdated")

        profile = {
            "iso3": iso,
            "iso2": c["cca2"] if c else old.get("iso2"),
            "name": c["name"]["common"] if c else old.get("name", iso),
            "officialName": c["name"]["official"] if c else old.get("officialName"),
            "flag": c.get("flag") if c else old.get("flag"),
            "capital": (c.get("capital") or [None])[0] if c else old.get("capital"),
            "region": c.get("region") if c else old.get("region"),
            "subregion": c.get("subregion") if c else old.get("subregion"),
            "incomeLevel": income if income and income != "Not classified" else None,
            "currencies": [{"code": k, **v} for k, v in (c.get("currencies") or {}).items()] if c else old.get("currencies", []),
            "languages": sorted((c.get("languages") or {}).values()) if c else old.get("languages", []),
            "areaKm2": c.get("area") if c else old.get("areaKm2"),
            "latlng": c.get("latlng") if c else old.get("latlng"),
            "landlocked": c.get("landlocked") if c else old.get("landlocked"),
            "independent": c.get("independent") if c else old.get("independent"),
            "unMember": c.get("unMember") if c else old.get("unMember"),
            "borders": [b if b != "UNK" else "XKX" for b in (c.get("borders") or [])] if c else old.get("borders", []),
            "hasBoundary": iso in shapes,
            "indicatorsUpdated": data_updated,
            "indicators": indicators,
        }
        profiles[iso] = profile

    # Rank countries on a few headline indicators (latest value within six years).
    for key in RANKED:
        values = sorted(
            ((latest(p["indicators"].get(key)), iso) for iso, p in profiles.items() if latest(p["indicators"].get(key)) is not None),
            reverse=True,
        )
        for position, (_value, iso) in enumerate(values, start=1):
            profiles[iso].setdefault("ranks", {})[key] = {"rank": position, "of": len(values)}

    OUT.mkdir(parents=True, exist_ok=True)
    index = []
    for iso, profile in profiles.items():
        folder = OUT / iso
        folder.mkdir(exist_ok=True)
        (folder / "profile.json").write_text(json.dumps(profile, ensure_ascii=False, separators=(",", ":")) + "\n")
        if iso in shapes:
            feature = {"type": "Feature", "properties": {"iso": iso, "name": profile["name"]}, "geometry": shapes[iso]}
            (folder / "boundary.geojson").write_text(json.dumps(feature, separators=(",", ":")) + "\n")
        index.append({
            "iso3": iso,
            "name": profile["name"],
            "flag": profile["flag"],
            "region": profile["region"],
            "subregion": profile["subregion"],
            "gdp": latest(profile["indicators"].get("gdp")),
            "hasMarket": (folder / "market.json").exists(),
        })

    index.sort(key=lambda row: row["name"])
    meta = {
        "generated": today,
        "indicatorsUpdated": today if wb_ok else max((p["indicatorsUpdated"] or "" for p in profiles.values()), default=None),
        "sources": {
            "boundaries": "Natural Earth 1:50m Admin 0 – Countries (public domain)",
            "metadata": "mledoze/countries (ODbL)",
            "indicators": "World Bank, World Development Indicators (CC BY 4.0)",
        },
        "indicators": {key: {"code": code, "label": label, "unit": unit, "group": group} for key, (code, label, unit, group) in INDICATORS.items()},
    }
    (OUT / "index.json").write_text(json.dumps({"meta": meta, "countries": index}, ensure_ascii=False, indent=1) + "\n")
    print(f"Wrote {len(profiles)} countries to {OUT.relative_to(ROOT)} (World Bank {'refreshed' if wb_ok else 'kept'})")


if __name__ == "__main__":
    main()
