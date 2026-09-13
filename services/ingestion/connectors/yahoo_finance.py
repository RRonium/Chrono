"""Yahoo Finance connector."""


def fetch_quotes(symbols: list[str]) -> list[dict[str, str]]:
    return [{"symbol": symbol} for symbol in symbols]
