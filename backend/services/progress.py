"""
Progress computation utilities for dashboard and weak topics.
"""
from typing import Any
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy import select

import models


def compute_weak_topics_for_session(s: models.Session, db: OrmSession, limit: int = 5) -> list[dict[str, Any]]:
    """Compute weak topics for a session.
    Uses TopicProgress if present; otherwise falls back to answered QA items.
    """
    prows = db.execute(
        select(models.TopicProgress)
        .where(models.TopicProgress.session_id == s.id)
        .order_by(
            models.TopicProgress.avg_overall.is_(None).asc(),
            models.TopicProgress.avg_overall.asc(),
            models.TopicProgress.attempts.desc(),
        )
    ).scalars().all()

    if prows:
        rows: list[dict[str, Any]] = []
        for p in prows:
            if p.avg_overall is None:
                continue
            rows.append(
                {
                    "topic": p.topic,
                    "avg_overall": float(p.avg_overall),
                    "attempts": int(p.attempts or 0),
                    "skill": getattr(p, "skill", None),
                }
            )
        rows.sort(key=lambda x: x["avg_overall"])
        return rows[:limit]

    # fallback: compute from answered QA items
    topic_map: dict[str, list[float]] = {}
    topic_skill: dict[str, str] = {}
    for it in getattr(s, "items", []) or []:
        if it.overall is None:
            continue
        topic_map.setdefault(it.topic, []).append(float(it.overall))
        topic_skill.setdefault(it.topic, it.skill)

    rows = []
    for topic, vals in topic_map.items():
        rows.append(
            {
                "topic": topic,
                "avg_overall": sum(vals) / len(vals),
                "attempts": len(vals),
                "skill": topic_skill.get(topic),
            }
        )
    rows.sort(key=lambda x: x["avg_overall"])
    return rows[:limit]


def compute_skill_breakdown(s: models.Session) -> list[dict[str, Any]]:
    """Compute skill-level breakdown for a session."""
    answered = [it for it in (getattr(s, "items", []) or []) if it.overall is not None]
    skill_map: dict[str, list[float]] = {}
    for it in answered:
        skill_map.setdefault(it.skill, []).append(float(it.overall))

    by_skill: list[dict[str, Any]] = []
    for sk, vals in skill_map.items():
        by_skill.append({"skill": sk, "avg_overall": sum(vals) / len(vals), "attempts": len(vals)})
    by_skill.sort(key=lambda x: x["avg_overall"])
    return by_skill


def build_dashboard_payload(s: models.Session, db: OrmSession) -> dict[str, Any]:
    """Build the dashboard response payload for a session."""
    items = list(getattr(s, "items", []) or [])
    items.sort(key=lambda it: it.id, reverse=True)

    recent = [
        {
            "id": it.id,
            "skill": it.skill,
            "topic": it.topic,
            "question_type": it.question_type,
            "difficulty": it.difficulty,
            "overall": it.overall,
            "question": (it.question[:220] + "…") if it.question and len(it.question) > 220 else (it.question or ""),
        }
        for it in items[:20]
    ]

    answered = [it for it in items if it.overall is not None]
    total_answered = len(answered)
    avg_overall = float(sum(float(it.overall) for it in answered) / total_answered) if total_answered else None

    totals = {
        "questions_total": len(items),
        "answered": total_answered,
        "avg_overall": avg_overall,
    }

    weak = [
        {"topic": r["topic"], "avg_overall": float(r["avg_overall"]), "attempts": int(r["attempts"])}
        for r in compute_weak_topics_for_session(s, db, limit=5)
    ]

    by_skill = compute_skill_breakdown(s)

    return {
        "session_id": s.id,
        "mode": s.mode,
        "track": s.track,
        "level": s.level,
        "totals": totals,
        "recent": recent,
        "weak_topics": weak,
        "by_skill": by_skill,
    }
