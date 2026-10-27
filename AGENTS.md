# AGENTS.md — Chrono context for AI coding agents

> Read this whole file before you change anything. It describes the code **as it is on `main`
> (checked line by line on 2026-10-27, after PRs #1–#5)**, not the design diagram. Where the two
> differ, this file says so. If something here no longer matches the code, trust the code, then fix
> this file in the same PR.

---

## 0. TL;DR

Chrono is a real-time global markets command center: a Next.js site with a textured 3D globe, a live
price ticker, a candlestick chart, a scored newswire, and a page for each of 250 countries with a
satellite map, World Bank macro data and a Gemini-powered chat analyst ("Ask Chrono"). Behind it are
a Python ingestion worker, a FastAPI gateway and four stores (PostgreSQL, TimescaleDB, MongoDB, Redis),
all run with Docker Compose. Only the web app runs on the host. The site is also deployed as a static
export to GitHub Pages (`https://rronium.github.io/Chrono/`).

What works end to end today:

- **Prices:** Finnhub WebSocket + Yahoo Finance polling → TimescaleDB + Redis pub/sub → FastAPI
  `/ws/live` → ticker, country-page quotes and live chart candles.
- **News:** 12 RSS feeds + Finnhub news + 2 HTML scrapers (+ NewsAPI if keyed) → sentiment and urgency
  scored **before** storage → MongoDB + Redis `news:articles` → newswire and **globe marker colours**.
- **Country pages:** `/country/<iso>/` built at compile time from `data/countries/`, refreshed monthly
  from the World Bank by a GitHub Action.
- **Ask Chrono:** `POST /api/v1/agent/{iso}/chat` runs a Gemini tool loop over Chrono's own data and
  returns text plus chart/table specs. Needs `GEMINI_API_KEY` on the backend.

What looks live but is not (read section 9 before demoing):

- The **AI market brief** card on country pages comes from `services/analytics` with hard-coded prices
  and sentiment, and is not labelled as demo.
- The chart shows **SAMPLE DATA** candles when `hourly_ohlc` is empty, which is likely (bug B3).
- The newswire shows **SAMPLE DATA** articles until the first real article arrives.

Not built: login/auth, live FX, streaming macro data (FRED/World Bank connectors exist but are never
scheduled), the Node/Express backend (empty scaffold).

---

## 1. Ground rules (do not break these)

1. **Do not edit `docker-compose.yml` healthchecks, `depends_on`, container names, ports or
   volumes without asking the owner (Ron, GitHub `RRonium`) first.** They took a long time to get
   healthy. This includes "harmless" clean-ups such as removing the obsolete `version:` key or
   templating the user name in the `pg_isready` healthcheck. Ask in the PR or the chat, then wait.
2. **Never run `docker compose down -v`.** `-v` deletes the `pgdata`, `mongodata` and `redisdata`
   volumes, i.e. all stored ticks and articles. Use `docker compose stop` / `docker compose down`.
3. **Do not start the backend or ingestion on the host while the Docker stack is up.** Port 8000
   will clash, and two ingestion workers will double-write every tick and article.
4. **All writes go through `services/ingestion/etl/persistence_router.py::route_record`.**
   Scrapers and connectors return plain dicts; they never touch a database themselves.
5. **Schema changes need a migration.** `database/*/init.sql` only runs on an *empty* Postgres
   volume. Existing volumes ignore it. Put changes in `database/postgres/migrations/NNN-name.sql`
   and say in the PR how to apply them (they are **not** applied automatically; see section 4.2).
6. **Do not invent tooling.** There are no tests, no linter config and no formatter config. The only
   CI is the two GitHub Actions in section 11.1 (Pages deploy, country data refresh). If you add a
   tool, add it explicitly and document it here.
7. **Do not commit `__pycache__/`, `.DS_Store`, `.env`, `node_modules/` or `apps/web/out/`.**
   `.gitignore` now covers `.env`, `node_modules/`, `.next/`, `__pycache__/`, `*.pyc`,
   `*.tsbuildinfo` and `apps/web/out/`, but 39 `.pyc` files and two `.DS_Store` files were committed
   earlier and are still tracked; do not add more (removing them is a fine separate PR).
8. **Label demo data as demo data.** Never add hard-coded "realistic" values to the UI without a
   visible marker (the newswire and chart use a `SAMPLE DATA` badge; copy that). The project is
   reviewed by people who will assume the screen is live.
9. **Commits are authored as `RRonium`** so they count on Ron's GitHub stats:
   ```bash
   git config user.name RRonium
   git config user.email 219181010+RRonium@users.noreply.github.com
   ```
   PRs are opened from RRonium's account where possible, with `RRonium` as assignee and reviewer.
   The country-data workflow commits with the same identity.
10. **Never put secrets in `NEXT_PUBLIC_*` variables, GitHub Actions variables or the repo.**
    `NEXT_PUBLIC_*` values are baked into public JavaScript. Only the public backend URLs belong
    there. `GEMINI_API_KEY`, `FINNHUB_API_KEY`, database passwords and `JWT_SECRET` live only in the
    gitignored root `.env` on the machine running Docker. Never push a backend image built from a
    directory that has a `.env` (the backend Dockerfile copies it, section 3).
11. **`data/countries/` generated files are rewritten by the monthly workflow.** Edit
    `scripts/refresh_country_data.py` instead of `profile.json` / `boundary.geojson` / `index.json`.
    `market.json` files are hand-written and safe to edit.

---

## 2. Architecture: planned vs built

The design (`Ideation/Auth:Data Ingestion:Updation Pipeline.png`) has three layers. The README's
`docs/assets/architecture.svg` draws the system as built. Status per box of the design:

| Layer | Box in the diagram | Status | Where / what the code really does |
|---|---|---|---|
| 1 Presentation | 3D interactive globe (Three.js / Globe.gl) | **Built** | `apps/web/src/components/globe/` — react-three-fiber textured Earth (day + bump maps), country borders from `public/data/countries.geojson`, hover highlight, click → country page, 6 pulsing hub markers. Globe.gl is not used. |
| 1 | Country side panel (candles, FX, news) | **Built, as pages** | `/country/<iso>/` (section 8.1): map, macro indicators, markets, news, chat. FX is the World Bank annual rate, not live. `components/drawer/*` are leftover stubs. |
| 1 | Auth / login screen | **Missing** | `/login` is a placeholder page. Tables exist (4.1); no endpoints, hashing or JWT. |
| 2 Ingestion | Background cron scheduler | **Built** | APScheduler in `services/ingestion/scheduler/cron_jobs.py`: market every 5 s, news every 60 s. |
| 2 | Moneycontrol / Economic Times scrapers | **Built** | HTML scrapers (fragile) plus the same sites' RSS feeds in `scrapers/rss_feeds.py`. Scrapy is not used. |
| 2 | Other financial & macro APIs (Alpha Vantage, World Bank) | **Partial** | World Bank data reaches the site through `scripts/refresh_country_data.py` (static files, monthly), not through ingestion. `connectors/world_bank.py` and `fred_api.py` exist but are never scheduled. Alpha Vantage absent. Extra: Finnhub news REST. |
| 2 | Yahoo Finance & FRED → Timescale | **Partial** | Yahoo yes. FRED not wired. Extra: **Finnhub WebSocket stream**. |
| 3 Persistence | DB1 PostgreSQL | **Built (tables only)** | Same container as DB2. Nothing reads or writes the tables. |
| 3 | DB2 TimescaleDB | **Built** | `market_ticks` hypertable + `hourly_ohlc` continuous aggregate (refresh policy broken, B3). |
| 3 | DB3 MongoDB | **Built** | `chrono_news.news_articles`, stored already scored. |
| 3 | Mongo → ML classifier | **Different** | The classifier runs inline in the ingestion news loop, before the write. No change streams. |
| 3 | ML classifier → Redis marker colour | **Built, differently** | No per-country Redis keys. Each article carries `urgency`; the browser computes each hub's colour from articles it has (section 5.6). |
| 3 | Redis → globe via WebSockets | **Built** | `/ws/live` fans out ticks and scored articles. |

Extras not in the diagram: country pages + `data/countries/`, the Gemini agent
(`services/backend/agent/`), GitHub Pages hosting, `services/analytics` (FastAPI on 8001, started by
hand) and `apps/backend` (empty Express scaffold).

---

## 3. Runtime topology

`docker compose up -d` starts five containers on the bridge network `chrono-network`:

| Compose service | Container | Image / build | Host port | Healthcheck | Role |
|---|---|---|---|---|---|
| `postgres` | `chrono-postgres` | `timescale/timescaledb:latest-pg15` | 5432 | `pg_isready -U chrono_admin -d chrono_db` | DB1 + DB2 in **one** instance, db `chrono_db` |
| `mongodb` | `chrono-mongodb` | `mongo:7.0` | 27017 | `mongosh --eval "db.adminCommand('ping')"` | DB3, database `chrono_news` |
| `redis` | `chrono-redis` | `redis:7-alpine` (`--save 60 1`) | 6379 | `redis-cli ping` | pub/sub + baseline keys |
| `ingestion` | `chrono-ingestion` | `services/ingestion/Dockerfile` | none | **none** | APScheduler worker + Finnhub thread |
| `backend` | `chrono-backend` | `services/backend/Dockerfile` | 8000 | **none** | FastAPI REST + `/ws/live` + Gemini agent |

Not in compose:

| Process | Port | How it is started |
|---|---|---|
| Next.js web (`apps/web`) | 3000 | `cd apps/web && npm install && npm run dev` on the host |
| Analytics (`services/analytics`) | 8001 | `python3 -m uvicorn services.analytics.main:app --port 8001` from repo root, by hand. Needed only for the AI brief card. |
| Express backend (`apps/backend`) | 4000 | Not used. Ignore it. |

Healthcheck facts you must know (and must not "fix" without asking, rule 1):

- Only the three databases have healthchecks (5 s interval, 5 s timeout, 5 retries). `ingestion` and
  `backend` wait on `condition: service_healthy` for all three, then start. Nothing checks that the
  two app containers themselves are healthy; `docker compose ps` shows them as plain `running`.
- The Postgres healthcheck hard-codes `chrono_admin` / `chrono_db`. If someone sets a different
  `POSTGRES_USER`/`POSTGRES_DB` in `.env`, the healthcheck fails and the app containers never start.
- All services use `restart: always`.

Dockerfile facts:

- Both Python images are `python:3.11-slim`, `WORKDIR /app`, `PYTHONPATH=/app`.
- `ingestion` copies only `services/`, so it **never sees `.env`**. It gets only what compose passes:
  Redis/Postgres host settings, `MONGO_URI` and `FINNHUB_API_KEY`. So `NEWS_API_KEY` and
  `FRED_API_KEY` are empty inside Docker even if `.env` has them.
- `backend` does `COPY . .` (the whole repo, including `Ideation/` PDFs, `data/countries/` and a local
  `.env`; there is no `.dockerignore`). That is how `GEMINI_API_KEY` reaches the agent: `config.py`
  runs `load_dotenv` on `/app/.env`. Rebuild the backend after changing `.env`, and never push that image.
- `services/ingestion/requirements.txt` includes `torch` and `transformers`, so the ingestion image
  is large and loads **ProsusAI/finbert** from Hugging Face when `finbert_sentiment.py` is imported.
  There is no model cache volume, so a recreated container downloads it again. Without network access
  it falls back to keyword rules (6.4).

Rebuild only after changing Python code, a Dockerfile or backend `.env` keys:
`docker compose up -d --build`.

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

Country metadata actually lives in `data/countries/` files (section 8.1), not in this table.

### 4.2 TimescaleDB "DB2" — time series (`database/timescaledb/init.sql`, same server as DB1)

Purpose: every price tick, and candles derived from them.

```
market_ticks (time TIMESTAMPTZ, symbol VARCHAR(32), price NUMERIC, volume NUMERIC, iso_code VARCHAR(3))
  -> hypertable on "time"
hourly_ohlc  continuous aggregate: time_bucket('1 hour') AS bucket, symbol,
             first/max/min/last(price) AS open/high/low/close, sum(volume), iso_code
```

- Writer: `route_record` (psycopg2, **one new connection per tick**).
- Readers: `GET /api/v1/market/ticks/{symbol}`, `GET /api/v1/market/ohlc/{symbol}` (asyncpg pool) and
  the agent's `get_market_snapshot` tool.
- **Known problem (B3):** the last statement of `init.sql` calls
  `add_continuous_aggregate_policy('market_ticks', 'time'::timestamptz, …)`. It names the hypertable
  instead of `hourly_ohlc` and passes an invalid offset, so it errors. In the official image an
  init-script error aborts the first start; on restart the data directory exists, init is skipped,
  and the database runs with what was created **before** the error — so `hourly_ohlc` exists but has
  **no refresh policy**. Recent TimescaleDB versions default continuous aggregates to
  materialised-only, so `hourly_ohlc` can stay empty and the chart falls back to sample candles. This
  is inferred from the code; check with `SELECT * FROM timescaledb_information.jobs;` before relying
  on it. A fix needs a migration (rule 5) and Ron's go-ahead if it touches compose.
- `database/postgres/migrations/002-widen-market-symbol.sql` widens `symbol` to `VARCHAR(32)` for
  volumes created before that change. Migrations are **not** mounted or auto-applied. Apply by hand:
  `docker exec -i chrono-postgres psql -U chrono_admin -d chrono_db < database/postgres/migrations/<file>.sql`.

### 4.3 MongoDB "DB3" — documents (`chrono_news` database)

Purpose: articles whose fields differ by source; macro indicators.

| Collection | Written by | Upsert key | Read by |
|---|---|---|---|
| `news_articles` | `route_record` (type `news`) | `url` | `GET /api/v1/news`, agent `get_recent_news` |
| `economic_indicators` | `route_record` (type `economic`) — **never called today** | `(series_id, date)` | `GET /api/v1/macro/indicators/{iso}` (returns `[]`) |

- The database name `chrono_news` is **hard-coded** in writer and reader. The `MONGO_URI` path
  segment (`/chrono` in compose, `/chrono_news` in `.env.example`) is ignored.
- Articles are stored **with** `sentiment`, `urgency` and `urgency_color` (scored before the write).
- The upsert is `$set` on every scrape, so a re-scraped article's fields are overwritten each minute.
  Scrapers that stamp `published_at` with "now" (Moneycontrol and Economic Times HTML scrapers) keep
  bumping their stored date, so those stories always look fresh.
- `database/mongodb/indexes.js` is never mounted or run, and indexes `headline`/`body`, which are not
  the real field names (`title`/`content`). No indexes exist besides `_id`.
- Articles with an empty `url` (Economic Times HTML items without a link) all upsert onto one
  document; Moneycontrol items without a link use the section page URL and collide the same way.

### 4.4 Redis — live bus

Purpose: millisecond fan-out from the worker to the gateway. It is not a cache of UI state.

| Name | Kind | Publisher | Subscriber | Payload |
|---|---|---|---|---|
| `market:ticks:all` | channel | `route_record` | backend `redis_listener` | tick (6.1) |
| `market:ticks:<SYMBOL>` | channel | `route_record` | **nobody** | tick |
| `news:articles` | channel | `route_record`, **only for new articles** (upserted, not updated) | backend | scored article (6.2) |
| `news:classified` | channel | **nobody** (see B1) | backend | — |
| `market:baseline:<SYMBOL>` | string key | `finnhub_stream._initialize_baselines` | Finnhub handler | previous close (float) for `RELIANCE.NS`, `^NSEI`, `^GSPC` |

If Mongo is down, `route_record` treats every article as new and still publishes it.

---

## 5. Data flows (step by step)

### 5.1 Price path — streaming (Finnhub)

1. Importing `scheduler/cron_jobs.py` **starts the Finnhub thread as a side effect** if
   `FINNHUB_API_KEY` is set. Symbols: `AAPL, MSFT, GOOGL, TSLA, BINANCE:BTCUSDT, BINANCE:ETHUSDT`
   (`DEFAULT_TICKERS` in `cron_jobs.py` overrides `DEFAULT_SYMBOLS` in the connector).
2. On start, `_initialize_baselines()` stores previous closes for `RELIANCE.NS, ^NSEI, ^GSPC` in
   Redis. None of those are streamed, so for streamed symbols `prev_close` is the **first price seen
   since the worker started**, and `change_pct` is change since then, not since the last close.
3. Each trade → a tick dict built in the connector (open/high/low synthesised; `currency` INR for
   `.NS`/`NSEI`, else USD) → **straight to `route_record`** (no `transform_record`/`tag_country`;
   `iso_code` comes from `map_symbol_to_iso`, so crypto is tagged `USA`).
4. Reconnects every 3 s on close. Finnhub's free tier covers US equities and crypto only.

### 5.2 Price path — polling (Yahoo)

`run_market_pipeline` every 5 s (and once at startup) polls `RELIANCE.NS, TATAMOTORS.NS, ^NSEI,
^GSPC` sequentially with yfinance. **If the Finnhub stream is not running** (no key), it also polls
`AAPL, MSFT, GOOGL, TSLA`. Each tick → `transform_record` → `tag_country` → `route_record`.
`change_pct` is against Yahoo's `previous_close` (falls back to the last polled price).

### 5.3 News path

Every 60 s (and once at startup) `run_news_pipeline` runs five collectors concurrently via
`_safe_scrape` (sync ones in a thread pool; any exception → `[]`):

| Collector | File | Notes |
|---|---|---|
| `scrape_moneycontrol` | `scrapers/moneycontrol.py` | HTML, `li.clearfix`. Swallows all errors. `published_at` = now. (A second, unused copy lives in `economic_times.py`.) |
| `scrape_economic_times` | `scrapers/economic_times.py` | HTML. Works on first try; the retry path crashes (B2). |
| `scrape_rss_feeds` | `scrapers/rss_feeds.py` | 12 feeds in `RSS_FEEDS`, fetched in parallel (6 threads, 15 items each): ndtv_profit, reuters, nikkei_asia (via Google News `site:` search), livemint, business_standard, economic_times, moneycontrol, hindu_businessline, cnbc, yahoo_finance, bbc_business, scmp_business. Each feed has a default ISO for headlines that name no country. |
| `fetch_finnhub_news` | `connectors/finnhub_news.py` | `GET /api/v1/news?category=general`, 30 items; skipped without `FINNHUB_API_KEY`. |
| `scrape_newsapi_topheadlines` | `scrapers/newsapi_fallback.py` | Uses `settings.NEWS_API_KEY`; skipped when empty, which is always the case inside Docker (section 3). |

`scrapers/reuters.py::scrape()` returns `[]` and is unused; `scrape_reuters_rss` in
`economic_times.py` is unused too (Reuters now comes through Google News RSS).

For each article: `transform_record` → `tag_country` → `score_urgency` + `classify_sentiment` on
`title + content` → fields `sentiment {label, score}`, `urgency`, `urgency_color` added →
`route_record` (Mongo upsert; publish on `news:articles` only if new). The log line reports how many
were new.

### 5.4 Gateway fan-out

`services/backend/services/pubsub.py::redis_listener` subscribes to `market:ticks:all`,
`news:articles`, `news:classified` and broadcasts **every** message, unfiltered, to **every** connected
`/ws/live` client. It reconnects to Redis after 3 s on error.

### 5.5 Browser socket (`apps/web/src/hooks/useWebSocket.ts`)

- **One socket per tab**, shared by every component that calls `useWebSocket()` (module-level store +
  `useSyncExternalStore`). Opened on first subscriber, closed when the last unmounts.
- URL from `WS_URL` in `lib/constants.ts` (`NEXT_PUBLIC_WS_URL`, default `ws://localhost:8000/ws/live`).
- On start it also fetches `GET /api/v1/news?limit=60` once to seed the feed with stored articles.
- `type === "market"` → buffered, flushed to state every 4 s (latest tick per symbol).
- `type === "news"` → merged by `url || title`, sorted newest first, max 100.
- Anything else is dropped. Reconnects 3 s after close while anyone is subscribed.

### 5.6 Globe colours

`CountryMarkers.tsx::useCountryUrgency` takes, per ISO code, the **highest `urgency` among articles
published in the last 6 hours** (live + seeded). Thresholds match the classifier: > 0.7 red
(CRITICAL), > 0.4 amber (ELEVATED), else green (CALM); no scored article → gold (NO SIGNAL). Only the
six hubs have markers, and only `IND, USA, GBR, DEU, JPN, CHN` are ever tagged, so other countries
never get a colour.

### 5.7 Chart

`TechnicalsPanel` (dashboard: buttons for `AAPL, ^GSPC, ^NSEI, RELIANCE.NS`; country page: the hub's
first six index/company symbols from `market.json`) fetches `GET /api/v1/market/ohlc/{symbol}`
(`hourly_ohlc`, last 5 h, ≤ 6 rows). On error or empty → **sample candles** around 150 with a
`SAMPLE DATA` badge. Live ticks for the symbol are merged into 1-minute candles client-side.

---

## 6. Message and record shapes

The frontend branches on `type`. Keep these shapes stable.

### 6.1 Market tick (`type: "market"`)

```json
{"time": "ISO-8601 UTC", "symbol": "AAPL", "price": 189.12, "volume": 100.0,
 "iso_code": "USA", "type": "market",
 "open": 188.9, "high": 189.12, "low": 188.9, "close": 189.12,
 "change_pct": 0.12, "prev_close": 188.9, "currency": "USD"}
```
`currency` is only set by Finnhub ticks. Persisted columns: `time, symbol, price, volume, iso_code`.

### 6.2 News article (`type: "news"`)

```json
{"title": "...", "url": "https://...", "source": "livemint|cnbc|moneycontrol|economic_times|<finnhub source>|...",
 "published_at": "ISO-8601 UTC", "content": "summary, or the title",
 "iso_code": "IND|USA|GBR|DEU|JPN|CHN", "type": "news",
 "sentiment": {"label": "BULLISH|BEARISH|NEUTRAL", "score": 0.83},
 "urgency": 0.64, "urgency_color": "green|yellow|red"}
```
From the REST endpoint the document also has `_id` (string).

### 6.3 Economic indicator (`type: "economic"`, unused)

FRED: `{series_id, value, date, country_code: "USA", type}`. World Bank: `{indicator, value, date, country_code, type}`
(note: no `series_id`, so the Mongo upsert key would be `null` — fix before scheduling).

### 6.4 Classifier (`services/ml_classifier/model/`)

- `classify_sentiment(text|list) -> list[{text, label: BULLISH|BEARISH|NEUTRAL, score}]` — FinBERT
  if `torch`+`transformers` load, otherwise keyword rules.
- `score_urgency(text, source, published_at, iso_mentioned) -> {urgency 0–1, urgency_color, severity_breakdown, sentiment_label, sentiment_score}`.
  Weights: keyword severity ≤ 0.35, sentiment ≤ 0.25, ISO mention ≤ 0.15, source credibility ≤ 0.20
  (`SOURCE_CREDIBILITY`; most RSS source names are not in it and get the 0.5 default), recency ≤ 0.15
  (24 h half-life); clamped to [0, 1]. Colour: > 0.7 red, > 0.4 yellow, else green.
- `services/ml_classifier` is **not** its own process; ingestion imports it. `main.py` is a CLI demo.
  `publisher/redis_publisher.py` is dead code (B1).

### 6.5 Country tagging (`services/ingestion/etl/iso_tagger.py`)

- `tag_country` keeps an existing `iso_code`; otherwise symbol → `SYMBOL_ISO_MAP` (unknown → `USA`),
  or title → keywords.
- `match_text_to_iso` matches whole words (multi-word keywords as substrings) for IND, GBR, DEU, JPN,
  CHN in that order; returns `None` if nothing matches. `map_text_to_iso` turns `None` into `USA`.
- RSS articles use the match or the feed's default ISO, so e.g. BBC Business defaults to `GBR`.

---

## 7. API reference

### FastAPI backend — `http://localhost:8000` (Swagger at `/docs`)

| Method | Path | Source | Returns |
|---|---|---|---|
| GET | `/` | — | `{"status":"ok","environment":"development"}` |
| GET | `/api/v1/market/ticks/{symbol}` | Timescale `market_ticks` | latest tick or 404 |
| GET | `/api/v1/market/ohlc/{symbol}?bucket=` | Timescale `hourly_ohlc` | ≤ 6 hourly candles from the last 5 h (`bucket` is ignored) |
| GET | `/api/v1/news?iso_code=&limit=20` | Mongo `news_articles` | newest first by `published_at` string; `limit` 1–100 |
| GET | `/api/v1/macro/indicators/{iso_code}` | Mongo `economic_indicators` | always `[]` today |
| GET | `/api/v1/countries` | `data/countries/index.json` | every country + indicator definitions; 503 if missing |
| GET | `/api/v1/countries/{iso}?boundary=` | `data/countries/<ISO>/` | `{profile, market}` (+ `boundary` GeoJSON if asked); 400 for a non-alpha-3 code, 404 for unknown |
| GET | `/api/v1/agent/status` | env | `{configured, models}`; `configured` is false without `GEMINI_API_KEY` |
| POST | `/api/v1/agent/{iso}/chat` | Gemini + tools | body `{message (≤ 4000 chars), history:[{role: user\|model, text}], artifact_offset}` → `{reply, artifacts, steps, model}`. 404 unknown country, 429 when the free quota is used up, 502 bad key, 503 no key or every model busy |
| WS | `/ws/live` | Redis channels | every message on the three subscribed channels |

CORS is `*`. No auth on anything, including the chat endpoint (anyone who can reach the backend can
spend the Gemini quota).

### Analytics — `http://localhost:8001` (manual start)

| Method | Path | Notes |
|---|---|---|
| GET | `/` | `{"status":"ok","service":"analytics"}` |
| POST | `/api/v1/analytics/indicators` | body `{prices: number[], window}` → SMA, RSI, volatility |
| POST | `/api/v1/intelligence/sentiment` | body `{text}` → TextBlob polarity/label |
| GET | `/api/v1/agents/brief/{iso_code}` | **demo:** hard-coded prices `[100,102,101.5,104,106]`, sentiment `0.45` |

`engine/market_stress.py`, `engine/macro_correlations.py`, `agents/risk_evaluator.py`,
`intelligence/iso_impact.py` are implemented but not exposed by any route.

---

## 8. Frontend map (`apps/web`, Next.js 14 App Router, React 18, TypeScript, Tailwind 3)

The app is a **static export** (`next.config.js`: `output: "export"`, `trailingSlash: true`,
`basePath` from `NEXT_PUBLIC_BASE_PATH`). No server code runs at request time, so there are no API
routes, no `getServerSideProps`, and anything dynamic must be fetched from the backend in the browser.

| File | What it is |
|---|---|
| `src/app/page.tsx` | Dashboard: Header, MarketTicker, Globe3D ("WORLD MARKETS" panel + legend), TechnicalsPanel, SentimentFeed ("GLOBAL NEWSWIRE"). A globe click routes to the country page. |
| `src/app/country/page.tsx` | Directory (`CountryDirectory`): name/ISO filter, grouped by region |
| `src/app/country/[iso]/page.tsx` | One static page per country (`generateStaticParams` over `index.json`, `dynamicParams = false`) |
| `src/app/login/page.tsx` | Placeholder text |
| `src/components/globe/Globe3D.tsx` | r3f `Canvas`: textured Earth (`public/img/earth-day.jpg`, `earth-bump.png`), border lines and point-in-polygon picking from `public/data/countries.geojson`, atmosphere shader, auto-rotate (paused on hover), tooltip |
| `src/components/globe/CountryMarkers.tsx` | 6 hubs from `GLOBAL_HUBS`, coloured by urgency (5.6); labels hide on the far side |
| `src/components/dashboard/Header.tsx` | CHRONO wordmark, exchange clocks with OPEN/CLOSED (regular hours only, no holidays), LIVE FEED / DISCONNECTED pill. `marketStatus()` is reused by country pages. |
| `src/components/dashboard/MarketTicker.tsx` | "MARKETS" strip; latest tick per symbol, friendly names via `symbolLabel()` |
| `src/components/dashboard/TechnicalsPanel.tsx` | "PRICE ACTION": lightweight-charts candles + volume, symbol buttons (5.7) |
| `src/components/dashboard/SentimentFeed.tsx` | Newswire with region tabs (`ALL, IND, USA, GBR, DEU, JPN, CHN`), sentiment badge and urgency bar from the article itself; 15 `DEMO_FALLBACK_ARTICLES` shown with a SAMPLE DATA badge when there is nothing live. With `iso` it fetches that country's stored news too. |
| `src/components/country/*` | `CountryView` (shell), `SplitPane`, `CountryMap` (Leaflet), `CountryPanel` (data sections), `MarketSection`, `CountryAgent` (chat), `Charts`, `CountryBrief`, `CountryDirectory` |
| `src/components/canvas/*`, `src/components/drawer/*` | **Stubs** (3–6 lines each) from the original plan; unused |
| `src/hooks/useWebSocket.ts` | The only socket hook (5.5) |
| `src/hooks/useGlobe.ts` | Unused `selectedCountry` state |
| `src/lib/constants.ts` | `GLOBAL_HUBS` (USA `^GSPC`, India `^NSEI`, Germany `BMW.DE`, UK `SHEL.L`, Japan `7203.T`, China `000001.SS`; exchange, index, timezone, session hours), `SYMBOL_LABELS`, `API_URL`, `WS_URL`, `ANALYTICS_URL`, `BASE_PATH` |
| `src/lib/api.ts` | Fetch helpers (`fetchOHLC`, `fetchNews`, `fetchAgentBrief`, …) |
| `src/lib/agent.ts` | Chat client and artifact types (chart / table / image) |
| `src/lib/countries/*` | `types.ts` (file shapes), `server.ts` (build-time fs loaders, server components only), `format.ts` (`countryHref`, number formatting) |
| `src/lib/types/*` | Small types, mostly unused (components use `any`) |

Of the hub symbols only `^GSPC` and `^NSEI` are ingested, so the other four hubs show "no live feed"
for their index; their colour still works because it comes from news.

**Theme** (`tailwind.config.js`, `globals.css`): deep navy `#050a14` background, cards `#0b1424`,
gold accent `#d4a64a` (`gold.soft #e8c882`, `gold.dim #8a6d2f`), ink `#e6edf7` / `#8fa0b8` /
`#5d6e88`, green `#22c55e`, red `#ef4444`, amber for "elevated". `font-display` is Georgia/serif with
wide tracking for headings and the CHRONO wordmark; labels and numbers are monospace. The `cyber-*`
colour names are kept as aliases of the same palette. `.hud-panel` is the panel style. (`layout.tsx`
still puts `bg-[#0a0a0f]` on `<body>`; every page paints its own navy background over it.)

**Environment for the web app.** Next.js only reads `.env*` files inside `apps/web`, so the root
`.env` (including its stale `NEXT_PUBLIC_API_URL=http://localhost:4000`) does **not** affect it.
Without variables, the app talks to `localhost:8000` / `8001`. For Pages, the variables come from
GitHub Actions variables (11.1).

### 8.1 Country pages and `data/countries/`

- **Routing.** `/country/<iso>/` with a lower-case ISO alpha-3 code, built for all 250 folders in
  `data/countries/` (Kosovo is `XKX`). Unknown codes are a 404. Links go through `countryHref()`;
  `next/link` adds the base path.
- **Data at build time.** `src/lib/countries/server.ts` reads `../../data/countries` relative to the
  build's working directory, so builds must run from `apps/web` with the whole repo checked out (the
  Pages workflow does). Each page embeds its profile, `market.json` and outline; there is no runtime
  fetch for them.
