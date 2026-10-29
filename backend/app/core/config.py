"""
Application configuration loaded from environment variables.
Never hardcode secrets here — everything comes from .env
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # App
    APP_NAME: str = "TrueShift Workforce Intelligence Platform"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    # IANA timezone used for attendance dates and shift rules. Set APP_TIMEZONE
    # in the deployment environment (for example, Asia/Kolkata or America/New_York).
    APP_TIMEZONE: str = "Asia/Kolkata"

    # MySQL
    MYSQL_HOST: str = "localhost"
    MYSQL_PORT: int = 3306
    MYSQL_USER: str = "root"
    MYSQL_PASSWORD: str = ""
    MYSQL_DATABASE: str = "trueshift"

    # JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: str = "http://localhost:5500,http://127.0.0.1:5500,http://localhost:3000"

    # Qdrant (face embeddings — vector data stays in Qdrant, not MySQL)
    QDRANT_URL: str = ""
    QDRANT_API_KEY: str = ""

    # LLM (Phase 8, reserved)
    LLM_API_KEY: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def sqlalchemy_database_uri(self) -> str:
        return (
            f"mysql+asyncmy://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}"
            f"@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DATABASE}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
