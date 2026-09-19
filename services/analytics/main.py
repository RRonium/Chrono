from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from services.analytics.engine.technical_indicators import compute_sma, compute_rsi, compute_historical_volatility
from services.analytics.intelligence.sentiment_analyzer import analyze_sentiment
from services.analytics.agents.market_brief_agent import generate_market_brief

app = FastAPI(title="Chrono Analytics API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PricePayload(BaseModel):
    prices: list[float]
    window: int = 14

class SentimentPayload(BaseModel):
    text: str

@app.post("/api/v1/analytics/indicators")
async def calculate_indicators(payload: PricePayload):
    sma = await compute_sma(payload.prices, payload.window)
    rsi = await compute_rsi(payload.prices, payload.window)
    vol = await compute_historical_volatility(payload.prices, payload.window)
    return {
        "sma": sma,
        "rsi": rsi,
        "volatility": vol
    }

@app.post("/api/v1/intelligence/sentiment")
async def get_sentiment(payload: SentimentPayload):
    result = await analyze_sentiment(payload.text)
    return result

@app.get("/api/v1/agents/brief/{iso_code}")
async def get_market_brief(iso_code: str):
    dummy_prices = [100.0, 102.0, 101.5, 104.0, 106.0]
    brief = await generate_market_brief(iso_code, dummy_prices, 0.45)
    return brief

@app.get("/")
def root():
    return {"status": "ok", "service": "analytics"}
