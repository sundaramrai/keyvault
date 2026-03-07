"""
cache.py — Redis caching layer for Cipheria API.

Cache strategy per resource:
  - user profile      → key: user:{id}           TTL: 15 min   (invalidated on /me, logout)
  - vault list        → key: vault:list:{user_id}:{params_hash}  TTL: 5 min
  - vault item        → key: vault:item:{user_id}:{item_id}      TTL: 10 min
  - refresh token     → key: rt:valid:{token_hash}               TTL: until token expiry
  - token revocation  → key: rt:revoked:{jti}                    TTL: until token expiry
  - vault salt        → key: vault_salt:{user_id}                TTL: 60 min

Security notes:
  - Vault data cached server-side is ALREADY encrypted (AES-256-GCM client-side).
    Redis only ever holds the ciphertext — same as the DB.
  - User profile cache never includes hashed_password.
  - On logout / password change → all user cache keys are purged immediately.
  - TTLs are kept short so stale data windows are minimal.
"""

import os
import json
import hashlib
import logging
from typing import Optional, Any
from datetime import timedelta

import redis

logger = logging.getLogger(__name__)

# TTLs (seconds)
TTL_USER_PROFILE = 15 * 60  # 15 min
TTL_VAULT_LIST = 5 * 60  # 5 min
TTL_VAULT_ITEM = 10 * 60  # 10 min
TTL_VAULT_SALT = 60 * 60  # 60 min
TTL_RT_VALID = 30 * 24 * 3600  # 30 days (matches refresh token lifetime)
TTL_TOKEN_BLACKLIST = 31 * 24 * 3600  # 31 days safety margin


# Connection


def _build_redis_client() -> Optional[redis.Redis]:
    url = os.getenv("REDIS_URL")
    if not url:
        logger.warning(
            "REDIS_URL not set — caching disabled, falling back to DB for every request."
        )
        return None
    try:
        client = redis.from_url(
            url,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
            retry_on_timeout=True,
            health_check_interval=30,
        )
        client.ping()
        logger.info("Redis connected ✓")
        return client
    except Exception as e:
        logger.error(f"Redis connection failed: {e} — caching disabled.")
        return None


_redis: Optional[redis.Redis] = _build_redis_client()


def get_redis() -> Optional[redis.Redis]:
    """Return the Redis client, or None if unavailable (graceful degradation)."""
    return _redis


# Low-level helpers


def _get(key: str) -> Optional[Any]:
    if _redis is None:
        return None
    try:
        raw = _redis.get(key)
        return json.loads(raw) if raw else None
    except Exception as e:
        logger.warning(f"Cache GET error [{key}]: {e}")
        return None


def _set(key: str, value: Any, ttl: int) -> None:
    if _redis is None:
        return
    try:
        _redis.setex(key, ttl, json.dumps(value, default=str))
    except Exception as e:
        logger.warning(f"Cache SET error [{key}]: {e}")


def _delete(*keys: str) -> None:
    if _redis is None:
        return
    try:
        _redis.delete(*keys)
    except Exception as e:
        logger.warning(f"Cache DELETE error {keys}: {e}")


def _delete_pattern(pattern: str) -> None:
    """Delete all keys matching a glob pattern (use sparingly — O(N) scan)."""
    if _redis is None:
        return
    try:
        cursor = 0
        while True:
            cursor, keys = _redis.scan(cursor, match=pattern, count=200)
            if keys:
                _redis.delete(*keys)
            if cursor == 0:
                break
    except Exception as e:
        logger.warning(f"Cache DELETE pattern error [{pattern}]: {e}")


# Key builders


def _vault_list_key(
    user_id: str,
    category: Optional[str],
    search: Optional[str],
    favourites_only: bool,
    page: int,
    page_size: int,
) -> str:
    params = f"{category}:{search}:{favourites_only}:{page}:{page_size}"
    params_hash = hashlib.md5(params.encode()).hexdigest()[:12]
    return f"vault:list:{user_id}:{params_hash}"


# User profile cache


def get_cached_user(user_id: str) -> Optional[dict]:
    """Return cached user profile dict (no hashed_password)."""
    return _get(f"user:{user_id}")