- **Layout.** Breadcrumb (WORLD / COUNTRIES / NAME), then `SplitPane`: map left, data right, each at
  least 10% of the viewport width, resizable by drag or arrow keys, double-click to reset, width kept
  in `localStorage`. Below the `lg` breakpoint the panes stack.
- **Right pane, top to bottom.** Profile + ranks, MARKETS (hubs only: session clock, quotes with live
  ticks or "no live feed", chart; other countries get a short note), **Ask Chrono**, KEY INDICATORS,
  MACRO TRENDS (three line charts), ECONOMIC STRUCTURE, the country NEWSWIRE, AI MARKET BRIEF,
  NEIGHBOURS.
- **Map.** Leaflet with Esri World Imagery (+ Esri labels), OpenStreetMap or CARTO Dark tiles, all
  keyless. The country is outlined in gold and the rest of the world dimmed. Countries split by the
  antimeridian are unwrapped, and the initial view frames the main landmass.
- **Folder layout and refresh.** See [`data/countries/README.md`](data/countries/README.md).
  `scripts/refresh_country_data.py` (stdlib only) rebuilds `index.json`, `profile.json` and
  `boundary.geojson` from the World Bank API (23 indicators in `INDICATORS`, from 2000), mledoze/countries
  and Natural Earth 1:50m. If the World Bank is unreachable it keeps the indicators on disk
  (`--offline-wb` does that on purpose). Hand-written `market.json` exists for the six hubs only.
