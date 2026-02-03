"""
Common dependencies and utility functions for route handlers.
"""
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy import select

import models
from db import get_db
from core.config import OWNER_ID_FIELDS

# Re-export get_db for convenience
__all__ = ["get_db", "set_owner_id", "get_owner_id", "ensure_session_owner", 
           "session_owner_filter_for_user", "get_latest_session_for_user"]


def set_owner_id(obj: Any, user_id: int) -> None:
    """Set an owning user id on a mapped SQLAlchemy model if it has a suitable column."""
    mapper = getattr(obj.__class__, "__mapper__", None)
    if mapper is None:
        return
    keys = set(mapper.attrs.keys())
    for field in OWNER_ID_FIELDS:
        if field in keys:
            setattr(obj, field, user_id)
            return


def get_owner_id(obj: Any) -> int | None:
    """Get an owning user id from a mapped SQLAlchemy model if it has a suitable column."""
    mapper = getattr(obj.__class__, "__mapper__", None)
    if mapper is None:
        return None
    keys = set(mapper.attrs.keys())
    for field in OWNER_ID_FIELDS:
        if field in keys:
            val = getattr(obj, field, None)
            try:
                return int(val) if val is not None else None
            except Exception:
                return None
    return None


def ensure_session_owner(s: Any, current_user: models.User) -> None:
    """Raise 404 if the session exists but is not owned by the current user (prevents leaking IDs)."""
    owner_id = get_owner_id(s)
    # If the DB schema doesn't have an owner column, don't enforce.
    if owner_id is None:
        return
    if owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")


def session_owner_filter_for_user(current_user: models.User):
    """Return a SQLAlchemy filter for Session ownership, or None if Session has no owner column."""
    try:
        keys = set(models.Session.__mapper__.attrs.keys())
    except Exception:
        return None

    for field in OWNER_ID_FIELDS:
        if field in keys:
            return getattr(models.Session, field) == current_user.id
    return None


def get_latest_session_for_user(db: OrmSession, current_user: models.User) -> models.Session | None:
    """Get the most recent session for a user."""
    filt = session_owner_filter_for_user(current_user)
    q = select(models.Session)
    if filt is not None:
        q = q.where(filt)

    # Prefer updated_at/created_at if present, else id desc
    try:
        skeys = set(models.Session.__mapper__.attrs.keys())
    except Exception:
        skeys = set()

    if "updated_at" in skeys:
        q = q.order_by(getattr(models.Session, "updated_at").desc())
    elif "created_at" in skeys:
        q = q.order_by(getattr(models.Session, "created_at").desc())
    else:
        q = q.order_by(models.Session.id.desc())

    return db.execute(q).scalars().first()
