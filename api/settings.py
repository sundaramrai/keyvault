from functools import lru_cache
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
import re

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

API_DIR = Path(__file__).resolve().parent
REPO_ROOT = API_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(API_DIR / ".env"), str(REPO_ROOT / ".env"), ".env"),
        env_ignore_empty=True,
        extra="ignore",
    )

    environment: str = Field(default="development", alias="ENVIRONMENT")
    database_url: str = Field(default="", alias="DATABASE_URL")
    database_connect_timeout: int = Field(default=5, alias="DATABASE_CONNECT_TIMEOUT")
    jwt_secret: str | None = Field(default=None, alias="JWT_SECRET")
    allowed_origins_raw: str | None = Field(default=None, alias="ALLOWED_ORIGINS")
    redis_enabled_override: bool | None = Field(default=None, alias="REDIS_ENABLED")
    redis_url: str | None = Field(default=None, alias="REDIS_URL")
    trust_proxy_headers_override: bool | None = Field(default=None, alias="TRUST_PROXY_HEADERS")
    vercel: bool = Field(default=False, alias="VERCEL")
    app_base_url: str = Field(default="http://localhost:3000", alias="APP_BASE_URL")
    smtp_host: str | None = Field(default=None, alias="SMTP_HOST")
    smtp_port: int = Field(default=587, alias="SMTP_PORT")
    smtp_username: str | None = Field(default=None, alias="SMTP_USERNAME")
    smtp_password: str | None = Field(default=None, alias="SMTP_PASSWORD")
    smtp_from: str | None = Field(default=None, alias="SMTP_FROM")
    smtp_starttls: bool = Field(default=True, alias="SMTP_STARTTLS")

    @field_validator("environment", mode="before")
    @classmethod
    def normalize_environment(cls, value: str | None) -> str:
        return (value or "development").strip().lower()

    @field_validator("database_connect_timeout")
    @classmethod
    def validate_connect_timeout(cls, value: int) -> int:
        return max(1, value)

    @field_validator("app_base_url", mode="before")
    @classmethod
    def strip_base_url(cls, value: str | None) -> str:
        return (value or "http://localhost:3000").rstrip("/")

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def allowed_origins(self) -> list[str]:
        if self.allowed_origins_raw:
            origins = [origin.strip() for origin in self.allowed_origins_raw.split(",") if origin.strip()]
            if origins:
                return origins
        if self.is_production:
            raise RuntimeError("ALLOWED_ORIGINS environment variable must be set in production")
        return ["http://localhost:3000"]

    @property
    def redis_enabled(self) -> bool:
        if self.redis_enabled_override is not None:
            return self.redis_enabled_override
        return self.is_production or bool(self.redis_url)

    @property
    def resolved_redis_url(self) -> str | None:
        if not self.redis_enabled:
            return None
        return self.redis_url or None

    @property
    def trust_proxy_headers(self) -> bool:
        if self.trust_proxy_headers_override is not None:
            return self.trust_proxy_headers_override
        return self.vercel

    @property
    def resolved_smtp_from(self) -> str | None:
        return self.smtp_from or self.smtp_username

    @property
    def sqlalchemy_database_url(self) -> str:
        return re.sub(r"^postgres(ql)?://", "postgresql+psycopg://", self.database_url)

    @property
    def database_connect_args(self) -> dict[str, int]:
        query_params = parse_qs(urlsplit(self.sqlalchemy_database_url).query)
        if "connect_timeout" in query_params:
            return {}
        return {"connect_timeout": self.database_connect_timeout}


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


def is_production() -> bool:
    return get_settings().is_production


def get_redis_url() -> str | None:
    return get_settings().resolved_redis_url
