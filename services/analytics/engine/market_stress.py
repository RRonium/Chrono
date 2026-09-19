import numpy as np

async def compute_market_stress(volatility: float, negative_sentiment_ratio: float) -> float:
    vol_score = min(max(volatility * 100, 0.0), 100.0)
    sent_score = min(max(negative_sentiment_ratio * 100, 0.0), 100.0)
    stress_index = (0.6 * vol_score) + (0.4 * sent_score)
    return float(min(max(stress_index, 0.0), 100.0))
