"""Entry point for news classification."""

from model.finbert_sentiment import classify_sentiment


def main() -> None:
    print(classify_sentiment("Chrono classifier is ready"))


if __name__ == "__main__":
    main()
