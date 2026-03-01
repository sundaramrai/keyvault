from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError
import uuid

from database import get_db, User
from crypto import decode_token

security = HTTPBearer()


class TokenUser:
    """Lightweight user derived from JWT only — no DB round-trip."""
    __slots__ = ("id",)

    def __init__(self, user_id: str):
        self.id = uuid.UUID(user_id)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> TokenUser:
    """Validate JWT and return a TokenUser — zero DB queries."""
    error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(credentials.credentials)
        user_id: str = payload.get("sub")
        if not user_id or payload.get("type") != "access":
            raise error
    except JWTError:
        raise error
    return TokenUser(user_id)


def get_current_user_from_db(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """Full DB lookup — use only when the complete User row is needed (e.g. /me)."""
    token_user = get_current_user(credentials)
    user = db.query(User).filter(User.id == token_user.id).first()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
