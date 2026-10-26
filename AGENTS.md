# AGENTS.md — Chrono context for AI coding agents

> Read this whole file before you change anything. It describes the code **as it is on `main`
> (updated for country pages, 2026-10-26)**, not the design diagram. Where the two differ, this file says so.
> If you find something here that no longer matches the code, trust the code, then update this file
> in the same PR.

---

## 0. TL;DR

Chrono is a real-time "financial command center": a Next.js dashboard with a rotating 3D globe,
a live price ticker, an AAPL candlestick chart and a news feed. Behind it are a Python ingestion
worker, a FastAPI gateway, and four stores (PostgreSQL, TimescaleDB, MongoDB, Redis), all run with
Docker Compose. Only the web app runs on the host.

What works end to end today:

- **Prices:** Finnhub WebSocket + Yahoo Finance polling → TimescaleDB + Redis pub/sub → FastAPI
  `/ws/live` → ticker and live chart candles in the browser.
- **News:** scrapers → MongoDB + Redis → `/ws/live` → news feed.

What looks live but is not (read section 9 before demoing):

- Globe marker colours are always the default urgency `0.5` (yellow). The ML → Redis → globe path is broken.
- BULLISH/BEARISH badges on live news are assigned by list position, not by a model.
- The AI market brief on each country page uses hard-coded prices.
- The news feed and the chart show hard-coded **demo data** when they have nothing real.

Country pages: clicking a country on the globe opens `/country/<iso>/`, a full page with a satellite
map and World Bank macro data (snapshot in `data/countries/`, refreshed monthly by a GitHub Action).
See section 8.1.

Not built: login/auth, live FX, streaming macro data (the ingestion FRED/World Bank connectors are
written but never scheduled), NewsAPI, the Node/Express backend (empty scaffold).

---

## 1. Ground rules (do not break these)

1. **Do not edit `docker-compose.yml` healthchecks, `depends_on`, container names, ports or
   volumes without asking the owner (Ron, GitHub `RRonium`) first.** They took a long time to get
   healthy. This includes "harmless" clean-ups such as removing the obsolete `version:` key or
   templating the user name in the `pg_isready` healthcheck.
2. **Never run `docker compose down -v`.** `-v` deletes the `pgdata`, `mongodata` and `redisdata`
   volumes, i.e. all stored ticks and articles. Use `docker compose stop` / `docker compose down`.
3. **Do not start the backend or ingestion on the host while the Docker stack is up.** Port 8000
   will clash, and two ingestion workers will double-write every tick and article.
4. **All writes go through `services/ingestion/etl/persistence_router.py::route_record`.**
   Scrapers and connectors return plain dicts; they never touch a database themselves.
5. **Schema changes need a migration.** `database/*/init.sql` only runs on an *empty* Postgres
   volume. Existing volumes ignore it. Put changes in `database/postgres/migrations/NNN-name.sql`
   and say in the PR how to apply them (they are **not** applied automatically; see section 5).
6. **Do not invent tooling.** There are no tests, no linter config, no formatter config and no CI.
   If you add one, add it explicitly and document it here.
7. **Do not commit `__pycache__/`, `.DS_Store`, `.env` or `node_modules/`.** 39 `.pyc` files and two
   `.DS_Store` files are already tracked by mistake; do not add more. (`.gitignore` currently only
   covers `.env`, `node_modules/` and `.next/`.)
8. **Label demo data as demo data.** Never add new hard-coded "realistic" values to the UI without a
   visible "demo" marker; the project is reviewed by people who will assume the screen is live.
9. **Commits are authored as `RRonium`** (`git config user.name RRonium`,
   `user.email 219181010+RRonium@users.noreply.github.com`), and PRs are assigned to `RRonium`.

---

## 2. Architecture: planned vs built

The design (`Ideation/Auth:Data Ingestion:Updation Pipeline.png`) has three layers. Status per box:

