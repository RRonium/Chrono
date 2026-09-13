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