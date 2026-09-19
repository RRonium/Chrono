import pandas as pd
import numpy as np

async def compute_macro_correlations(asset_prices: list[float], macro_values: list[float]) -> float:
    s1 = pd.Series(asset_prices)
    s2 = pd.Series(macro_values)
    if len(s1) < 2 or len(s2) < 2:
        return 0.0
    corr = s1.corr(s2)
    if np.isnan(corr):
        return 0.0
    return float(corr)