| Layer | Box in the diagram | Status | Where / what the code really does |
|---|---|---|---|
| 1 Presentation | 3D interactive globe (Three.js / Globe.gl) | **Partial** | `apps/web/src/components/globe/` — react-three-fiber wireframe sphere + 6 hard-coded hub markers. Globe.gl is not used. No country borders, no raycast country picking. |
| 1 | Country side panel (candles, FX, news) | **Built, as pages** | Clicking a country opens `/country/<iso>/` (section 8.1): map, macro indicators, markets, news, AI brief. FX is the World Bank annual rate, not live. `components/drawer/*` are leftover stubs. |
| 1 | Auth / login screen | **Missing** | `/login` is a placeholder page. Tables exist (section 4.1); no endpoints, hashing or JWT. |
| 2 Ingestion | Background cron scheduler | **Built** | APScheduler in `services/ingestion/scheduler/cron_jobs.py`: market every 5 s, news every 60 s. |
| 2 | Moneycontrol / Economic Times scrapers | **Built, fragile** | BeautifulSoup on guessed CSS classes. Scrapy is not used. |
| 2 | Other financial & macro APIs (Alpha Vantage, World Bank) | **Partial** | World Bank + FRED functions exist, never scheduled. Alpha Vantage absent. |
| 2 | Yahoo Finance & FRED → Timescale | **Partial** | Yahoo yes. FRED not wired. (Extra, not in diagram: **Finnhub WebSocket stream**.) |
| 3 Persistence | DB1 PostgreSQL | **Built (tables only)** | Same container as DB2. |
| 3 | DB2 TimescaleDB | **Built** | `market_ticks` hypertable + `hourly_ohlc` continuous aggregate. |
| 3 | DB3 MongoDB | **Built** | `chrono_news.news_articles`. |
| 3 | Mongo → ML classifier | **Different** | Classifier is called inline in the news loop of the ingestion process, not triggered by Mongo / change streams. |
| 3 | ML classifier → Redis marker colour | **Broken** | Publish fails (bug B1); nothing stores per-country state in Redis. |
| 3 | Redis → globe via WebSockets | **Partial** | Ticks and raw articles arrive; urgency never does. |

Extras in the repo that are **not** in the diagram: `services/analytics` (FastAPI on 8001, started
by hand), and `apps/backend` (empty Express scaffold).

---

## 3. Runtime topology

`docker compose up -d` starts five containers on the bridge network `chrono-network`:

| Compose service | Container | Image / build | Host port | Healthcheck | Role |
|---|---|---|---|---|---|
| `postgres` | `chrono-postgres` | `timescale/timescaledb:latest-pg15` | 5432 | `pg_isready -U chrono_admin -d chrono_db` | DB1 + DB2 in **one** instance, db `chrono_db` |
| `mongodb` | `chrono-mongodb` | `mongo:7.0` | 27017 | `mongosh … ping` | DB3, database `chrono_news` |
| `redis` | `chrono-redis` | `redis:7-alpine` (`--save 60 1`) | 6379 | `redis-cli ping` | pub/sub + baseline keys |
| `ingestion` | `chrono-ingestion` | `services/ingestion/Dockerfile` | none | **none** | APScheduler worker + Finnhub thread |
| `backend` | `chrono-backend` | `services/backend/Dockerfile` | 8000 | **none** | FastAPI REST + `/ws/live` |

Not in compose:

| Process | Port | How it is started |
|---|---|---|
| Next.js web (`apps/web`) | 3000 | `cd apps/web && npm install && npm run dev` on the host |
| Analytics (`services/analytics`) | 8001 | `python3 -m uvicorn services.analytics.main:app --port 8001` from repo root, by hand. Needed only for the AI brief on country pages. |
| Express backend (`apps/backend`) | 4000 | Not used. `/health` only. Ignore it. |

Healthcheck facts you must know (and must not "fix" without asking, rule 1):

- Only the three databases have healthchecks. `ingestion` and `backend` wait on
  `condition: service_healthy` for all three, then start. Nothing checks that the two app
  containers themselves are healthy; `docker compose ps` shows them as plain `running`.
- The Postgres healthcheck hard-codes `chrono_admin` / `chrono_db`. If someone sets a different
  `POSTGRES_USER`/`POSTGRES_DB` in `.env`, the healthcheck fails and the app containers never start.
- All services use `restart: always`.

Dockerfile facts:

- Both Python images are `python:3.11-slim`, `WORKDIR /app`, `PYTHONPATH=/app`.
- `ingestion` copies only `services/`. `backend` does `COPY . .` (the whole repo, including
  `Ideation/` PDFs and a local `.env` if present; there is no `.dockerignore`).
- `services/ingestion/requirements.txt` includes `torch` and `transformers`, so the ingestion image
  is large and loads **ProsusAI/finbert** from Hugging Face at import time. There is no model cache
  volume, so a recreated container downloads the model again. Without network access it falls back
  to keyword rules (section 6.4).

Rebuild only after changing Python code or a Dockerfile: `docker compose up -d --build`.

---

## 4. The polyglot stores — what each one is for

### 4.1 PostgreSQL "DB1" — relational core (`database/postgres/init.sql`)

