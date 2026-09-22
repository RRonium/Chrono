import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.env")))

class Settings(BaseSettings):
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "chrono_admin")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "chrono_password")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "chrono_db")
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "chrono-postgres")
    POSTGRES_PORT: int = int(os.getenv("POSTGRES_PORT", "5432"))
    TIMESCALE_URL: str = os.getenv("TIMESCALE_URL", "postgresql://chrono_admin:chrono_password@chrono-postgres:5432/chrono_db")
    POSTGRES_URL: str = os.getenv("POSTGRES_URL", "postgresql://chrono_admin:chrono_password@chrono-postgres:5432/chrono_db")
    MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://chrono-mongodb:27017/chrono_news")
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://chrono-mongodb:27017/chrono_news")
    REDIS_HOST: str = os.getenv("REDIS_HOST", "chrono-redis")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://chrono-redis:6379")
    NODE_ENV: str = os.getenv("NODE_ENV", "development")
    FRED_API_KEY: str = os.getenv("FRED_API_KEY", "")
    FINNHUB_API_KEY: str = os.getenv("FINNHUB_API_KEY", "")
    NEWS_API_KEY: str = os.getenv("NEWS_API_KEY", "")

    class Config:
        env_file = "../../.env"
        extra = "ignore"

settings = Settings()
