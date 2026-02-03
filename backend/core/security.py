"""
Security utilities: password hashing, JWT token handling, and user authentication.
"""
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from jose import jwt, JWTError
from sqlalchemy.orm import Session as OrmSession

from db import get_db
import models
from core.config import (
    JWT_SECRET,
    JWT_ALG,
    JWT_EXPIRE_MINUTES,
    PASSWORD_HASH_FIELDS,
)

# Use pbkdf2_sha256 to avoid bcrypt backend/version issues and bcrypt's 72-byte password limit.
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def hash_password(password: str) -> str:
    """Hash a password using pbkdf2_sha256."""
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against a hash."""
    try:
        return pwd_context.verify(password, password_hash)
    except Exception:
        return False


def create_access_token(user_id: int) -> str:
    """Create a JWT access token for a user."""
    now = datetime.now(timezone.utc)
    exp = now.timestamp() + (JWT_EXPIRE_MINUTES * 60)
    payload = {"sub": str(user_id), "iat": int(now.timestamp()), "exp": int(exp)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def _set_user_password_hash(user: models.User, value: str) -> None:
    """Set the password hash on the User using whichever mapped column exists.

    Supports common field names via `PASSWORD_HASH_FIELDS`, and falls back to heuristics
    (e.g. columns containing 'password' + 'hash'/'digest').
    """
    mapper_keys = set(getattr(user.__class__, "__mapper__").attrs.keys())

    # 1) Explicit allowlist
    for field in PASSWORD_HASH_FIELDS:
        if field in mapper_keys:
            setattr(user, field, value)
            return

    # 2) Heuristic: password + hash/digest/etc.
    lower_map = {k: k.lower() for k in mapper_keys}
    candidates = [
        k
        for k, kl in lower_map.items()
        if ("password" in kl or kl in {"pass", "passwd", "pwd"}) and any(x in kl for x in ("hash", "digest", "crypted", "salt"))
    ]
    if len(candidates) == 1:
        setattr(user, candidates[0], value)
        return

    # 3) Heuristic: any single password-ish field
    if not candidates:
        candidates = [k for k, kl in lower_map.items() if "password" in kl or kl in {"pass", "passwd", "pwd"}]
        if len(candidates) == 1:
            setattr(user, candidates[0], value)
            return

    raise RuntimeError(
        "User model has no obvious password hash field. "
        "Tried: " + ", ".join(PASSWORD_HASH_FIELDS)
        + ". Heuristic candidates: " + (", ".join(candidates) if candidates else "<none>")
        + ". Available mapped fields: " + ", ".join(sorted(mapper_keys))
    )


def _get_user_password_hash(user: models.User) -> str | None:
    """Get the stored password hash from the User using whichever mapped column exists."""
    mapper_keys = set(getattr(user.__class__, "__mapper__").attrs.keys())

    # 1) Explicit allowlist
    for field in PASSWORD_HASH_FIELDS:
        if field in mapper_keys:
            val = getattr(user, field, None)
            return str(val) if val else None

    # 2) Heuristic: password + hash/digest/etc.
    lower_map = {k: k.lower() for k in mapper_keys}
    candidates = [
        k
        for k, kl in lower_map.items()
        if ("password" in kl or kl in {"pass", "passwd", "pwd"}) and any(x in kl for x in ("hash", "digest", "crypted", "salt"))
    ]
    if len(candidates) == 1:
        val = getattr(user, candidates[0], None)
        return str(val) if val else None

    # 3) Heuristic: any single password-ish field
    if not candidates:
        candidates = [k for k, kl in lower_map.items() if "password" in kl or kl in {"pass", "passwd", "pwd"}]
        if len(candidates) == 1:
            val = getattr(user, candidates[0], None)
            return str(val) if val else None

    return None


def get_current_user(db: OrmSession = Depends(get_db), token: str = Depends(oauth2_scheme)) -> models.User:
    """Dependency to get the current authenticated user from JWT token."""
    credentials_exception = HTTPException(status_code=401, detail="Invalid or expired token")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        sub = payload.get("sub")
        if not sub:
            raise credentials_exception
        user_id = int(sub)
    except Exception:
        raise credentials_exception

    user = db.get(models.User, user_id)
    if not user:
        raise credentials_exception
    return user