Purpose: transactional data where integrity matters (auth, metadata). **Nothing reads or writes these
tables yet.**

```
users            (id UUID PK, email VARCHAR(255) UNIQUE, password_hash, created_at)
user_sessions    (id UUID PK, user_id → users.id, token TEXT, expires_at)
country_metadata (iso_code VARCHAR(3) PK, country_name, latitude, longitude, stock_exchange)  -- empty
```

### 4.2 TimescaleDB "DB2" — time series (`database/timescaledb/init.sql`, same server as DB1)

Purpose: every price tick, and candles derived from them.

```
market_ticks (time TIMESTAMPTZ, symbol VARCHAR(32), price NUMERIC, volume NUMERIC, iso_code VARCHAR(3))
  -> hypertable on "time"
hourly_ohlc  continuous aggregate: time_bucket('1 hour'), symbol, first/max/min/last(price), sum(volume), iso_code
```

- Writer: `route_record` (psycopg2, **one new connection per tick**).
- Readers: `GET /api/v1/market/ticks/{symbol}` and `GET /api/v1/market/ohlc/{symbol}` (asyncpg pool).
- **Known problem (B3):** the last statement of `init.sql` calls
  `add_continuous_aggregate_policy('market_ticks', 'time'::timestamptz, …)`. It names the hypertable
  instead of `hourly_ohlc` and passes an invalid offset, so it errors. In the official image, an
  init-script error aborts the first start; on restart the data directory exists, init is skipped,
  and the database runs with the tables created **before** the error — so `hourly_ohlc` exists but
  has **no refresh policy**. Recent TimescaleDB versions also default continuous aggregates to
  materialised-only, so `hourly_ohlc` can stay empty and the chart falls back to demo candles. This
  is inferred from reading the code; check with
  `SELECT * FROM timescaledb_information.jobs;` before relying on it.
- `database/postgres/migrations/002-widen-market-symbol.sql` widens `symbol` to `VARCHAR(32)` for
  volumes created before that change. Migrations are **not** mounted or auto-applied. Apply by hand:
  `docker exec -i chrono-postgres psql -U chrono_admin -d chrono_db < database/postgres/migrations/<file>.sql`.

### 4.3 MongoDB "DB3" — documents (`chrono_news` database)

Purpose: unstructured articles whose fields differ by source; macro indicators.

| Collection | Written by | Upsert key | Read by |
|---|---|---|---|
| `news_articles` | `route_record` (type `news`) | `url` | `GET /api/v1/news` |
| `economic_indicators` | `route_record` (type `economic`) — **never called today** | `(series_id, date)` | `GET /api/v1/macro/indicators/{iso}` (returns `[]`) |

- The database name `chrono_news` is **hard-coded** in both writer and reader. The `MONGO_URI`
  path segment (`/chrono` in compose, `/chrono_news` in `.env.example`) is ignored.
- Articles are stored **without** sentiment or urgency (enrichment happens after the write).
- `database/mongodb/indexes.js` is never mounted or run, and indexes `headline`/`body`, which are
  not the real field names (`title`/`content`). No indexes exist besides `_id`.
- Articles with an empty `url` (Economic Times items without a link) all upsert onto the same document.

### 4.4 Redis — live bus

Purpose: millisecond fan-out from the worker to the gateway. It is not a cache of UI state today.

| Name | Kind | Publisher | Subscriber | Payload |
|---|---|---|---|---|
| `market:ticks:all` | channel | `route_record` | backend `redis_listener` | tick (6.1) |
| `market:ticks:<SYMBOL>` | channel | `route_record` | **nobody** | tick |
| `news:articles` | channel | `route_record` | backend | article (6.2) |
| `news:classified` | channel | `redis_publisher` (**fails, B1**) | backend | `{article, sentiment, urgency, source}` — **no `type` field** |
| `market:baseline:<SYMBOL>` | string key | `finnhub_stream._initialize_baselines` | Finnhub handler | previous close (float) |

The design's "urgency colours & marker status" keys in Redis do not exist.

---

## 5. Data flows (step by step)

### 5.1 Price path — streaming (Finnhub)

1. Importing `scheduler/cron_jobs.py` **starts the Finnhub thread as a side effect** if
   `FINNHUB_API_KEY` is set. Symbols: `AAPL, MSFT, GOOGL, TSLA, BINANCE:BTCUSDT, BINANCE:ETHUSDT`
   (`DEFAULT_TICKERS` in `cron_jobs.py` overrides `DEFAULT_SYMBOLS` in the connector).
