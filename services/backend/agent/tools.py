"""Tools the country agent can call. Numbers always come from data/countries/ and the live stores,
never from the model, and show_chart / show_table turn them into specs the web page draws."""

import base64
import logging

from services.backend.agent import gemini
from services.backend.database.mongodb import get_mongo_db
from services.backend.database.postgres import get_db_pool
from services.backend.routers.countries import read_country_file

logger = logging.getLogger(__name__)

MAX_SERIES = 5  # the chart palette has five validated colours
FIRST_YEAR = 2000
PERCENT_UNITS = {"pct", "pct_gdp"}


def _str_list(schema_description: str) -> dict:
    return {"type": "array", "items": {"type": "string"}, "description": schema_description}


DECLARATIONS = [
    {
        "name": "get_country_overview",
        "description": "Facts about the country (capital, currency, income group, neighbours, ranks) and the latest value and year of every indicator.",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "get_indicator_series",
        "description": "Annual time series for one or more indicators, for this country or for other countries to compare.",
        "parameters": {
            "type": "object",
            "properties": {
                "indicators": _str_list("Indicator ids from the list in the instructions"),
                "countries": _str_list("ISO alpha-3 codes or country names. Defaults to this country."),
                "start_year": {"type": "integer"},
                "end_year": {"type": "integer"},
            },
            "required": ["indicators"],
        },
    },
    {
        "name": "get_market_snapshot",
        "description": "This country's exchanges, indices, largest companies and central bank, with the latest live prices Chrono has stored.",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "get_recent_news",
        "description": "Recent headlines Chrono has scraped for this country, with sentiment and urgency scores.",
        "parameters": {"type": "object", "properties": {"limit": {"type": "integer", "description": "1 to 15"}}},
    },
    {
        "name": "show_chart",
        "description": (
            "Draw a chart in the user's charts pane from Chrono's data. Use a line chart for trends over years and a bar "
            "chart to compare countries in one year or a few recent years. All indicators in one chart must share a unit "
            f"(money with money, percentages with percentages). At most {MAX_SERIES} lines or bar groups."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "kind": {"type": "string", "enum": ["line", "bar"]},
                "indicators": _str_list("Indicator ids"),
                "countries": _str_list("ISO alpha-3 codes or names. Defaults to this country."),
                "start_year": {"type": "integer"},
                "end_year": {"type": "integer"},
                "year": {"type": "integer", "description": "For a bar chart comparing countries in one year. Defaults to each country's latest."},
            },
            "required": ["title", "kind", "indicators"],
        },
    },
    {
        "name": "show_table",
        "description": "Put a table in the user's charts pane: indicators by year for one country, or the latest values for several countries.",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "indicators": _str_list("Indicator ids"),
                "countries": _str_list("ISO alpha-3 codes or names. Defaults to this country."),
                "start_year": {"type": "integer"},
                "end_year": {"type": "integer"},
            },
            "required": ["title", "indicators"],
        },
    },
    {
        "name": "draw_custom_chart",
        "description": (
            "Only for visuals show_chart cannot draw (derived values such as real interest rates, scatter plots, "
            "dual comparisons, annotated timelines). Pass the exact numbers you got from the other tools; a plotting "
            "sandbox renders them as an image."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "description": {"type": "string", "description": "What to plot and how"},
                "data": {"type": "string", "description": "The numbers to plot, as JSON or CSV"},
            },
            "required": ["title", "description", "data"],
        },
    },
]

IMAGE_STYLE = (
    "Use matplotlib. Style: figure and axes background #0b1424, text and tick labels #8fa0b8, title #d4a64a, "
    "thin gridlines rgba(255,255,255,0.08), no top/right spines, series colours in this order "
    "#3987e5 #c98500 #199e70 #9085e9 #d55181, lines 2px, a legend when there are 2+ series, 1000x560 px at dpi 100. "
    "Plot only the numbers provided. Save and show the figure once."
)


