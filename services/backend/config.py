import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.env")))

class Settings(BaseSettings):
    POSTGRES_USER: str = "chrono_admin"
    POSTGRES_PASSWORD: str = "chrono_password"
    POSTGRES_DB: str = "chrono_db"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_URL: str = "postgresql://chrono_admin:chrono_password@localhost:5432/chrono_db"
    TIMESCALE_URL: str = "postgresql://chrono_admin:chrono_password@localhost:5433/chrono_db"
    MONGO_URI: str = "mongodb://localhost:27017/chrono_news"
    MONGODB_URI: str = "mongodb://localhost:27017/chrono_news"
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_URL: str = "redis://localhost:6379"
    NODE_ENV: str = "development"

    class Config:
        env_file = "../../.env"
        extra = "ignore"

settings = Settings()