2. On start, `_initialize_baselines()` fetches previous close for `RELIANCE.NS, ^NSEI, ^GSPC` via
   yfinance and stores `market:baseline:<sym>`.
3. Each trade message → a tick dict (open/high/low are synthesised from price and previous close,
   only `price`/`volume` are persisted) → `route_record`.
4. Reconnects every 3 s on close. Finnhub free tier covers US equities and crypto only.

### 5.2 Price path — polling (Yahoo)

`run_market_pipeline` every 5 s polls `RELIANCE.NS, TATAMOTORS.NS, ^NSEI, ^GSPC` sequentially with
yfinance. **If the Finnhub stream is not running** (no key), it also polls `AAPL, MSFT, GOOGL, TSLA`.
Each tick → `transform_record` → `tag_country` → `route_record`.
Note: Yahoo ticks' `change_pct` is change since the *previous poll*, not since the previous close,
so the ticker usually shows `+0.00%` for those symbols.

### 5.3 News path

Every 60 s (and once at startup) `run_news_pipeline` runs four scrapers concurrently:

| Scraper (function actually imported) | File | State |
|---|---|---|
| `scrape_moneycontrol` | `scrapers/moneycontrol.py` | Works while Moneycontrol's HTML matches `li.clearfix`. Swallows all errors. (A second, better copy lives in `economic_times.py` and is unused.) |
| `scrape_economic_times` | `scrapers/economic_times.py` | Works on first try; retry path crashes (B2). |
| `scrape_reuters_rss` | `scrapers/economic_times.py` | feedparser on `reuters.com/rssBusinessNews` (Reuters retired public RSS; often returns 0). |
| `scrape_newsapi_topheadlines` | `scrapers/newsapi_fallback.py` | **Disabled:** key hard-coded to `""` (B5). |

`scrapers/reuters.py::scrape()` returns `[]` and is unused.

For each article: `transform_record` → `tag_country` → `route_record` (Mongo upsert + publish on
`news:articles`) → then `score_urgency` + `classify_sentiment` → `publish_article_enriched` on
`news:classified` (fails, B1). The same articles are re-scraped and re-published every minute.

### 5.4 Gateway fan-out

`services/backend/services/pubsub.py::redis_listener` subscribes to `market:ticks:all`,
`news:articles`, `news:classified` and broadcasts **every** message, unfiltered, to **every**
connected `/ws/live` client.

### 5.5 Browser

`apps/web/src/hooks/useWebSocket.ts` connects to the hard-coded `ws://localhost:8000/ws/live`:
- `type === "market"` → buffered, flushed to state every 4 s (latest tick per symbol).
- `type === "news"` → prepended to `articles` (max 50).
- anything else (e.g. `news:classified` payloads) → **dropped**.
- No reconnect logic.

The hook is called in three places (`page.tsx`, `TechnicalsPanel`, `CountryMarkers`), so each tab
opens **three** WebSockets.

### 5.6 Chart

`TechnicalsPanel` (always `symbol="AAPL"`) fetches `GET /api/v1/market/ohlc/AAPL` (`hourly_ohlc`,
last 5 h, ≤ 6 rows). On error or empty → **demo candles** around 150. Live AAPL ticks are merged into
1-minute candles client-side.

---

## 6. Message and record shapes

The frontend branches on `type`. Keep these shapes stable.

### 6.1 Market tick (`type: "market"`)

```json
{"time": "ISO-8601 UTC", "symbol": "AAPL", "price": 189.12, "volume": 100.0,
 "iso_code": "USA", "type": "market",
 "open": 0, "high": 0, "low": 0, "close": 0, "change_pct": 0.12,
 "prev_close": 188.9, "currency": "USD"}
```
`prev_close` and `currency` are only set by Finnhub ticks. Persisted columns: `time, symbol, price, volume, iso_code`.

### 6.2 News article (`type: "news"`)

```json
{"title": "...", "url": "https://...", "source": "moneycontrol|economic_times|reuters_rss|<newsapi name>",
 "published_at": "string (ISO for most sources, raw text for moneycontrol)", "content": "usually = title",
 "iso_code": "USA|IND|GBR|DEU|JPN", "type": "news"}
```

### 6.3 Economic indicator (`type: "economic"`, unused)

FRED: `{series_id, value, date, country_code: "USA", type}`. World Bank: `{indicator, value, date, country_code, type}`
(note: no `series_id`, so the Mongo upsert key would be `null` — fix before scheduling).

### 6.4 Classifier output

