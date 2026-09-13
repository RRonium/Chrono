"""Urgency scoring boundary for classified news."""


def score_urgency(text: str) -> float:
    return 0.0 if not text else 0.5
