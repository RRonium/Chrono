"""World Bank data connector."""


def fetch_indicator(country_code: str, indicator: str) -> dict[str, str]:
    return {"country_code": country_code, "indicator": indicator}