- **Globe codes.** `public/data/countries.geojson` (110m, used by the globe) carries the same ISO codes
  as the page folders; Natural Earth's own codes for South Sudan, Palestine, Western Sahara and Kosovo
  were mapped, and N. Cyprus / Somaliland open Cyprus / Somalia.

### 8.2 Ask Chrono (country agent)

- **UI.** `components/country/CountryAgent.tsx` renders the chat pane and the Charts & Tables pane;
  both heights are draggable. It checks `GET /api/v1/agent/status` first (states: checking, ready,
  no-key, offline). The conversation and artifacts are saved per country in `localStorage` under
  `chrono:agent:<ISO>`.
- **Backend** (`services/backend/agent/`, stdlib only, no Google SDK):
  - `gemini.py` — REST `generateContent` client. Models from `GEMINI_MODELS` (default
    `gemini-3.5-flash,gemini-flash-latest,gemini-3.8-flash,gemini-3.5-flash-lite`), tried in order on
    503/404/network errors, 3 rounds with growing pauses. 429 → "free quota used up" immediately;
    400/401/403 → "check GEMINI_API_KEY".
  - `chat.py` — system prompt (numbers only from tools, charts for trends, not investment advice),
    up to 8 tool rounds per turn, last 20 history messages, 4000-char messages.
  - `tools.py` — `get_country_overview`, `get_indicator_series`, `get_market_snapshot` (Timescale),
    `get_recent_news` (Mongo), `show_chart`, `show_table`, `draw_custom_chart`. `show_chart` /
    `show_table` build their specs from real data (the model never supplies the numbers) and are
    drawn by `Charts.tsx`; at most 5 series. `draw_custom_chart` asks Gemini's code-execution sandbox
    for a matplotlib PNG. Artifact numbers continue across turns via `artifact_offset`, so "see
    chart 3" matches the tab.
