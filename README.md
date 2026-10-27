<div align="center">

<img src="docs/assets/banner.svg" alt="Chrono: global markets command center. The CHRONO wordmark, a scrolling markets ticker and a globe with exchange markers coloured by news urgency" width="100%"/>

<br/>

[![Live site](https://img.shields.io/badge/LIVE_SITE-rronium.github.io%2FChrono-0b1424?style=flat-square&labelColor=050a14&color=d4a64a)](https://rronium.github.io/Chrono/)
![Python](https://img.shields.io/badge/Python-3.11-0b1424?style=flat-square&logo=python&logoColor=d4a64a&labelColor=050a14)
![FastAPI](https://img.shields.io/badge/FastAPI-gateway-0b1424?style=flat-square&logo=fastapi&logoColor=d4a64a&labelColor=050a14)
![Next.js](https://img.shields.io/badge/Next.js-14-0b1424?style=flat-square&logo=nextdotjs&logoColor=e6edf7&labelColor=050a14)
![TimescaleDB](https://img.shields.io/badge/TimescaleDB-pg15-0b1424?style=flat-square&logo=postgresql&logoColor=d4a64a&labelColor=050a14)
![MongoDB](https://img.shields.io/badge/MongoDB-7-0b1424?style=flat-square&logo=mongodb&logoColor=22c55e&labelColor=050a14)
![Redis](https://img.shields.io/badge/Redis-7-0b1424?style=flat-square&logo=redis&logoColor=ef4444&labelColor=050a14)
![Gemini](https://img.shields.io/badge/Gemini-agent-0b1424?style=flat-square&logo=googlegemini&logoColor=5999ff&labelColor=050a14)

</div>

**Chrono** is a real-time global markets command center. It streams stock, index and crypto prices,
collects financial headlines from a dozen publishers, stores each kind of data in the database built
for it, and puts everything on an interactive 3D globe. Every one of 250 countries and territories has
its own page with a satellite map, World Bank macro data and an AI analyst you can ask questions.

> [!NOTE]
> **Status (October 2026): working prototype.** Live prices, live scored headlines, globe urgency
> colours, country pages and the country chat all work end to end. Login, live FX and streaming macro
> data are not built yet, and two panels fall back to clearly labelled **sample data** when the
> backend has nothing to show. The full, honest inventory is in
> [`AGENTS.md`](AGENTS.md#9-known-bugs-and-fake-data).

<img src="docs/assets/divider.svg" alt="" width="100%"/>

## What you see

| Page | What is on it |
|---|---|
| **`/` World markets** | A textured 3D globe with country borders. Hover a country to name it, click it to open its page. Six exchange hubs pulse **green / amber / red** by the most urgent headline about that country in the last six hours. Around it: exchange clocks, a scrolling price ticker, a candlestick chart (AAPL, S&P 500, NIFTY 50, Reliance) and the scored newswire with region filters. |
| **`/country/`** | A searchable directory of every country, grouped by region. |
| **`/country/<iso>/`** | Satellite map on the left (Esri imagery, OpenStreetMap or CARTO dark), data on the right, with a draggable divider. Key indicators with year-on-year change, macro trends since 2000, economic structure, the country's news, neighbours, and **Ask Chrono**. The six hub markets also get exchanges, indices, largest companies with live quotes and the price chart. |

The live site is [rronium.github.io/Chrono](https://rronium.github.io/Chrono/). It is a static build,
so it shows live data only while a backend is reachable (see [Hosting](#hosting-on-github-pages)).

## Architecture

<img src="docs/assets/architecture.svg" alt="Chrono architecture as built: Finnhub, Yahoo Finance, RSS feeds and scrapers feed the ingestion worker, which cleans, tags and scores each record and hands it to route_record. Ticks go to TimescaleDB, articles to MongoDB, both are published on Redis. FastAPI serves REST, the /ws/live WebSocket, country files and the Gemini agent to the Next.js site. A monthly GitHub Action rebuilds data/countries from the World Bank." width="100%"/>

Chrono follows a three-layer design (original diagram:
[`Ideation/Auth:Data Ingestion:Updation Pipeline.png`](Ideation/Auth%3AData%20Ingestion%3AUpdation%20Pipeline.png)).

| Layer | What it does | Built with |
|---|---|---|
| **2 · Ingestion & processing** | A Python worker streams trades from Finnhub, polls Yahoo Finance every 5 s, and every 60 s reads 12 RSS feeds, Finnhub's news API and two HTML scrapers. Each record is cleaned, tagged with a country code and, for news, scored for sentiment (FinBERT) and urgency **before** it is stored. | APScheduler, websocket-client, yfinance, feedparser, BeautifulSoup, transformers |
| **3 · Polyglot persistence** | One store per shape of data: price ticks and hourly candles in **TimescaleDB**, scored articles in **MongoDB**, live messages on **Redis** pub/sub, users and sessions in **PostgreSQL**. One function, `route_record`, does every write. | PostgreSQL 15 + TimescaleDB (one container), MongoDB 7, Redis 7 |
| **1 · Presentation** | A FastAPI gateway serves history over REST, fans every Redis message out over one WebSocket, serves the country files and runs the Gemini agent. The Next.js site is a static export hosted on GitHub Pages. | FastAPI, Next.js 14, react-three-fiber, Leaflet, lightweight-charts, Tailwind |

**How a price reaches your screen:** Finnhub trade → `route_record` → row in `market_ticks` and a
message on `market:ticks:all` → FastAPI `/ws/live` → ticker, quotes and chart, with no polling in between.

**How a headline turns a marker red:** RSS item → tagged `IND` → FinBERT + urgency score →
upserted into MongoDB → if new, published on `news:articles` → `/ws/live` → the NSE marker takes the
highest urgency among India's stories from the last six hours (> 0.7 is red).

<img src="docs/assets/divider.svg" alt="" width="100%"/>

## Run it

### What you need

- Docker Desktop (or Docker Engine with the Compose plugin)
- Node.js 18+ and npm, for the web app
- Optional: a free [Finnhub](https://finnhub.io) key for streaming US stock and crypto trades and
  Finnhub news. Without it, Chrono polls the US names from Yahoo Finance instead.
- Optional: a free [Gemini](https://aistudio.google.com/apikey) key for the country chat.

### First-time setup

```bash
git clone https://github.com/RRonium/Chrono.git
cd Chrono
cp .env.example .env              # then add FINNHUB_API_KEY=... and GEMINI_API_KEY=... if you have them
cd apps/web && npm install && cd ../..
```

### Start the project

1. From the repository root, start the five Docker services:

   ```bash
   docker compose up -d
   ```

   Use `docker compose up -d --build` only after changing Python code, a Dockerfile or `.env` keys
   the backend needs. A normal restart does not need a rebuild.

2. Check that all five containers are up and the three databases are healthy:

   ```bash
   docker compose ps
   ```

   Expected: `chrono-postgres`, `chrono-mongodb`, `chrono-redis` (all `healthy`), and
   `chrono-ingestion`, `chrono-backend` (`running`).

3. Check the backend:

   ```bash
   curl http://localhost:8000/
   # {"status":"ok","environment":"development"}
   ```

4. Start the web app in a separate terminal and open [http://localhost:3000](http://localhost:3000):

   ```bash
   cd apps/web
   npm run dev
   ```

5. *(Optional)* The **AI market brief** card on country pages comes from the analytics service, which
   is not in Docker. From the repository root, in another terminal:

   ```bash
   pip install -r services/analytics/requirements.txt
   python3 -m uvicorn services.analytics.main:app --reload --port 8001
   ```

### Check that it works

- The header pill says **LIVE FEED** (green), meaning the browser is connected to `/ws/live`.
- The **MARKETS** ticker fills with symbols within a few seconds.
- The newswire shows stored headlines at once and new ones as they are scraped; the **SAMPLE DATA**
  badge disappears.
- Globe hubs turn green, amber or red once India, the US, the UK, Germany, Japan or China have
  recent scored stories.
- Click any country on the globe to open its page. Drag the divider to resize the panes.
- API docs: [http://localhost:8000/docs](http://localhost:8000/docs).

### Stop the project

Press `Ctrl+C` in the web (and analytics) terminals, then from the repository root:

```bash
docker compose stop
```

> [!CAUTION]
> Do not use `docker compose down -v`. The `-v` flag deletes the database volumes and with them
> every stored tick and article.

### Troubleshooting

Read the logs without rebuilding or deleting anything:

```bash
docker compose logs --tail=50 ingestion backend
docker compose ps
```

Do not also start the backend or ingestion worker by hand while Docker is running them. That causes a
port clash on 8000 and a second worker that writes every tick twice.

<details>
<summary><b>Run the Python services on the host instead (for development)</b></summary>

<br/>

Keep only the databases in Docker, then run each service in its own terminal from the repository
root. In `.env`, set `TIMESCALE_URL` to port **5432** (the example file says 5433, which is wrong for
this setup).

```bash
# Terminal 0: databases only
docker compose up -d postgres mongodb redis
docker compose stop ingestion backend     # if they were already running

# Terminal 1: FastAPI gateway + WebSocket  ->  http://localhost:8000/docs
python3 -m uvicorn services.backend.main:app --reload --port 8000

# Terminal 2: ingestion worker
python3 -m services.ingestion.main

# Terminal 3: analytics (optional)  ->  http://localhost:8001/docs
python3 -m uvicorn services.analytics.main:app --reload --port 8001

# Terminal 4: web app  ->  http://localhost:3000
cd apps/web && npm run dev
```

Install each service's dependencies first with `pip install -r services/<name>/requirements.txt`.
Always run Python from the repository root; the services import each other as `services.<name>`.

</details>

### Ports and live channels

| Service | Container | Port | |
|---|---|---|---|
| PostgreSQL + TimescaleDB | `chrono-postgres` | 5432 | db `chrono_db` |
| MongoDB | `chrono-mongodb` | 27017 | db `chrono_news` |
| Redis | `chrono-redis` | 6379 | pub/sub |
| FastAPI gateway | `chrono-backend` | 8000 | REST `/api/v1/*`, WebSocket `/ws/live` |
| Ingestion worker | `chrono-ingestion` | none | |
| Analytics | host, by hand | 8001 | optional |
| Web app | host, `npm run dev` | 3000 | |

Redis channels: `market:ticks:all` and `market:ticks:<SYMBOL>` (every tick), `news:articles` (each new,
already scored article).

<img src="docs/assets/divider.svg" alt="" width="100%"/>

## Country pages

Every country and territory has a folder under [`data/countries/<ISO>/`](data/countries/README.md):

| File | Made by | What it holds |
|---|---|---|
| `profile.json` | script | names, capital, currency, languages, neighbours, income group, ranks and 23 World Bank series since 2000 |
| `boundary.geojson` | script | Natural Earth outline for the map |
| `market.json` | hand | exchanges, indices, largest companies, central bank, regulator, sectors (the six hubs only) |
| `../index.json` | script | every country plus indicator definitions and sources |

[`scripts/refresh_country_data.py`](scripts/refresh_country_data.py) rebuilds the generated files.
The **Refresh country data** workflow runs it on the 1st of every month (or on demand), commits any
change as RRonium and redeploys the site. The web app reads the folder at build time; the backend
serves the same files at `/api/v1/countries/{iso}`.

### Ask Chrono (country chat)

Each country page has a chat pane under the markets block, with a **Charts & Tables** pane under it.
Ask about the economy, markets or news; the agent (Google Gemini) calls tools that read Chrono's own
data and draws numbered charts and tables the reply can point at ("see chart 3"). The numbers in
charts come from the data, never from the model. Conversations are kept per country in your browser.

To turn it on, give the backend a free key:

```bash
echo "GEMINI_API_KEY=your-key" >> .env      # repo root; .env is gitignored, never commit it
docker compose up -d --build backend        # the backend image copies .env at build time
```

The key stays on the backend; the website never sees it. Free-tier models are sometimes busy, so the
backend retries and falls back across `GEMINI_MODELS`. When the free quota runs out the chat says so.

## Hosting on GitHub Pages

The web app is a static export, deployed by [`.github/workflows/pages.yml`](.github/workflows/pages.yml)
on every push to `main` that touches `apps/web` or `data/countries`. The backend, databases and worker
cannot run on Pages, so the usual setup for a demo is Docker on your machine plus a
[Cloudflare quick tunnel](docs/HOSTING.md):

```bash
cloudflared tunnel --url http://localhost:8000     # prints https://<random>.trycloudflare.com
```

Then set two repository **Actions variables** and re-run the workflow:
`NEXT_PUBLIC_API_URL=https://<random>.trycloudflare.com` and
`NEXT_PUBLIC_WS_URL=wss://<random>.trycloudflare.com/ws/live`.

> [!IMPORTANT]
> `NEXT_PUBLIC_*` values are baked into public JavaScript. Put only these public URLs there. API keys,
> database passwords and `JWT_SECRET` stay in the backend `.env`.

Stable URL on your own domain (named tunnel), troubleshooting, custom domains and always-on hosting:
[`docs/HOSTING.md`](docs/HOSTING.md#cloudflare-tunnel-setup).

## Repository map

<img src="docs/assets/structure.svg" alt="Repository map: apps/web (Next.js, layer 1, with country pages), apps/backend (unused Express scaffold), services/ingestion and ml_classifier (layer 2), services/backend (FastAPI gateway with the Gemini agent), services/analytics (demo), database/ (layer 3), data/countries/ with one folder per ISO code, scripts/refresh_country_data.py, .github/workflows, docs/, docker-compose.yml (ask before editing) and AGENTS.md" width="100%"/>

## Where it is going

| Built | In progress | Planned |
|---|---|---|
| Live ticker from Finnhub + Yahoo | Hourly candles that refresh on their own (TimescaleDB policy fix) | Login and sessions (tables ready in PostgreSQL) |
| News from 12 RSS feeds, Finnhub and scrapers, scored before storage | AI brief on real data instead of fixed inputs | Live FX and written analysis per country |
| Globe urgency colours | Country tagging beyond the six hubs | FRED and World Bank data in the live pipeline |
| 250 country pages with World Bank data | | Per-country channels and connection pooling for scale |
| Ask Chrono country agent | | |
| GitHub Pages hosting | | |

## Contributing

Read [`AGENTS.md`](AGENTS.md) first. It is the full technical context for people and AI coding agents
alike: every service, store, channel and known bug, plus the rules that keep the stack healthy. The
short version:

- Do not change the Docker healthchecks or `depends_on` in `docker-compose.yml` without asking.
- All database writes go through `services/ingestion/etl/persistence_router.py`.
- Schema changes go in `database/postgres/migrations/`, because init scripts only run on empty volumes.
- Commits are authored as `RRonium`.

<div align="center">
<br/>
<img src="docs/assets/divider.svg" alt="" width="100%"/>
<sub>Built by <a href="https://github.com/RRonium">@RRonium</a> · prices from Finnhub and Yahoo Finance · headlines from Livemint, Economic Times, Moneycontrol, CNBC, BBC, Nikkei Asia and more · macro data from the World Bank (CC BY 4.0)</sub>
</div>
