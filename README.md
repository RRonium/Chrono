# Chrono

Chrono is a modular market intelligence platform for global data, news, and sentiment.

## Structure

- `apps/web`: Next.js frontend
- `apps/backend`: TypeScript API and WebSocket backend
- `services/ingestion`: Python data ingestion and ETL service
- `services/ml_classifier`: Python news classification service
- `database`: PostgreSQL, TimescaleDB, and MongoDB initialization

## Getting started

1. Copy `.env.example` to `.env` and adjust values.
2. Start dependencies with `docker compose up -d`.
3. Install dependencies in each application directory.

This repository is intentionally scaffolded with small starter modules so each service can evolve independently.
