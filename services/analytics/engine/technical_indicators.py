import pandas as pd
import numpy as np

async def compute_sma(prices: list[float], window: int = 14) -> list[float]:
    s = pd.Series(prices)
    sma = s.rolling(window=window).mean().fillna(0.0)
    return sma.tolist()

async def compute_ema(prices: list[float], window: int = 14) -> list[float]:
    s = pd.Series(prices)
    ema = s.ewm(span=window, adjust=False).mean().fillna(0.0)
    return ema.tolist()

async def compute_rsi(prices: list[float], window: int = 14) -> list[float]:
    s = pd.Series(prices)
    delta = s.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=window).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=window).mean()
    rs = gain / (loss + 1e-10)
    rsi = 100 - (100 / (1 + rs))
    rsi = rsi.fillna(50.0)
    return rsi.tolist()

async def compute_historical_volatility(prices: list[float], window: int = 14) -> list[float]:
    s = pd.Series(prices)
    log_returns = np.log(s / s.shift(1)).fillna(0.0)
    vol = log_returns.rolling(window=window).std() * np.sqrt(252)
    vol = vol.fillna(0.0)
    return vol.tolist()
