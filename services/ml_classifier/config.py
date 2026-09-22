import os


class Settings:
    FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY", "")
    NEWS_API_KEY = os.getenv("NEWS_API_KEY", "")
    REDIS_HOST = os.getenv("REDIS_HOST", "chrono-redis")
    REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_URL = os.getenv("REDIS_URL", f"redis://{REDIS_HOST}:{REDIS_PORT}")


settings = Settings()
