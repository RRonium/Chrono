import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.env")))

POSTGRES_HOST = os.getenv("POSTGRES_HOST", "chrono-postgres")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_USER = os.getenv("POSTGRES_USER", "chrono_admin")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "chrono_password")
POSTGRES_DB = os.getenv("POSTGRES_DB", "chrono_db")


class Settings(BaseSettings):
    POSTGRES_USER: str = POSTGRES_USER
    POSTGRES_PASSWORD: str = POSTGRES_PASSWORD
    POSTGRES_DB: str = POSTGRES_DB
    POSTGRES_HOST: str = POSTGRES_HOST
    POSTGRES_PORT: int = int(POSTGRES_PORT)
    POSTGRES_URL: str = os.getenv(
        "POSTGRES_URL",
        f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}",
    )
    TIMESCALE_URL: str = os.getenv(
        "TIMESCALE_URL",
        f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}",
    )
    MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://chrono-mongodb:27017/chrono_news")
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://chrono-mongodb:27017/chrono_news")
    REDIS_HOST: str = os.getenv("REDIS_HOST", "chrono-redis")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://chrono-redis:6379")
    NODE_ENV: str = os.getenv("NODE_ENV", "development")

    class Config:
        env_file = "../../.env"
        extra = "ignore"

settings = Settings()