def set_cached_user(user_id: str, user_dict: dict) -> None:
    """Cache user profile. Strip sensitive fields before storing."""
    safe = {k: v for k, v in user_dict.items() if k != "hashed_password"}
    _set(f"user:{user_id}", safe, TTL_USER_PROFILE)


def invalidate_user(user_id: str) -> None:
    """Purge user profile + vault salt cache on logout or account change."""
    _delete(f"user:{user_id}", f"vault_salt:{user_id}")


# Vault salt cache
# vault_salt is returned on every login/refresh — cache it to avoid a DB hit.


def get_cached_vault_salt(user_id: str) -> Optional[str]:
    data = _get(f"vault_salt:{user_id}")
    return data.get("salt") if data else None


def set_cached_vault_salt(user_id: str, salt: str) -> None:
    _set(f"vault_salt:{user_id}", {"salt": salt}, TTL_VAULT_SALT)


# Vault list cache


def get_cached_vault_list(
    user_id: str,
    category: Optional[str],
    search: Optional[str],
    favourites_only: bool,
    page: int,
    page_size: int,
) -> Optional[dict]:
    key = _vault_list_key(user_id, category, search, favourites_only, page, page_size)
    return _get(key)


def set_cached_vault_list(
    user_id: str,
    category: Optional[str],
    search: Optional[str],
    favourites_only: bool,
    page: int,
    page_size: int,
    data: dict,
) -> None:
    key = _vault_list_key(user_id, category, search, favourites_only, page, page_size)
    _set(key, data, TTL_VAULT_LIST)


def invalidate_vault_list(user_id: str) -> None:
    """Bust all paginated list variants for a user when vault is mutated."""
    _delete_pattern(f"vault:list:{user_id}:*")


# Vault item cache


def get_cached_vault_item(user_id: str, item_id: str) -> Optional[dict]:
    return _get(f"vault:item:{user_id}:{item_id}")


def set_cached_vault_item(user_id: str, item_id: str, data: dict) -> None:
    _set(f"vault:item:{user_id}:{item_id}", data, TTL_VAULT_ITEM)


def invalidate_vault_item(user_id: str, item_id: str) -> None:
    _delete(f"vault:item:{user_id}:{item_id}")


def invalidate_all_vault(user_id: str) -> None:
    """Full vault cache purge — used on logout or bulk operations."""
    _delete_pattern(f"vault:list:{user_id}:*")
    _delete_pattern(f"vault:item:{user_id}:*")


# Refresh token fast-path
# We cache "is this token valid" so the /refresh endpoint avoids a DB lookup
# on the hot path. A revoked JTI is written to the blacklist immediately.


def cache_refresh_token_valid(token_hash: str, user_id: str, ttl_seconds: int) -> None:
    """Mark a refresh token hash as valid in cache."""
    _set(f"rt:valid:{token_hash}", {"user_id": user_id}, ttl_seconds)


def get_cached_refresh_token(token_hash: str) -> Optional[dict]:
    return _get(f"rt:valid:{token_hash}")


def revoke_refresh_token_cache(token_hash: str, jti: str, ttl_seconds: int) -> None:
    """Remove valid entry + write to blacklist so revocation is instant."""
    _delete(f"rt:valid:{token_hash}")
    _set(f"rt:revoked:{jti}", {"revoked": True}, ttl_seconds)


def is_token_blacklisted(jti: str) -> bool:
    """Check blacklist — short-circuits before any DB query."""
    if _redis is None:
        return False
    return _get(f"rt:revoked:{jti}") is not None


# Vault lock / re-auth fast path
# When the user locks their vault and re-enters their master password,
# the frontend only needs the vault_salt to re-derive the key client-side.
# We cache this so no DB roundtrip is needed on vault unlock.
# The salt is NOT secret (it's public per PBKDF2 design) but we still
# scope it per-user and keep TTL short.


def get_vault_salt_for_unlock(user_id: str) -> Optional[str]:
    """Fast path for vault unlock — returns salt without hitting DB."""
    return get_cached_vault_salt(user_id)


def prime_vault_salt(user_id: str, salt: str) -> None:
    """Called after login/register to warm the salt cache immediately."""
    set_cached_vault_salt(user_id, salt)


# Cache health


def cache_ping() -> bool:
    if _redis is None:
        return False
    try:
        return _redis.ping()
    except Exception:
        return False