- Calls are non-streaming; a custom chart can take a minute or two. The free Gemini quota runs out
  under heavy use; Ron knows and will deal with it later, so do not switch providers on your own.

---

## 9. Known bugs and fake data

### Bugs

| ID | Impact | Where | What happens |
|---|---|---|---|
| B1 | Low (dead code) | `services/ml_classifier/publisher/redis_publisher.py` | Nothing calls it any more. `publish_article_enriched` uses `classify_sentiment` / `score_urgency` without importing them, and its payload has no `type`. The backend still subscribes to `news:classified`, which nobody publishes. Either delete the module and the subscription, or fix it; the globe no longer depends on it. |
| B2 | Medium | `services/ingestion/scrapers/economic_times.py:86,104` | `time.sleep` without `import time` → the retry path raises `NameError` (caught by `_safe_scrape`, so the scraper returns nothing on a bad first try). |
| B3 | Medium | `database/timescaledb/init.sql:28` | Invalid `add_continuous_aggregate_policy` call (4.2) → `hourly_ohlc` likely never refreshes → chart shows sample candles. |
| B4 | Low | `services/ingestion/scrapers/moneycontrol.py`, `economic_times.py` | HTML scrapers stamp `published_at` with the scrape time and can emit empty or shared URLs (4.3). |
| B5 | Low | `.env.example` | `TIMESCALE_URL` uses port **5433** but Postgres is published on **5432**; copying it to `.env` breaks host-run Python services. `NEXT_PUBLIC_API_URL` there points at the unused port 4000 (and is ignored, section 8). |
| B6 | Low | `services/ingestion/etl/persistence_router.py` | New Postgres connection per tick and new Mongo client per article. Fine for a demo, not for scale. |
| B7 | Low | `services/backend/agent/` | No auth or rate limit on the chat endpoint; anyone who can reach the backend can use the Gemini quota. |
| B8 | Low | `services/ingestion/connectors/finnhub_stream.py` | `change_pct` for streamed symbols is since the first trade after the worker started, not since the previous close (5.1). |

