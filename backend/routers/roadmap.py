import json
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy import select
import models, schemas
from db import get_db
from fastapi import APIRouter, Depends, HTTPException
from routers.auth import get_current_user  # your JWT dependency
from ai import chat_complete  # your existing function
import urllib.parse

def youtube_search_link(query: str) -> str:
    q = urllib.parse.quote_plus(query.strip())
    return f"https://www.youtube.com/results?search_query={q}"

def _user_profile_snapshot(u):
    return {
        "id": u.id,
        "email": getattr(u, "email", None),
        "domain": getattr(u, "domain", None),
        "role": getattr(u, "role", None),
        "track": getattr(u, "track", None),
        "level": getattr(u, "level", None),
    }
router = APIRouter(prefix="/roadmap", tags=["interview"])


@router.post("/generate", response_model=schemas.RoadmapGenerateOut)
def roadmap_generate(
    payload: schemas.RoadmapGenerateIn,
    db: OrmSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # 1) choose context: session OR profile
    session = None
    if payload.session_id is not None:
        session = db.get(models.Session, payload.session_id)
        if not session or session.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Session not found")

    profile = _user_profile_snapshot(current_user)

    # 2) build prompt (JSON only)
    sys = (
        "You are an interview coach. Create a concise 2-week roadmap.\n"
        "Return STRICT JSON only. No markdown.\n"
        "Schema:\n"
        "{\n"
        '  "title": string,\n'
        '  "duration_days": number,\n'
        '  "two_week_plan": string,\n'
        '  "micro_tasks": [\n'
        "    {\n"
        '      "topic": string,\n'
        '      "drill_prompt": string,\n'
        '      "resources": string[],\n'
        '      "expected_output": string\n'
        "    }\n"
        "  ]\n"
        "}\n"
        "Rules:\n"
        "- resources MUST include YouTube search links (youtube.com/results?search_query=...)\n"
        "- If Backend: focus SQL, DSA, System Design.\n"
        "- If Frontend: focus React, Next.js, TypeScript, Web performance, Testing.\n"
        "- If FullStack: include both.\n"
    )

    ctx = {
        "profile": profile,
        "session": {
            "id": session.id if session else None,
            "mode": getattr(session, "mode", None) if session else None,
            "track": getattr(session, "track", None) if session else None,
            "level": getattr(session, "level", None) if session else None,
        },
        "duration_days": payload.duration_days,
    }

    raw = chat_complete(sys, "Context:\n" + json.dumps(ctx, ensure_ascii=False))

    # 3) parse JSON
    try:
        data = json.loads(raw)
    except Exception:
        raise HTTPException(status_code=500, detail="AI returned invalid JSON for roadmap")

    micro = data.get("micro_tasks") or []
    # enforce at least 1 youtube search link per task
    for t in micro:
        if not isinstance(t.get("resources"), list):
            t["resources"] = []
        if not any("youtube.com/results?search_query=" in r for r in t["resources"]):
            t["resources"].append(youtube_search_link(t.get("topic", "interview preparation")))

    plan_json = {
        "two_week_plan": data.get("two_week_plan", ""),
        "micro_tasks": micro,
    }

    # 4) save to DB (create new each time)
    row = models.Roadmap(
        user_id=current_user.id,
        session_id=session.id if session else None,
        title=data.get("title") or "2-week roadmap",
        duration_days=int(data.get("duration_days") or payload.duration_days),
        plan_json=plan_json,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    out = schemas.RoadmapOut(
        id=row.id,
        user_id=row.user_id,
        session_id=row.session_id,
        title=row.title,
        duration_days=row.duration_days,
        plan=schemas.RoadmapPlan(**row.plan_json),
        created_at=getattr(row, "created_at", None),
        updated_at=getattr(row, "updated_at", None),
    )
    return {"roadmap": out}

@router.get("/{user_id}", response_model=schemas.RoadmapOut)
def roadmap_get(
    user_id: int,
    db: OrmSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    q = (
        select(models.Roadmap)
        .where(models.Roadmap.user_id == user_id)
        .order_by(models.Roadmap.id.desc())
        .limit(1)
    )
    row = db.execute(q).scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="No roadmap found")

    return schemas.RoadmapOut(
        id=row.id,
        user_id=row.user_id,
        session_id=row.session_id,
        title=row.title,
        duration_days=row.duration_days,
        plan=schemas.RoadmapPlan(**row.plan_json),
        created_at=getattr(row, "created_at", None),
        updated_at=getattr(row, "updated_at", None),
    )