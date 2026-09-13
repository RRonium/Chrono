"""Configuration for the ingestion service."""

from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    environment: str = os.getenv("NODE_ENV", "development")
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379")


settings = Settings()
