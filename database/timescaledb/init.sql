CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

CREATE TABLE IF NOT EXISTS market_ticks (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    price NUMERIC NOT NULL,
    volume NUMERIC,
    iso_code VARCHAR(3) NOT NULL
);

SELECT create_hypertable('market_ticks', 'time', if_not_exists => TRUE);

CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_ohlc
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    symbol,
    first(price, time) AS open,
    max(price) AS high,
    min(price) AS low,
    last(price, time) AS close,
    sum(volume) AS volume,
    iso_code
FROM market_ticks
GROUP BY bucket, symbol, iso_code;
