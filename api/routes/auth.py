"""
routes/auth.py — Auth routes with Redis cache integration.

Cache optimisations applied:
  1. vault_salt cached after login/register → vault unlock never hits DB
  2. User profile cached after login → /me endpoint is a pure Redis read
  3. Refresh token fast-path → valid tokens checked in Redis before DB
  4. Token revocation → written to Redis blacklist instantly (zero-DB revocation)
  5. Full cache purge on logout → stale data can never outlive session

Vault lock / re-unlock flow (no API call needed on unlock):
  - On login  → vault_salt is primed into Redis (TTL 60 min)
  - On unlock → frontend calls GET /auth/vault-salt  → Redis HIT → ~2 ms
  - On lock   → no server call needed at all (frontend discards derived key)
  - On re-unlock → same GET /auth/vault-salt from Redis → ~2 ms
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Response, Cookie
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from jose import JWTError
from typing import Annotated, Optional
import logging

from database import get_db, User, AuditLog, RefreshToken
from crypto import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_refresh_token,
    generate_salt,
    REFRESH_TOKEN_EXPIRE_DAYS,
)
from schemas import RegisterRequest, LoginRequest, TokenResponse, UserResponse
from deps import get_current_user_from_db
from cache import (
    get_cached_user,
    set_cached_user,
    invalidate_user,
    get_cached_vault_salt,
    set_cached_vault_salt,
    get_cached_refresh_token,
    cache_refresh_token_valid,
    revoke_refresh_token_cache,
    is_token_blacklisted,
    invalidate_all_vault,
    prime_vault_salt,
)

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from limiter import limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

IS_PROD = os.getenv("ENVIRONMENT", "production") == "production"

# Refresh token TTL in seconds (used for Redis TTL alignment)
_RT_TTL_SECONDS = REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600


# Cookie helper


def _set_refresh_cookie(response: Response, token: str) -> None:
    """Store refresh token in an HttpOnly cookie — never exposed to JS."""
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        secure=IS_PROD,
        samesite=(
            "none" if IS_PROD else "lax"
        ),  # none required for cross-origin (Vercel ↔ Azure)
        max_age=_RT_TTL_SECONDS,
        path="/api/auth",
    )


# Audit log helper


def log_action(db: Session, user_id, action: str, request: Request) -> None:
    db.add(
        AuditLog(
            user_id=user_id,
            action=action,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )


# Cache warm helper


def _warm_caches(user: User, refresh_token: str, token_hash: str) -> None:
    """
    Prime all relevant caches immediately after login/register/refresh.
    Called inside the request that just authenticated so subsequent requests
    (vault list, /me, vault unlock) are served from Redis.
    """
    user_id = str(user.id)

    # 1. User profile (for /me)
    set_cached_user(
        user_id,
        {
            "id": user_id,
            "email": user.email,
            "full_name": user.full_name,
            "vault_salt": user.vault_salt,
            "master_hint": user.master_hint,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "is_active": user.is_active,
        },
    )

    # 2. Vault salt (for unlock fast-path)
    prime_vault_salt(user_id, user.vault_salt)

    # 3. Refresh token validity (for /refresh fast-path)
    cache_refresh_token_valid(token_hash, user_id, _RT_TTL_SECONDS)


# Register


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=201,
    responses={400: {"description": "Email already registered"}},
)
@limiter.limit("5/minute")
def register(
    body: RegisterRequest,
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        master_hint=body.master_hint,
        vault_salt=generate_salt(32),
    )
    db.add(user)
    db.flush()

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    token_hash = hash_refresh_token(refresh_token)

    rt = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(rt)
    log_action(db, user.id, "REGISTER", request)
    db.commit()

    _warm_caches(user, refresh_token, token_hash)
    _set_refresh_cookie(response, refresh_token)

    return TokenResponse(access_token=access_token, vault_salt=user.vault_salt)


# Login


@router.post(
    "/login",
    response_model=TokenResponse,
    responses={401: {"description": "Invalid email or password"}},
)
@limiter.limit("10/minute")
def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
):
    # Always hit DB for login — we MUST verify the bcrypt hash.
    # (We cannot cache credentials — that would be a security hole.)
    user = db.query(User).filter(User.email == body.email).first()

    if (
        not user
        or not user.is_active
        or not verify_password(body.password, user.hashed_password)
    ):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    token_hash = hash_refresh_token(refresh_token)

    rt = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(rt)
    log_action(db, user.id, "LOGIN", request)
    db.commit()

    # Warm all caches after successful login
    _warm_caches(user, refresh_token, token_hash)
    _set_refresh_cookie(response, refresh_token)

    logger.info(f"LOGIN user={user.id}")
    return TokenResponse(access_token=access_token, vault_salt=user.vault_salt)


# Refresh


@router.post(
    "/refresh",
    response_model=TokenResponse,
    responses={401: {"description": "Invalid or expired refresh token"}},
)
@limiter.limit("20/minute")
def refresh(
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    refresh_token: Annotated[Optional[str], Cookie()] = None,
):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")

    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = payload.get("sub")
        jti = payload.get("jti", "")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    # Fast revocation check via Redis blacklist (no DB needed)
    if is_token_blacklisted(jti):
        raise HTTPException(status_code=401, detail="Refresh token revoked")

    token_hash = hash_refresh_token(refresh_token)

    # ── Redis fast-path: token already validated in cache ──
    cached_rt = get_cached_refresh_token(token_hash)

    if cached_rt:
        logger.debug(f"refresh token cache HIT  user={user_id}")
        # Still need to rotate the token in DB (security: single-use refresh tokens)
        stored = (
            db.query(RefreshToken)
            .filter(
                RefreshToken.token_hash == token_hash,
                RefreshToken.revoked == False,
                RefreshToken.expires_at > datetime.now(timezone.utc),
            )
            .first()
        )
        if not stored:
            # Cache said valid but DB says revoked — honour DB (race condition guard)
            revoke_refresh_token_cache(token_hash, jti, _RT_TTL_SECONDS)
            raise HTTPException(
                status_code=401, detail="Refresh token expired or revoked"
            )
    else:
        logger.debug(f"refresh token cache MISS user={user_id}")
        stored = (
            db.query(RefreshToken)
            .filter(
                RefreshToken.token_hash == token_hash,
                RefreshToken.revoked == False,
                RefreshToken.expires_at > datetime.now(timezone.utc),
            )
            .first()
        )
        if not stored:
            raise HTTPException(
                status_code=401, detail="Refresh token expired or revoked"
            )

    # Rotate: revoke old token, issue new one
    stored.revoked = True
    revoke_refresh_token_cache(token_hash, jti, _RT_TTL_SECONDS)

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Account not found or disabled")

    new_access = create_access_token({"sub": user_id})
    new_refresh = create_refresh_token({"sub": user_id})
    new_hash = hash_refresh_token(new_refresh)

    new_rt = RefreshToken(
        user_id=user_id,
        token_hash=new_hash,
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(new_rt)
    db.commit()

    _warm_caches(user, new_refresh, new_hash)
    _set_refresh_cookie(response, new_refresh)

    return TokenResponse(access_token=new_access, vault_salt=user.vault_salt)


# Logout


@router.post("/logout")
def logout(
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    refresh_token: Annotated[Optional[str], Cookie()] = None,
):
    if refresh_token:
        try:
            payload = decode_token(refresh_token)
            jti = payload.get("jti", "")
            user_id = payload.get("sub", "")
            token_hash = hash_refresh_token(refresh_token)

            # Revoke in DB
            stored = (
                db.query(RefreshToken)
                .filter(RefreshToken.token_hash == token_hash)
                .first()
            )
            if stored:
                stored.revoked = True
                db.commit()

            # Evict from all caches — vault + user profile + salt
            revoke_refresh_token_cache(token_hash, jti, _RT_TTL_SECONDS)
            invalidate_user(user_id)
            invalidate_all_vault(user_id)
            logger.info(f"LOGOUT user={user_id} — all caches purged")
        except Exception:
            pass  # malformed token — still clear the cookie

    response.delete_cookie(
        key="refresh_token",
        path="/api/auth",
        httponly=True,
        secure=IS_PROD,
        samesite="none" if IS_PROD else "lax",
    )
    return {"message": "Logged out"}


# /me — served from cache


@router.get("/me", response_model=UserResponse)
def me(current_user: Annotated[User, Depends(get_current_user_from_db)]):
    """
    Profile endpoint. get_current_user_from_db already uses cache internally
    (see deps.py). We just return the ORM object here — FastAPI serialises it.
    """
    return current_user


# Vault salt fast-path (for vault unlock without master password re-entry)


@router.get(
    "/vault-salt",
    summary="Return vault salt for key re-derivation (vault unlock)",
    response_model=dict,
)
def get_vault_salt(
    current_user: Annotated[User, Depends(get_current_user_from_db)],
):
    """
    Called by the frontend when the user re-enters their master password
    to unlock a locked vault. Returns only the salt — no DB query if cached.

    Security: salt is not a secret (PBKDF2 design). The actual vault key
    is derived client-side and never sent to the server.
    """
    user_id = str(current_user.id)

    # Try cache first
    cached_salt = get_cached_vault_salt(user_id)
    if cached_salt:
        logger.debug(f"vault_salt cache HIT  user={user_id}")
        return {"vault_salt": cached_salt}

    # Cache miss → use DB value already loaded by get_current_user_from_db
    logger.debug(f"vault_salt cache MISS user={user_id}")
    salt = current_user.vault_salt
    set_cached_vault_salt(user_id, salt)
    return {"vault_salt": salt}
