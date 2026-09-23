from fastapi import APIRouter, HTTPException
from services.backend.database.postgres import get_db_pool

router = APIRouter(prefix="/api/v1/market", tags=["market"])

@router.get("/ticks/{symbol}")
async def get_latest_tick(symbol: str):
    pool = await get_db_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not connected")
    
    query = "SELECT time, symbol, price, volume, iso_code FROM market_ticks WHERE symbol = $1 ORDER BY time DESC LIMIT 1"
    async with pool.acquire() as connection:
        row = await connection.fetchrow(query, symbol.upper())
        if not row:
            raise HTTPException(status_code=404, detail="Symbol not found")
        return {
            "time": row["time"].isoformat(),
            "symbol": row["symbol"],
            "price": float(row["price"]),
            "volume": float(row["volume"]) if row["volume"] is not None else 0.0,
            "iso_code": row["iso_code"]
        }

@router.get("/ohlc/{symbol}")
async def get_ohlc(symbol: str, bucket: str = "1 hour"):
    pool = await get_db_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not connected")
    query = """
        SELECT bucket, symbol, open, high, low, close, volume, iso_code
        FROM hourly_ohlc
        WHERE symbol = $1
          AND bucket >= now() - INTERVAL '5 hours'
        ORDER BY bucket ASC
        LIMIT 6
    """
    async with pool.acquire() as connection:
        rows = await connection.fetch(query, symbol.upper())
        result = []
        for row in rows:
            result.append({
                "time": row["bucket"].isoformat(),
                "symbol": row["symbol"],
                "open": float(row["open"]),
                "high": float(row["high"]),
                "low": float(row["low"]),
                "close": float(row["close"]),
                "volume": float(row["volume"]) if row["volume"] is not None else 0.0,
                "iso_code": row["iso_code"]
            })
        return result
