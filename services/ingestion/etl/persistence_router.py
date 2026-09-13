"""Route normalized records to the appropriate persistence store."""


def route(record: dict[str, object]) -> str:
    return "postgres" if record.get("type") == "market" else "mongodb"
