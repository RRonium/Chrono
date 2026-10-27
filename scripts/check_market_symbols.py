"""Check that Yahoo Finance returns a quote for every symbol in data/countries/*/market.json.

Usage: python scripts/check_market_symbols.py   (needs yfinance; exits 1 if any symbol has no data)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.ingestion.connectors.country_markets import fetch_quote, load_country_symbols  # noqa: E402


def main() -> int:
    missing = []
    for symbol, meta in load_country_symbols().items():
        try:
            quote = fetch_quote(symbol, meta)
        except Exception as e:
            quote, error = None, e
        else:
            error = None
        if quote:
            print(f"ok       {meta['iso_code']} {symbol:<14} {quote['price']:>14,.2f} {quote['currency'] or ''}")
        else:
            missing.append(symbol)
            print(f"MISSING  {meta['iso_code']} {symbol:<14} {error or 'no data'}")
    print(f"\n{len(missing)} of {len(load_country_symbols())} symbols have no Yahoo data: {' '.join(missing)}")
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
