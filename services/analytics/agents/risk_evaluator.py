async def evaluate_risk(iso_code: str, volatility: float, stress_index: float) -> dict:
    risk_level = "LOW"
    if stress_index > 70 or volatility > 0.5:
        risk_level = "HIGH"
    elif stress_index > 40 or volatility > 0.2:
        risk_level = "MEDIUM"
        
    return {
        "iso_code": iso_code.upper(),
        "risk_level": risk_level,
        "stress_index": float(stress_index),
        "volatility": float(volatility)
    }