Fixed since the 2026-10-26 review (do not "re-fix"): globe urgency colours, duplicated live articles
in the feed, three sockets per tab and no reconnect, NewsAPI key ignored, keyword tagging matching
inside words, undefined Tailwind `cyber-*` classes, hard-coded `localhost` URLs.

### Demo / fallback data (looks real, is not)

| What | Where | Trigger | Labelled? |
|---|---|---|---|
| 15 sample articles with sentiment + urgency | `SentimentFeed.tsx` `DEMO_FALLBACK_ARTICLES` | No live or stored articles (backend unreachable, e.g. Pages without a tunnel) | Yes, SAMPLE DATA |
| 5 candles around 150 | `TechnicalsPanel.tsx` | OHLC fetch fails or returns `[]` (B3) | Yes, SAMPLE DATA |
| AI market brief trend + summary | `services/analytics/main.py` (`get_market_brief`) | Always, when analytics runs | **No** |
| FRED value `0.0` for `2026-01-01` | `connectors/fred_api.py` | No `FRED_API_KEY` (connector unused anyway) | n/a |

---

## 10. Configuration

`.env` lives at the repo root (copy `.env.example`). Python services load it via `load_dotenv` on
`../../.env` relative to their `config.py`; real environment variables win. In Docker, compose passes
variables explicitly (container host names `chrono-postgres`, `chrono-mongodb`, `chrono-redis`), and
only the backend image contains `.env` (section 3).

