async def compute_iso_impact(text: str, iso_code: str) -> float:
    upper_code = iso_code.upper()
    lower_text = text.lower()
    score = 0.5
    if upper_code.lower() in lower_text:
        score += 0.3
    if any(kw in lower_text for kw in ["crisis", "surge", "crash", "inflation", "gdp", "rate"]):
        score += 0.2
    return float(min(max(score, 0.0), 1.0))
