"""Entry point for market and news ingestion."""

from config import settings


def main() -> None:
    print(f"Starting Chrono ingestion in {settings.environment} mode")


if __name__ == "__main__":
    main()
