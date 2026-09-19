async def generate_market_brief(iso_code: str, prices: list[float], sentiment_score: float) -> dict:
    trend = "BULLISH" if len(prices) > 1 and prices[-1] > prices[0] else "BEARISH"
    return {
        "iso_code": iso_code.upper(),
        "trend": trend,
        "sentiment_score": float(sentiment_score),
        "summary": f"Market brief for {iso_code.upper()}: Trend is {trend} with sentiment score {sentiment_score:.2f}."
    }
