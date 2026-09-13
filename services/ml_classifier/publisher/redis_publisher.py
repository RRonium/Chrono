"""Publish classifier results to Redis streams."""


def publish(channel: str, payload: dict[str, object]) -> None:
    print(f"Publishing to {channel}: {payload}")