- `classify_sentiment(text|list) -> list[{text, label: BULLISH|BEARISH|NEUTRAL, score}]` — FinBERT
  if `torch`+`transformers` load, otherwise keyword rules (score 0.75/0.5).
- `score_urgency(text, source, published_at, iso_mentioned) -> {urgency 0–1, urgency_color green|yellow|red, severity_breakdown, sentiment_label, sentiment_score}`.
  Colour thresholds: > 0.7 red, > 0.4 yellow, else green (same thresholds in `CountryMarkers.tsx`).

### 6.5 Country tagging

`services/ingestion/etl/iso_tagger.py`:
- `SYMBOL_ISO_MAP` maps known symbols; unknown symbols → `"USA"`.
- `map_text_to_iso` is substring keyword matching for IND, GBR, DEU, JPN; everything else → `"USA"`
  (so most global news lands on the US hub; short keywords like `"uk"` match inside other words).
- `CHN` is a globe hub but no code path ever tags anything `CHN`.

---

## 7. API reference

### FastAPI backend — `http://localhost:8000` (Swagger at `/docs`)

| Method | Path | Source | Returns |
|---|---|---|---|
| GET | `/` | — | `{"status":"ok","environment":"development"}` |
| GET | `/api/v1/market/ticks/{symbol}` | Timescale `market_ticks` | latest tick or 404 |
| GET | `/api/v1/market/ohlc/{symbol}?bucket=` | Timescale `hourly_ohlc` | ≤ 6 hourly candles from the last 5 h (`bucket` param is ignored) |
| GET | `/api/v1/news?iso_code=&limit=20` | Mongo `news_articles` | newest first (by string `published_at`) |
| GET | `/api/v1/macro/indicators/{iso_code}` | Mongo `economic_indicators` | always `[]` today |
| GET | `/api/v1/countries` | `data/countries/index.json` | every country + indicator definitions |
| GET | `/api/v1/countries/{iso}?boundary=` | `data/countries/<ISO>/` | `{profile, market}` (+ `boundary` GeoJSON if asked); 404 for unknown codes |
| GET | `/api/v1/agent/status` | env | `{configured, models}`; `configured` is false without `GEMINI_API_KEY` |
| POST | `/api/v1/agent/{iso}/chat` | Gemini + tools | body `{message, history:[{role,text}], artifact_offset}` → `{reply, artifacts, steps, model}`. 429 when the free quota is used up, 503 when every model is busy |
| WS | `/ws/live` | Redis channels | every message on the three subscribed channels |

CORS is `*`. No auth on anything. Note: the frontend never calls `/api/v1/news`; the feed only shows
articles that arrive over the socket after the page loads.

### Analytics — `http://localhost:8001` (manual start)

| Method | Path | Notes |
|---|---|---|
| POST | `/api/v1/analytics/indicators` | body `{prices: number[], window}` → SMA, RSI, volatility |
| POST | `/api/v1/intelligence/sentiment` | body `{text}` → TextBlob polarity/label |
| GET | `/api/v1/agents/brief/{iso_code}` | **demo:** hard-coded prices `[100,102,101.5,104,106]`, sentiment `0.45` |

`engine/market_stress.py`, `engine/macro_correlations.py`, `agents/risk_evaluator.py`,
`intelligence/iso_impact.py` are implemented but not exposed by any route.

---

## 8. Frontend map (`apps/web`, Next.js 14 App Router, React 18, TypeScript, Tailwind 3)

| File | What it is |
|---|---|
| `src/app/page.tsx` | Dashboard: Header, MarketTicker, Globe3D, TechnicalsPanel(AAPL), SentimentFeed. A globe click routes to the country page. |
| `src/app/country/[iso]/page.tsx` | One static page per country (`generateStaticParams` over `data/countries/index.json`) |
| `src/app/country/page.tsx` | Country directory with search, grouped by region |
| `src/components/country/*` | Country page: `CountryView` (shell), `SplitPane`, `CountryMap` (Leaflet), `CountryPanel` (data), `MarketSection`, `CountryBrief`, `Charts` |
| `src/lib/countries/*` | `types.ts` (file shapes), `server.ts` (build-time fs loaders, server components only), `format.ts` |
| `src/app/login/page.tsx` | Placeholder text |
| `src/components/globe/Globe3D.tsx` | r3f `Canvas`, wireframe sphere, glow, `OrbitControls` |
| `src/components/globe/CountryMarkers.tsx` | 6 pulsing hubs from `GLOBAL_HUBS`; colour from urgency (always 0.5) |
| `src/components/dashboard/MarketTicker.tsx` | Top strip; latest tick per symbol |
| `src/components/dashboard/TechnicalsPanel.tsx` | lightweight-charts candles + volume |
| `src/components/dashboard/SentimentFeed.tsx` | News list; 15 demo articles; fake badges |
| `src/components/dashboard/Header.tsx` | Connection light, decorative "MESH ACTIVE" |
| `src/components/canvas/*`, `src/components/drawer/*` | **Stubs** (3–6 lines each) reserved for the planned globe/side panel |
| `src/hooks/useWebSocket.ts` | The only socket hook |
| `src/hooks/useGlobe.ts` | Unused `selectedCountry` state |
| `src/lib/api.ts` | Fetch helpers; `BACKEND_URL`/`ANALYTICS_URL` hard-coded to localhost |
| `src/lib/constants.ts` | `GLOBAL_HUBS` (USA `^GSPC`, India `^NSEI`, Germany `BMW.DE`, UK `SHEL.L`, Japan `7203.T`, China `000001.SS`). Only `^GSPC` and `^NSEI` are actually ingested. |
| `src/lib/types/*` | Small types, mostly unused (components use `any`) |