| Variable | Used by | Notes |
|---|---|---|
| `POSTGRES_USER/PASSWORD/DB` | compose, backend, ingestion | defaults `chrono_admin / chrono_password / chrono_db`. Changing user/db breaks the healthcheck (section 3). |
| `TIMESCALE_URL` | ingestion writer, backend pool | Both DBs share this URL. Example file has the wrong port (B5). |
| `POSTGRES_URL` | defined, unused | |
| `MONGO_URI` | ingestion, backend | db segment ignored (`chrono_news` hard-coded) |
| `REDIS_URL` | everything | |
| `FINNHUB_API_KEY` | ingestion (stream + news) | optional; passed to the container by compose. Without it Yahoo polls the US symbols and Finnhub news is skipped. |
| `NEWS_API_KEY` | ingestion (NewsAPI) | optional; only works when ingestion runs on the host (not passed by compose) |
| `FRED_API_KEY` | defined, connector unused | |
| `GEMINI_API_KEY` | backend agent | secret; only in the gitignored `.env`. Rebuild the backend after setting it. |
| `GEMINI_MODELS` | backend agent | optional comma list, tried in order |
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`, `NEXT_PUBLIC_ANALYTICS_URL` | web build | public URLs only; set as GitHub Actions **variables** for Pages, or in `apps/web/.env.local` locally |
| `NEXT_PUBLIC_BASE_PATH` | web build | `/Chrono` on github.io (set by the workflow), empty on a custom domain |
| `JWT_SECRET`, `NODE_ENV`, `TIMESCALE_USER/PASSWORD/DB`, `MONGODB_URI` | mostly unused | `NODE_ENV` is echoed by `GET /` |

Defaults (passwords, `JWT_SECRET`) are development values committed in code; never reuse them anywhere real.

---

## 11. How to run

```bash
cp .env.example .env            # then fix TIMESCALE_URL port to 5432 if you run Python on the host
# optional: FINNHUB_API_KEY=... and GEMINI_API_KEY=... in .env

