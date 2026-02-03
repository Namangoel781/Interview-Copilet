"""
Dashboard routes: user dashboard with stats and progress.
"""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session as OrmSession

from db import get_db
import models
from core.security import get_current_user
from core.dependencies import get_latest_session_for_user
from services.progress import build_dashboard_payload

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


# Schemas
class DashboardOut(BaseModel):
    session_id: int
    mode: str
    track: str
    level: str
    totals: dict[str, Any] = Field(default_factory=dict)
    recent: list[dict[str, Any]] = Field(default_factory=list)
    weak_topics: list[dict[str, Any]] = Field(default_factory=list)
    by_skill: list[dict[str, Any]] = Field(default_factory=list)


# Routes
@router.get("/me", response_model=DashboardOut)
def dashboard_me(
    db: OrmSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    s = get_latest_session_for_user(db, current_user)
    if not s:
        raise HTTPException(status_code=404, detail="No sessions found")
    return build_dashboard_payload(s, db)
