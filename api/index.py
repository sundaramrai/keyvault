import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy.exc import InterfaceError, OperationalError

from api.limiter import limiter
from api.routes.auth import router as auth_router
from api.routes.vault import router as vault_router
from api.settings import get_settings

logger = logging.getLogger("cipheria.api")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    from api.cache import cache_ping, get_redis

    if get_redis():
        ok = cache_ping()
        logger.info("Redis cache: %s", "connected" if ok else "ping failed - degraded mode")
    else:
        logger.info("Redis cache: not configured - all requests will hit DB")

    logger.info("CORS allow_origins=%s", settings.allowed_origins)
    yield


app = FastAPI(
    title="Cipheria API",
    description="Secure serverless password manager backend",
    version="1.0.0",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)

# The Vercel Services config mounts this app under /api in production.
# Keep the FastAPI app itself rooted at / so local dev remains simple and
# external routing can add /api without double-prefixing.
app.include_router(auth_router)
app.include_router(vault_router)


@app.exception_handler(OperationalError)
@app.exception_handler(InterfaceError)
async def database_exception_handler(
    request: Request,
    exc: OperationalError | InterfaceError,
):
    logger.error(
        "Database unavailable during %s %s: %s",
        request.method,
        request.url.path,
        exc,
    )
    return JSONResponse(
        status_code=503,
        content={"detail": "Database temporarily unavailable. Please try again."},
    )


@app.get("/health")
async def health():
    from api.cache import cache_ping, get_redis

    redis_ok = cache_ping() if get_redis() else None
    if redis_ok:
        cache_status = "connected"
    elif redis_ok is None:
        cache_status = "disabled"
    else:
        cache_status = "degraded"
    return {"status": "ok", "service": "cipheria-api", "cache": cache_status}
