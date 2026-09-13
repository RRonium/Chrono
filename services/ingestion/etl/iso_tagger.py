"""ISO country tagging helpers."""


def tag_country(record: dict[str, object], country_code: str) -> dict[str, object]:
    return {**record, "country_code": country_code}