Styling: Tailwind with a dark "cyber" look (`#0a0a0f` background, cyan `#00f0ff`, green `#00ff9d`,
red `#ff0055`). Several components use classes like `bg-cyber-bg`, `bg-cyber-card`,
`border-cyber-border`, `text-cyber-accent`, `text-cyber-green` that are **not defined** in
`tailwind.config.js` (it defines `background`, `card`, `accent`), so those classes do nothing.
`.hud-panel` in `globals.css` is the real panel style.

`NEXT_PUBLIC_API_URL` in `.env.example` (port 4000) is not read by any code.

### 8.1 Country pages and `data/countries/`

- **Routing.** `/country/<iso>/` with a lower-case ISO alpha-3 code, built statically for all 250
  folders in `data/countries/` (`dynamicParams = false`, so an unknown code is a 404). Links go
  through `countryHref()` in `src/lib/countries/format.ts`; `next/link` adds the `/Chrono` base path.
- **Data at build time.** `src/lib/countries/server.ts` reads `../../data/countries` relative to
  `apps/web`, so builds must run from `apps/web` with the whole repo checked out (the Pages workflow
  does). Each page embeds its profile, `market.json` and outline; there is no runtime fetch.
- **Layout.** `SplitPane` puts the map left and data right, each at least 10% of the viewport width,
  resizable by drag or arrow keys, double-click to reset, width remembered in `localStorage`. Below
  the `lg` breakpoint the panes stack.
- **Map.** Leaflet with Esri World Imagery (+ Esri labels), OpenStreetMap or CARTO Dark tiles, all
  keyless. The country is outlined in gold and the rest of the world dimmed. Countries split by the
  antimeridian are unwrapped, and the initial view frames the main landmass (mainland France, not
  every overseas department).
- **Folder layout and refresh.** See [`data/countries/README.md`](data/countries/README.md). Generated
  files come from `scripts/refresh_country_data.py` (stdlib only) via the **Refresh country data**
  workflow. Hand-written `market.json` exists for the six hubs (USA, IND, DEU, GBR, JPN, CHN).
- **Ask Chrono (chat).** `components/country/CountryAgent.tsx` renders the chat pane and the
  Charts & Tables pane between the markets block and Key indicators; both heights are draggable and
  the conversation is saved per country in `localStorage`. The backend loop lives in
  `services/backend/agent/` (`chat.py` prompt + loop, `tools.py` tools, `gemini.py` REST client,
  stdlib only). Tools read `data/countries/`, Timescale prices and Mongo news. `show_chart` /
  `show_table` return specs built from real data (the model never supplies the numbers), drawn by
  `Charts.tsx`; `draw_custom_chart` asks Gemini's code-execution sandbox for a matplotlib PNG.
  Artifact numbers continue across turns via `artifact_offset` so "see chart 3" in a reply matches
  the tab. Calls are non-streaming; a custom chart can take a minute or two.
- **Globe codes.** `public/data/countries.geojson` (110m, used by the globe) carries the same ISO
  codes as the page folders; Natural Earth's own codes for South Sudan, Palestine, Western Sahara
  and Kosovo were mapped, and N. Cyprus / Somaliland open Cyprus / Somalia.

---

## 9. Known bugs and fake data (inventory)

### Bugs

