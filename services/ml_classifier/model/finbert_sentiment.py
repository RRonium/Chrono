"""FinBERT sentiment classification boundary."""


def classify_sentiment(text: str) -> dict[str, object]:
    return {"text": text, "label": "neutral", "score": 0.0}
