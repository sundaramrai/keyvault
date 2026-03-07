import os
from slowapi import Limiter
from slowapi.util import get_remote_address

_redis_url = os.getenv("REDIS_URL")

# Use Redis for shared state across serverless instances, memory for local dev
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200/minute"],
    storage_uri=_redis_url if _redis_url else "memory://",
)