| ID | Impact | Where | What happens |
|---|---|---|---|
| B1 | **High** — globe never changes colour | `services/ml_classifier/publisher/redis_publisher.py:99,108` | `publish_article_enriched` calls `classify_sentiment` / `score_urgency` without importing them → `NameError`, caught and logged. Even once fixed: payload has no `type`, so `useWebSocket` drops it; and `CountryMarkers` reads `article.urgency` from `news`-type messages, which are published *before* enrichment. All three must be fixed for colours to move. |
| B2 | Medium | `services/ingestion/scrapers/economic_times.py:86,104` | `time.sleep` without `import time` → retry path raises `NameError`. |
| B3 | Medium | `database/timescaledb/init.sql:28` | Invalid `add_continuous_aggregate_policy` call (see 4.2) → `hourly_ohlc` likely never refreshes → chart shows demo candles. |
| B4 | Medium | `apps/web/src/components/dashboard/SentimentFeed.tsx:170` | Live articles are concatenated with a state copy of themselves, so each live article renders **twice**. |
| B5 | Low | `services/ingestion/scrapers/newsapi_fallback.py:32` | API key hard-coded `""`; `settings.NEWS_API_KEY` exists but is not used. |
| B6 | Low | `.env.example` | `TIMESCALE_URL` uses port **5433** but Postgres is published on **5432**; copying it to `.env` breaks host-run Python services. |
| B7 | Low | `apps/web/src/hooks/useWebSocket.ts` | No reconnect; three sockets per tab. |
| B8 | Low | `services/ingestion/etl/persistence_router.py` | New Postgres connection per tick and new Mongo client per article. Fine for a demo, not for scale. |

### Demo / fallback data (looks real, is not)

| What | Where | Trigger |
|---|---|---|
| 15 articles dated 2026-03-30 with sentiment + urgency | `SentimentFeed.tsx:21` `DEMO_FALLBACK_ARTICLES` | No live articles received yet (i.e. first ~60 s, or scrapers down) |
| BULLISH / BEARISH / NEUTRAL badges | `SentimentFeed.tsx:187` (`idx % 3`) | Any live article (live articles never carry sentiment) |
| "Urgency: 50%" on live articles, hub labels "0.5" | `SentimentFeed.tsx`, `CountryMarkers.tsx:117` | Always (default value) |
| 5 AAPL candles around 150 | `TechnicalsPanel.tsx:126` | OHLC fetch fails or returns `[]` |
| Agent brief trend + summary | `services/analytics/main.py:43` | Always |
| FRED value `0.0` for date `2026-01-01` | `connectors/fred_api.py` | No `FRED_API_KEY` (connector unused anyway) |
| "MESH ACTIVE" spinner | `Header.tsx` | Always (decorative) |

---

## 10. Configuration

`.env` lives at the repo root (copy `.env.example`). Python services load it via
`load_dotenv("../../.env")` relative to their `config.py`; real environment variables win. In
Docker, compose passes variables explicitly (container host names `chrono-postgres`,
`chrono-mongodb`, `chrono-redis`).

| Variable | Used by | Notes |
|---|---|---|
| `POSTGRES_USER/PASSWORD/DB` | compose, backend, ingestion | defaults `chrono_admin / chrono_password / chrono_db`. Changing user/db breaks the healthcheck (section 3). |
| `TIMESCALE_URL` | ingestion writer, backend pool | Both DBs share this URL. |
| `POSTGRES_URL` | defined, unused | |
| `MONGO_URI` | ingestion, backend | db segment ignored (`chrono_news` hard-coded) |
| `REDIS_URL` | everything | |
| `FINNHUB_API_KEY` | ingestion | optional; without it Yahoo polls the US symbols too |
| `FRED_API_KEY`, `NEWS_API_KEY` | defined, unused | |
| `GEMINI_API_KEY` | backend agent | secret; only in the gitignored `.env`. Read by `services/backend/agent/gemini.py`. In Docker it reaches the backend because the image copies the repo, `.env` included (no `.dockerignore`), so rebuild the backend after setting it and never push that image. |
| `GEMINI_MODELS` | backend agent | optional comma list tried in order on 503/404; default `gemini-3.5-flash,gemini-flash-latest,gemini-3.8-flash,gemini-3.5-flash-lite` |
| `JWT_SECRET`, `NODE_ENV`, `NEXT_PUBLIC_API_URL`, `TIMESCALE_USER/PASSWORD/DB`, `MONGODB_URI` | mostly unused | `NODE_ENV` is echoed by `GET /` |

Defaults (passwords, `JWT_SECRET`) are development values committed in code; never reuse them anywhere real.

---

## 11. How to run

