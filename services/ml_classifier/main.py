"""Entry point for news classification and urgency scoring."""

from services.ml_classifier.model.finbert_sentiment import classify_sentiment
from services.ml_classifier.model.urgency_scorer import score_urgency


def main() -> None:
    """CLI demo: classify a sample text and score urgency."""
    text = "Chrono classifier is ready for real-time news sentiment analysis"
    sentiment = classify_sentiment(text)
    if isinstance(sentiment, list) and len(sentiment) > 0:
        sentiment = sentiment[0]
    urgency = score_urgency(text=text)
    print(f"Text: {text}")
    print(f"Sentiment: {sentiment}")
    print(f"Urgency: {urgency}")


if __name__ == "__main__":
    main()