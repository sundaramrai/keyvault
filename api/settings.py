import os


def is_production() -> bool:
    return os.getenv("ENVIRONMENT", "development").lower() == "production"


def _get_bool_env(name: str) -> bool | None:
    raw = os.getenv(name)
    if raw is None:
        return None
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def redis_enabled() -> bool:
    override = _get_bool_env("REDIS_ENABLED")
    if override is not None:
        return override
    return is_production() or bool(os.getenv("REDIS_URL"))


def get_redis_url() -> str | None:
    if not redis_enabled():
        return None
    return os.getenv("REDIS_URL") or None