class CountryTools:
    def __init__(self, iso: str, artifact_offset: int = 0):
        self.iso = iso
        self.artifact_offset = artifact_offset
        index = read_country_file("index.json") or {"meta": {"indicators": {}}, "countries": []}
        self.defs: dict = index["meta"]["indicators"]
        self.names = {c["iso3"]: c["name"] for c in index["countries"]}
        self.artifacts: list[dict] = []
        self.steps: list[str] = []

    # ---- helpers -------------------------------------------------------------------------------

    def _profile(self, iso: str) -> dict:
        return read_country_file(iso, "profile.json") or {}

    def _resolve(self, countries) -> list[str]:
        if not countries:
            return [self.iso]
        by_name = {name.lower(): iso for iso, name in self.names.items()}
        out = []
        for item in countries:
            key = str(item).strip()
            iso = key.upper() if key.upper() in self.names else by_name.get(key.lower())
            if not iso:
                raise ValueError(f"Unknown country '{key}'. Use ISO alpha-3 codes.")
            if iso not in out:
                out.append(iso)
        return out

    def _check_indicators(self, indicators) -> list[str]:
        unknown = [i for i in indicators or [] if i not in self.defs]
        if unknown or not indicators:
            raise ValueError(f"Unknown indicator ids {unknown}. Valid ids: {', '.join(self.defs)}")
        return list(dict.fromkeys(indicators))

    def _series(self, iso: str, key: str, start: int | None, end: int | None) -> list[list]:
        points = self._profile(iso).get("indicators", {}).get(key, [])
        return [p for p in points if (start is None or p[0] >= start) and (end is None or p[0] <= end)]

    def _label(self, iso: str, key: str, multi_country: bool, multi_indicator: bool) -> str:
        country, indicator = self.names.get(iso, iso), self.defs[key]["label"]
        if multi_country and multi_indicator:
            return f"{country} · {indicator}"
        return country if multi_country else indicator

    def _shared_unit(self, indicators: list[str]) -> str:
        units = {self.defs[i]["unit"] for i in indicators}
        if units <= PERCENT_UNITS:
            return "pct" if "pct" in units else "pct_gdp"
        if len(units) > 1:
            raise ValueError(f"These indicators have different units ({', '.join(sorted(units))}); use one chart per unit.")
        return units.pop()

    def _source(self, indicators: list[str]) -> str:
        return "World Bank WDI: " + ", ".join(self.defs[i]["code"] for i in indicators)

    def _add(self, artifact: dict) -> int:
        artifact["id"] = self.artifact_offset + len(self.artifacts) + 1
        self.artifacts.append(artifact)
        return artifact["id"]

    # ---- tools ---------------------------------------------------------------------------------

    async def call(self, name: str, args: dict) -> dict:
        try:
            handler = getattr(self, f"tool_{name}", None)
            if handler is None:
                return {"error": f"Unknown tool {name}"}
            return await handler(**(args or {}))
        except (ValueError, TypeError) as exc:
            return {"error": str(exc)}
        except gemini.GeminiError as exc:
            return {"error": str(exc)}
        except Exception as exc:  # a tool failure should not end the chat
            logger.exception("Agent tool %s failed", name)
            return {"error": f"{name} failed: {exc}"}

    async def tool_get_country_overview(self) -> dict:
        p = self._profile(self.iso)
        self.steps.append(f"Read {p.get('name', self.iso)}'s profile")
        latest = {
            key: {"label": self.defs[key]["label"], "unit": self.defs[key]["unit"], "year": pts[-1][0], "value": pts[-1][1]}
            for key, pts in p.get("indicators", {}).items()
            if pts and key in self.defs
        }
        facts = {k: p.get(k) for k in ("name", "officialName", "capital", "region", "subregion", "incomeLevel", "currencies", "languages", "areaKm2", "landlocked", "ranks")}
        facts["neighbours"] = [self.names.get(b, b) for b in p.get("borders", [])]
        market = read_country_file(self.iso, "market.json")
        return {"facts": facts, "latest": latest, "tracked_market": bool(market), "market_summary": (market or {}).get("summary")}

    async def tool_get_indicator_series(self, indicators, countries=None, start_year=None, end_year=None) -> dict:
        keys, isos = self._check_indicators(indicators), self._resolve(countries)
        start = start_year or FIRST_YEAR
        self.steps.append(f"Fetched {', '.join(self.defs[k]['label'] for k in keys)} for {', '.join(self.names.get(i, i) for i in isos)}")
        return {
            "unit_per_indicator": {k: self.defs[k]["unit"] for k in keys},
            "series": {iso: {k: self._series(iso, k, start, end_year) for k in keys} for iso in isos},
        }

    async def tool_get_market_snapshot(self) -> dict:
        market = read_country_file(self.iso, "market.json")
        if not market:
            return {"tracked_market": False, "note": "Chrono does not track an exchange for this country."}
        symbols = [q["symbol"].upper() for q in market["indices"] + market["companies"]]
        prices: dict = {}
        pool = await get_db_pool()
        if pool:
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    "SELECT DISTINCT ON (symbol) symbol, price, time FROM market_ticks WHERE symbol = ANY($1) ORDER BY symbol, time DESC",
                    symbols,
                )
            prices = {r["symbol"]: {"price": float(r["price"]), "time": r["time"].isoformat()} for r in rows}
        self.steps.append("Checked live prices" if prices else "Read market details (no live prices stored)")
        return {"tracked_market": True, **market, "latest_prices": prices or "none stored for these symbols"}

    async def tool_get_recent_news(self, limit=8) -> dict:
        db = get_mongo_db()
        if db is None:
            return {"articles": [], "note": "The news database is not connected."}
        limit = max(1, min(int(limit or 8), 15))
        cursor = db.news_articles.find({"iso_code": self.iso}).sort("published_at", -1).limit(limit)
        articles = []
        async for doc in cursor:
            articles.append({k: doc.get(k) for k in ("title", "source", "published_at", "sentiment", "urgency", "url")})
        self.steps.append(f"Read {len(articles)} recent headlines")
        return {"articles": articles}

    async def tool_show_chart(self, title, kind, indicators, countries=None, start_year=None, end_year=None, year=None) -> dict:
        keys, isos = self._check_indicators(indicators), self._resolve(countries)
        if len(keys) * len(isos) > MAX_SERIES:
            raise ValueError(f"At most {MAX_SERIES} series per chart; split it into several charts.")
        unit = self._shared_unit(keys)
        multi_c, multi_i = len(isos) > 1, len(keys) > 1

        if kind == "bar" and multi_c and not start_year and not end_year:
            # One bar per country, in one year (or each country's latest).
            series, notes = [], []
            for key in keys:
                values = []
                for iso in isos:
                    pts = self._series(iso, key, year, year) if year else self._series(iso, key, None, None)[-1:]
                    values.append(pts[-1][1] if pts else None)
                    if pts and not year:
                        notes.append(f"{self.names.get(iso, iso)} {pts[-1][0]}")
                series.append({"label": self.defs[key]["label"], "values": values})
            categories = [self.names.get(i, i) for i in isos]
            artifact = {"type": "chart", "kind": "bar", "title": title, "unit": unit, "categories": categories, "series": series,
                        "note": f"Year: {year}" if year else "Latest year: " + ", ".join(notes)}
        else:
            start = start_year or (FIRST_YEAR if kind == "line" else None)
            series = [
                {"label": self._label(iso, key, multi_c, multi_i), "points": self._series(iso, key, start, end_year)}
                for iso in isos
                for key in keys
            ]
            if kind == "bar":
                years = sorted({p[0] for s in series for p in s["points"]})[-8:]
                categories = [str(y) for y in years]
                bars = [{"label": s["label"], "values": [dict(map(tuple, s["points"])).get(y) for y in years]} for s in series]
                artifact = {"type": "chart", "kind": "bar", "title": title, "unit": unit, "categories": categories, "series": bars}
            else:
                artifact = {"type": "chart", "kind": "line", "title": title, "unit": unit, "series": series}

        if not any(s.get("points") or any(v is not None for v in s.get("values", [])) for s in artifact["series"]):
            raise ValueError("No data for that selection; nothing was drawn.")
        artifact["source"] = self._source(keys)
        chart_id = self._add(artifact)
        self.steps.append(f"Drew chart {chart_id}: {title}")
        return {"shown": True, "chart_number": chart_id, "data_drawn": {k: v for k, v in artifact.items() if k in ("categories", "series", "note")}}

    async def tool_show_table(self, title, indicators, countries=None, start_year=None, end_year=None) -> dict:
        keys, isos = self._check_indicators(indicators), self._resolve(countries)
        columns = [{"label": self.defs[k]["label"], "unit": self.defs[k]["unit"]} for k in keys]
        if len(isos) == 1:
            start = start_year or FIRST_YEAR
            by_key = {k: dict(map(tuple, self._series(isos[0], k, start, end_year))) for k in keys}
            years = sorted({y for pts in by_key.values() for y in pts}, reverse=True)[:30]
            rows = [[str(y)] + [by_key[k].get(y) for k in keys] for y in years]
            columns = [{"label": "Year", "unit": None}] + columns
        else:
            rows = []
            for iso in isos:
                row = [self.names.get(iso, iso)]
                for k in keys:
                    pts = self._series(iso, k, start_year, end_year)
                    row.append(pts[-1][1] if pts else None)
                rows.append(row)
            columns = [{"label": "Country", "unit": None}] + [dict(c, label=f"{c['label']} (latest)") for c in columns]
        if not rows:
            raise ValueError("No data for that selection; nothing was shown.")
        table_id = self._add({"type": "table", "title": title, "columns": columns, "rows": rows, "source": self._source(keys)})
        self.steps.append(f"Built table {table_id}: {title}")
        return {"shown": True, "table_number": table_id, "rows": rows[:12]}

    async def tool_draw_custom_chart(self, title, description, data) -> dict:
        body = {
            "contents": [{"role": "user", "parts": [{"text": f"Draw this chart.\nTitle: {title}\nWhat to plot: {description}\nData:\n{data}\n\n{IMAGE_STYLE}"}]}],
            "tools": [{"codeExecution": {}}],
        }
        response, _model = await gemini.generate(body, timeout=120)
        parts = (response.get("candidates") or [{}])[0].get("content", {}).get("parts", [])
        image = next((p["inlineData"] for p in parts if "inlineData" in p), None)
        if not image:
            raise ValueError("The plotting sandbox did not return an image.")
        base64.b64decode(image["data"], validate=True)
        image_id = self._add({"type": "image", "title": title, "mime": image.get("mimeType", "image/png"), "data": image["data"],
                              "source": "Drawn by Gemini code execution from Chrono data"})
        self.steps.append(f"Drew custom chart {image_id}: {title}")
        return {"shown": True, "chart_number": image_id}