```bash
cp .env.example .env            # then fix TIMESCALE_URL port to 5432 if you run Python on the host
# optional: echo "FINNHUB_API_KEY=xxxx" >> .env

docker compose up -d            # five containers; add --build only after code/Dockerfile changes
docker compose ps               # postgres/mongodb/redis should say (healthy)
curl http://localhost:8000/     # {"status":"ok","environment":"development"}

cd apps/web && npm install && npm run dev     # http://localhost:3000

# optional, for the AI brief on country pages (from repo root, needs services/analytics/requirements.txt):
python3 -m uvicorn services.analytics.main:app --port 8001
```

Logs: `docker compose logs -f --tail=50 ingestion backend`.
Stop: `docker compose stop` (keeps data). Never `down -v`.

Python import convention: every Python service is a module under the `services` package and must be
run **from the repo root** (`python -m services.ingestion.main`, `uvicorn services.backend.main:app`),
never from inside its folder. Imports are absolute: `from services.ingestion.etl... import ...`.
`services/ml_classifier` is **not** its own process; ingestion imports it.

Verifying a change: there are no tests. At minimum, rebuild, check `docker compose logs` for
tracebacks, hit the REST endpoint you touched, and watch the dashboard.

Useful probes:

```bash
docker exec -it chrono-redis redis-cli SUBSCRIBE market:ticks:all news:classified
docker exec -it chrono-postgres psql -U chrono_admin -d chrono_db -c "SELECT symbol, count(*), max(time) FROM market_ticks GROUP BY 1;"
docker exec -it chrono-mongodb mongosh chrono_news --eval "db.news_articles.countDocuments()"
```

---

## 12. Recipes for common changes

- **Add a market symbol:** add it to the right source list (`DEFAULT_TICKERS` in `cron_jobs.py` for
  Finnhub, `yahoo_symbols` in `run_market_pipeline` for Yahoo), add it to `SYMBOL_ISO_MAP` in
  `etl/iso_tagger.py` (otherwise it is tagged USA), and if it should be a globe hub, to
  `GLOBAL_HUBS` in `apps/web/src/lib/constants.ts`. Symbols longer than 32 chars will not fit.
- **Make a country a tracked market:** add `data/countries/<ISO>/market.json` (copy `IND/market.json`),
  add its symbols to ingestion as above, and add it to `GLOBAL_HUBS` for a globe marker and clock.
- **Add a macro indicator:** add it to `INDICATORS` in `scripts/refresh_country_data.py`, run the
  **Refresh country data** workflow, then show it from `CountryPanel.tsx`.
- **Add a news source:** write a function returning a list of article dicts (6.2) with
  `type: "news"`, add it to the `scrapers` list in `run_news_pipeline`. No DB code in the scraper.
- **Add a new record type:** add a branch in `route_record`, a Redis channel if it is live, add the
  channel to `redis_listener`'s list in the backend, and a `type` branch in `useWebSocket`.
- **Change a table:** new file in `database/postgres/migrations/` + update `init.sql` for fresh
  volumes + document the manual apply step in the PR.
- **Fix the globe colours (most valuable next fix):** B1 in full (imports, add `type:
  "classified"` or similar, handle it in `useWebSocket`/`CountryMarkers` keyed by
  `article.iso_code`), and ideally also store latest urgency per ISO in a Redis key so new tabs get
  state.

---

## 13. Likely next work (owner's order, from the 2026-10-26 review)

1. Fix the urgency path (B1) so markers change colour.
2. Replace demo data with honest empty states.
3. ~~Build the country side panel~~ Done as country pages. Next: live FX, written analysis per
   country (`data/countries/<ISO>/notes.md`), and per-country news tagging beyond the six hubs.
4. Auth (FastAPI + Postgres tables already present).
5. Schedule FRED / World Bank connectors.
6. Pooling and per-channel/per-country filtering for scale.

Open questions the owner has not answered yet: whether `services/analytics` joins compose, whether
the classifier becomes its own container fed from Mongo (as in the diagram), and whether DB1/DB2
sharing one Postgres container is final.

---

## 14. Glossary

- **Hub** — one of the six clickable markers on the globe (`GLOBAL_HUBS`).
- **Urgency** — 0–1 score from `urgency_scorer.py`; drives hub colour (green ≤ 0.4 < yellow ≤ 0.7 < red).
- **Tick** — one price observation (`type: "market"`).
- **ISO code** — ISO 3166-1 alpha-3 (`USA`, `IND`, `DEU`, `GBR`, `JPN`, `CHN`).
- **DB1 / DB2 / DB3** — Postgres / Timescale / Mongo in the design diagram.
