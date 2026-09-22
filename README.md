# Chrono

Chrono is a real-time, 3-layer polyglot financial command center that unifies global stock markets, foreign exchange rates, commodities, and geopolitical news into an interactive 3D WebGL spatial canvas.

The architecture decouples data ingestion, time-series analysis, machine learning sentiment classification, and live client streaming using PostgreSQL, TimescaleDB, MongoDB, Redis, and WebSockets.

---

## Architectural Overview

- Layer 1 (Presentation): Next.js single-page application rendering a full-screen WebGL globe via Three.js and Globe.gl. Features 3D raycasting for nation selection and localized financial drawers.
- Layer 2 (Ingestion & Processing): Decoupled Python ETL pipelines using APScheduler/Celery. Handles structured financial metrics via REST/GraphQL APIs and unstructured web scraping via BeautifulSoup and Scrapy.
- Layer 3 (Polyglot Engine & ML): Relational auth and user state in PostgreSQL (DB1), partitioned time-series OHLC ticks in TimescaleDB (DB2), raw news payloads in MongoDB (DB3), and an asynchronous ML FinBERT model that publishes dynamic marker urgency flags through Redis Pub/Sub and WebSockets.

---

## Repository Directory Structure

```text
chrono/
├── docker-compose.yml              # Multi-container setup for DB1, DB2, DB3, and Redis
├── .env.example                    # Global environment variables template
├── README.md                       # System architecture & developer guidelines
│
├── apps/
│   ├── web/                        # LAYER 1: Frontend Spatial Command Center (Next.js)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── next.config.js
│   │   ├── public/
│   │   │   └── data/               # GeoJSON datasets for countries & spatial mapping
│   │   └── src/
│   │       ├── app/
│   │       │   ├── layout.tsx
│   │       │   ├── page.tsx        # Main 3D Canvas entrypoint
│   │       │   ├── login/          # Auth route
│   │       │   │   └── page.tsx
│   │       │   └── api/            # Next.js API route handlers
│   │       ├── components/
│   │       │   ├── canvas/         # Globe.gl / Three.js 3D viewport
│   │       │   │   ├── GlobeCanvas.tsx
│   │       │   │   ├── Raycaster.ts    # 3D mouse intersection & ISO resolver
│   │       │   │   └── Markers.tsx     # Instanced mesh markers for financial hubs
│   │       │   ├── drawer/         # Country financial side panel UI
│   │       │   │   ├── CountryDrawer.tsx
│   │       │   │   ├── CandlestickChart.tsx
│   │       │   │   ├── FXWidget.tsx
│   │       │   │   └── NewsFeed.tsx
│   │       │   └── ui/             # Reusable UI primitives
│   │       ├── hooks/
│   │       │   ├── useWebSocket.ts # Live Redis Pub/Sub listener hook
│   │       │   └── useGlobe.ts     # Camera controls & spatial state management
│   │       └── lib/
│   │           ├── constants.ts
│   │           └── types/          # Shared TypeScript interfaces
│   │               ├── market.ts
│   │               ├── news.ts
│   │               └── user.ts
│   │
│   └── backend/                    # Core Backend API & Socket Service (Node.js/Express)
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── server.ts           # Express server & WebSocket server setup
│           ├── config/             # Connection configurations for polyglot databases
│           │   ├── postgres.ts     # DB1 connection
│           │   ├── timescaledb.ts  # DB2 connection
│           │   ├── mongodb.ts      # DB3 connection
│           │   └── redis.ts        # Redis client & Pub/Sub broker
│           ├── routes/             # REST API routes
│           │   ├── auth.routes.ts
│           │   ├── market.routes.ts
│           │   ├── news.routes.ts
│           │   └── country.routes.ts
│           ├── controllers/        # Request controllers
│           └── websockets/         # WebSocket handlers broadcasting Redis events
│               └── streamHandler.ts
│
├── services/
│   ├── ingestion/                  # LAYER 2: Ingestion & Processing Pipeline (Python)
│   │   ├── requirements.txt
│   │   ├── main.py                 # Pipeline entrypoint & scheduler execution
│   │   ├── config.py
│   │   ├── scheduler/              # APScheduler / Celery task definitions
│   │   │   └── cron_jobs.py
│   │   ├── connectors/             # Structured Financial API Connectors
│   │   │   ├── yahoo_finance.py
│   │   │   ├── fred_api.py
│   │   │   └── world_bank.py
│   │   ├── scrapers/               # Unstructured Web Scraping Engines
│   │   │   ├── moneycontrol.py
│   │   │   ├── economic_times.py
│   │   │   └── reuters.py
│   │   ├── etl/                    # Data Cleaning & Normalization
│   │   │   ├── transform.py        # Currency normalization & UTC conversion
│   │   │   ├── iso_tagger.py       # Tagging articles with ISO country codes
│   │   │   └── persistence_router.py # Bulk writes to DB2 (Timescale) & DB3 (Mongo)
│   │   └── utils/
│   │
│   └── ml_classifier/              # LAYER 3: Async Sentiment & Urgency Service (Python)
│       ├── requirements.txt
│       ├── main.py                 # MongoDB change stream listener & ML worker
│       ├── model/
│       │   ├── finbert_sentiment.py # Sentiment analysis (Bullish/Bearish/Neutral)
│       │   └── urgency_scorer.py   # Market volatility impact calculator
│       └── publisher/
│           └── redis_publisher.py  # Publishes urgency flags & color updates to Redis
│
└── database/                       # LAYER 3: Database Schemas & Migrations
    ├── postgres/                   # DB1 Setup
    │   ├── init.sql                # Auth, users, sessions schema
    │   └── migrations/
    ├── timescaledb/                # DB2 Setup
    │   ├── init.sql                # OHLC tick tables, Hypertables, Continuous Aggregates
    │   └── hypertables/
    └── mongodb/                    # DB3 Setup
        ├── indexes.js              # Full-text & ISO spatial index setups
        └── collections/

--

## For Testing/Execution
To perform a full End-to-End System Test of Project Chrono, you will need all services running across 4 separate terminal windows/tabs to form the complete operational pipeline:

1. Container Infrastructure Layer (Layer 1)
Ensure your multi-model persistence containers are active in Docker.

Check status:

Bash
docker ps
Required active containers:

chrono-postgres (TimescaleDB engine on port 5432)

chrono-mongodb (Document store on port 27017)

chrono-redis (In-memory cache & Pub/Sub gateway on port 6379)

(If any are stopped, start them with docker-compose up -d from the project root).

2. Terminal 1: Backend API Gateway (Layer 3)
Acts as the central gateway, database proxy, and WebSocket server (ws://localhost:8000/ws/live).

Bash
# Run from project root
python3 -m uvicorn services.backend.main:app --reload --port 8000
Verify: http://localhost:8000/docs

3. Terminal 2: Analytics & Agentic Engine (Layer 4)
Calculates technical indicators, classifies headline sentiment, and generates executive market briefs.

Bash
# Run from project root
python3 -m uvicorn services.analytics.main:app --reload --port 8001
Verify: http://localhost:8001/docs

4. Terminal 3: Data Ingestion & Live Pipeline (Layer 2)
Fetches market ticks and financial headlines, processes them via the persistence router, and broadcasts them live across Redis channels.

Bash
# Run from project root
python3 -m services.ingestion.main
5. Terminal 4: Frontend Command Center & 3D Globe (Layer 5)
The Next.js dashboard and 3D WebGL globe.

Bash
# Run from apps/web directory
cd apps/web
npm run dev
Verify: http://localhost:3000

How to Verify the End-to-End Integration:
Open http://localhost:3000 in your browser.

Check the connection indicator in the header—it should show WebSocket Connected (ws://localhost:8000/ws/live).

Observe the 3D Interactive Globe: nodes (USA, IND, DEU, etc.) should animate and update their stress/sentiment colors as the ingestion script in Terminal 3 fires.

Check the Live News Feed & Price Ticker: new market ticks and classified news items should stream across the dashboard in real time without refreshing.

Click on a country node (e.g., USA or IND) to open the Agentic Market Brief Modal and confirm it successfully fetches the structured intelligence brief from Layer 4 on port 8001.

Spin up those 4 terminals and open http://localhost:3000! Let me know if everything connects smoothly or if you see any connection errors.

## Run and Stop the Demo Safely

### Stop the Project

1. Stop the Next.js development server and any manually started Python services in their terminal windows:

```text
Ctrl+C
```

This applies to local `npm run dev`, backend, analytics, and ingestion processes.

2. From the repository root, stop the Docker containers without deleting images or database data:

```bash
cd /Users/sannidhyabiswas/Documents/Projekts/Chrono
docker compose stop
```

Do not use `docker compose down -v`. The `-v` option removes database volumes and can delete persisted project data.

### Start the Project for a Demo

1. Start the five Docker services using the existing images:

```bash
cd /Users/sannidhyabiswas/Documents/Projekts/Chrono
docker compose up -d
```

Use `docker compose up -d --build` only after changing application code or Dockerfiles. A normal restart does not need to rebuild images.

2. Confirm that all five containers are running and that the databases are healthy:

```bash
docker compose ps
```

Expected services:

- `chrono-postgres`
- `chrono-mongodb`
- `chrono-redis`
- `chrono-ingestion`
- `chrono-backend`

3. Check the backend health endpoint:

```bash
curl http://localhost:8000/
```

Expected response:

```json
{"status":"ok","environment":"development"}
```

4. Start the Next.js frontend in a separate terminal:

```bash
cd /Users/sannidhyabiswas/Documents/Projekts/Chrono/apps/web
npm run dev
```

5. Open the dashboard at [http://localhost:3000](http://localhost:3000).

### Troubleshooting Before a Presentation

If a container is not running, inspect its logs without rebuilding or deleting data:

```bash
docker compose logs --tail=50 ingestion backend
docker compose ps
```

The normal Docker startup path is `docker compose up -d`; do not also start the same backend or ingestion service manually on the host, because that can create port conflicts or duplicate workers.
