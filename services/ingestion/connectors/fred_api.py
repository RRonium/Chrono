"""Federal Reserve Economic Data connector."""


def fetch_series(series_id: str) -> dict[str, str]:
    return {"series_id": series_id}