docker compose up -d            # five containers; add --build only after code/Dockerfile/.env changes
docker compose ps               # postgres/mongodb/redis should say (healthy)
curl http://localhost:8000/     # {"status":"ok","environment":"development"}

cd apps/web && npm install && npm run dev     # http://localhost:3000

# optional, for the AI brief card (from repo root, needs services/analytics/requirements.txt):
python3 -m uvicorn services.analytics.main:app --port 8001
```

Logs: `docker compose logs -f --tail=50 ingestion backend`.
Stop: `docker compose stop` (keeps data). Never `down -v`.

Python import convention: every Python service is a module under the `services` package and must be
run **from the repo root** (`python -m services.ingestion.main`, `uvicorn services.backend.main:app`),
never from inside its folder. Imports are absolute: `from services.ingestion.etl... import ...`.

Verifying a change: there are no tests. At minimum, rebuild, check `docker compose logs` for
tracebacks, hit the REST endpoint you touched, and watch the dashboard. For web changes, also run
`cd apps/web && npm run build` (it must succeed as a static export, all 250 country pages included).

Useful probes:

```bash
docker exec -it chrono-redis redis-cli SUBSCRIBE market:ticks:all news:articles
docker exec -it chrono-postgres psql -U chrono_admin -d chrono_db -c "SELECT symbol, count(*), max(time) FROM market_ticks GROUP BY 1;"
docker exec -it chrono-mongodb mongosh chrono_news --eval "db.news_articles.countDocuments()"
python -m services.ingestion.scrapers.rss_feeds      # from repo root: item count per RSS feed
```

### 11.1 Hosting and GitHub Actions

| Workflow | File | Trigger | What it does |
|---|---|---|---|
| Deploy web to GitHub Pages | `.github/workflows/pages.yml` | push to `main` touching `apps/web/**`, `data/countries/**` or the workflow; manual | `npm ci` + `npm run build` in `apps/web` with `NEXT_PUBLIC_*` from repo **Actions variables**, writes `CNAME` if `CUSTOM_DOMAIN` is set, deploys `apps/web/out` |
| Refresh country data | `.github/workflows/country-data.yml` | 03:00 UTC on the 1st of each month; manual; push touching the script or workflow | runs `scripts/refresh_country_data.py`, commits `data/countries` as RRonium if changed, then triggers the Pages workflow (pushes made with `GITHUB_TOKEN` do not trigger it on their own) |

Pages serves only static files, and it is https, so the browser needs an https/wss backend. The setup
used for reviews: Docker on Ron's machine + `cloudflared tunnel --url http://localhost:8000`, then the
Actions variables `NEXT_PUBLIC_API_URL=https://<random>.trycloudflare.com` and
`NEXT_PUBLIC_WS_URL=wss://<random>.trycloudflare.com/ws/live`, then re-run the Pages workflow. A quick
tunnel's URL changes every time `cloudflared` restarts. Full steps, the custom-domain variables and
always-on options are in [`docs/HOSTING.md`](docs/HOSTING.md). Remember rule 10: only public URLs go
in those variables.

---

## 12. Recipes for common changes

- **Add a market symbol:** add it to the right source list (`DEFAULT_TICKERS` in `cron_jobs.py` for
  Finnhub, `yahoo_symbols` in `run_market_pipeline` for Yahoo), add it to `SYMBOL_ISO_MAP` in
  `etl/iso_tagger.py` (otherwise it is tagged USA), give it a friendly name in `SYMBOL_LABELS` if
  needed, and list it in the country's `market.json` so its page shows the quote. Symbols longer than
  32 chars will not fit.
- **Make a country a tracked market:** add `data/countries/<ISO>/market.json` (copy `IND/market.json`;
  shape `CountryMarket` in `lib/countries/types.ts`), add its symbols to ingestion as above, add it to
  `GLOBAL_HUBS` for a globe marker and clock, add keywords to `TEXT_ISO_KEYWORDS` so news gets tagged,
  and add it to `REGIONS` in `SentimentFeed.tsx`.
- **Add a macro indicator:** add it to `INDICATORS` in `scripts/refresh_country_data.py`, run the
  **Refresh country data** workflow, then show it from `CountryPanel.tsx`. The agent picks it up from
  `index.json` automatically.
- **Add a news source:** if it has RSS, append a `FeedSource(source, url, default_iso)` to `RSS_FEEDS`
  (Google News `site:` search via `google_news_site()` for sites without a feed). Otherwise write a
  function returning article dicts (6.2, without the score fields) and add it to the `scrapers` list
  in `run_news_pipeline`. No DB code in the source. Add the source name to `SOURCE_CREDIBILITY` if it
  should weigh more than 0.5.
- **Add an agent tool:** add a declaration to `DECLARATIONS` and a `tool_<name>` method in
  `services/backend/agent/tools.py`; return data, never let the model invent numbers. If it renders
  something, add an artifact type in `lib/agent.ts` and draw it in `Charts.tsx`.
- **Add a new record type:** add a branch in `route_record`, a Redis channel if it is live, add the
  channel to `redis_listener`'s list in the backend, and a `type` branch in `useWebSocket`.
- **Change a table:** new file in `database/postgres/migrations/` + update `init.sql` for fresh
  volumes + document the manual apply step in the PR.
- **Fix the hourly candles (B3):** a migration that adds the policy on `hourly_ohlc` with valid
  offsets (and, if needed, `timescaledb.materialized_only = false`), plus the same in `init.sql`.

---

## 13. Likely next work

1. Fix B3 so the chart shows real hourly candles, and label or replace the AI brief (it is the last
   unlabelled demo).
2. Country tagging beyond the six hubs (more keywords, or a model), so more countries get colours
   and news.
3. Live FX and written analysis per country (`data/countries/<ISO>/notes.md`, loaded in
   `lib/countries/server.ts`).
4. Auth (FastAPI + the Postgres tables), which also protects the chat endpoint.
5. Schedule FRED / World Bank connectors into Mongo `economic_indicators`.
6. Pooling and per-channel/per-country filtering for scale.

Open questions the owner has not answered yet: whether `services/analytics` joins compose, whether
the classifier becomes its own container fed from Mongo (as in the diagram), whether DB1/DB2 sharing
one Postgres container is final, and how to handle the Gemini free-quota limit.

---

## 14. Glossary

- **Hub** — one of the six exchange markers on the globe (`GLOBAL_HUBS`).
- **Urgency** — 0–1 score from `urgency_scorer.py`; drives hub colour (green ≤ 0.4 < amber ≤ 0.7 < red).
- **Tick** — one price observation (`type: "market"`).
- **ISO code** — ISO 3166-1 alpha-3 (`USA`, `IND`, `DEU`, `GBR`, `JPN`, `CHN`); lower-case in URLs.
- **Artifact** — a chart, table or image the agent produces, numbered across the conversation.
- **DB1 / DB2 / DB3** — Postgres / Timescale / Mongo in the design diagram.
