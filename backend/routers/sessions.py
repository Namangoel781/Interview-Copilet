"""
Session routes: create, get, list sessions.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy import select

from db import get_db
import models, schemas
from core.security import get_current_user
from core.dependencies import (
    set_owner_id,
    ensure_session_owner,
    session_owner_filter_for_user,
    get_latest_session_for_user,
)

router = APIRouter(tags=["sessions"])


# Schemas
class SessionSummaryOut(BaseModel):
    id: int
    mode: str
    track: str
    level: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ActiveSessionOut(BaseModel):
    session_id: int


# Routes
@router.post("/session", response_model=schemas.CreateSessionOut)
def create_session(
    payload: schemas.CreateSessionIn,
    db: OrmSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    s = models.Session(mode=payload.mode, track=payload.track, level=payload.level)
    set_owner_id(s, current_user.id)
    db.add(s)
    db.commit()
    db.refresh(s)
    return {"session_id": s.id}


@router.get("/session/{session_id}", response_model=schemas.SessionOut)
def get_session(
    session_id: int,
    db: OrmSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    s = db.get(models.Session, session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    ensure_session_owner(s, current_user)

    items = []
    for it in s.items:
        items.append(
            {
                "id": it.id,
                "skill": it.skill,
                "topic": it.topic,
                "question_type": it.question_type,
                "difficulty": it.difficulty,
                "question": it.question,
                "user_answer": it.user_answer,
                "overall": it.overall,
            }
        )

    return {"id": s.id, "mode": s.mode, "track": s.track, "level": s.level, "items": items}


@router.get("/sessions", response_model=list[SessionSummaryOut])
def list_sessions(
    db: OrmSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    filt = session_owner_filter_for_user(current_user)
    q = select(models.Session)
    if filt is not None:
        q = q.where(filt)

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

    rows = db.execute(q).scalars().all()
    return [
        {
            "id": s.id,
            "mode": s.mode,
            "track": s.track,
            "level": s.level,
            "created_at": getattr(s, "created_at", None),
            "updated_at": getattr(s, "updated_at", None),
        }
        for s in rows
    ]


@router.get("/sessions/active", response_model=ActiveSessionOut)
def get_active_session(
    db: OrmSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    s = get_latest_session_for_user(db, current_user)
    if not s:
        raise HTTPException(status_code=404, detail="No sessions found")
    return {"session_id": s.id}
