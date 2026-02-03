"""
Question routes: generate, hint, evaluate, weak-topics.
"""
import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy import select

from db import get_db
import models, schemas
from settings import settings
from core.security import get_current_user
from core.dependencies import ensure_session_owner
from ai import chat_complete, AIError
from prompts import question_prompt, evaluate_prompt, hint_prompt
from services.ai_helpers import (
    normalize_question_for_hash,
    sha256_hex,
    extract_first_json_object,
)
from services.progress import compute_weak_topics_for_session

router = APIRouter(tags=["questions"])


# Routes
@router.post("/question", response_model=schemas.GenerateQuestionOut)
def generate_question(
    payload: schemas.GenerateQuestionIn,
    db: OrmSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    session = db.get(models.Session, payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    ensure_session_owner(session, current_user)

    # Create QA item first
    item = models.QAItem(
        session_id=session.id,
        skill=payload.skill,
        topic=payload.topic,
        question_type=payload.question_type,
        difficulty=payload.difficulty,
        question="",
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    # Ask AI for a question, but avoid repeats within the same session.
    q: str = ""
    q_hash: str | None = None

    # Collect last N non-empty questions for prompting context.
    recent_qs = [it.question for it in session.items if (it.question or "").strip()]
    recent_qs = recent_qs[-10:]

    attempts = 0
    while attempts < 4:
        attempts += 1
        prompt_user = question_prompt(
            session.track,
            session.level,
            payload.skill,
            payload.topic,
            payload.question_type,
            payload.difficulty,
        )
        if recent_qs:
            prompt_user = (
                prompt_user
                + "\n\nAvoid repeating any of these questions (verbatim or near-duplicate):\n"
                + "\n".join(f"- {rq}" for rq in recent_qs)
            )

        try:
            q = chat_complete("You write interview questions only.", prompt_user).strip()
        except AIError as e:
            raise HTTPException(status_code=500, detail=str(e))

        if len(q) < 10:
            continue

        q_hash = sha256_hex(normalize_question_for_hash(q))

        # Hard de-dupe: check DB for same hash in this session.
        existing = db.execute(
            select(models.QAItem.id).where(
                models.QAItem.session_id == session.id,
                models.QAItem.question_hash == q_hash,
            )
        ).first()
        if existing is None:
            break

    if not q or len(q) < 10:
        raise HTTPException(status_code=500, detail="AI returned an invalid question")

    # Persist
    item.question = q
    item.question_hash = q_hash
    item.ai_meta_json = json.dumps(
        {
            "feature": "question",
            "model": getattr(settings, "OPENAI_MODEL", None),
            "prompt_version": "v1",
            "attempts": attempts,
        }
    )

    db.add(item)
    db.commit()

    return {"qa_item_id": item.id, "question": item.question}


@router.post("/hint", response_model=schemas.GetHintOut)
def get_hint(
    payload: schemas.GetHintIn,
    db: OrmSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    item = db.get(models.QAItem, payload.qa_item_id)
    if not item:
        raise HTTPException(status_code=404, detail="QA item not found")
    sess = db.get(models.Session, item.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    ensure_session_owner(sess, current_user)

    # Use provided draft answer if present
    draft = payload.user_answer if payload.user_answer is not None else item.user_answer

    sys = "You provide concise interview hints only."
    user = hint_prompt(
        item.skill,
        item.topic,
        item.question_type,
        item.question,
        draft,
        payload.hint_level,
    )

    try:
        hint = chat_complete(sys, user).strip()
    except AIError as e:
        raise HTTPException(status_code=500, detail=str(e))

    if len(hint) < 3:
        raise HTTPException(status_code=500, detail="AI returned an invalid hint")

    return {"hint": hint}


@router.post("/evaluate", response_model=schemas.EvaluateOut)
def evaluate_answer(
    payload: schemas.EvaluateIn,
    db: OrmSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    item = db.get(models.QAItem, payload.qa_item_id)
    if not item:
        raise HTTPException(status_code=404, detail="QA item not found")
    sess = db.get(models.Session, item.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    ensure_session_owner(sess, current_user)

    item.user_answer = payload.user_answer

    sys = "You are a strict evaluator. Return JSON only."
    user = evaluate_prompt(
        item.skill,
        item.topic,
        item.question_type,
        item.question,
        payload.user_answer,
    )

    try:
        raw = chat_complete(sys, user).strip()
    except AIError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Parse and validate JSON
    try:
        parsed = json.loads(raw)
    except Exception:
        repaired = extract_first_json_object(raw)
        if not repaired:
            raise HTTPException(status_code=500, detail=f"AI did not return valid JSON. Raw: {raw[:500]}")
        try:
            parsed = json.loads(repaired)
        except Exception:
            raise HTTPException(status_code=500, detail=f"AI did not return valid JSON. Raw: {raw[:500]}")

    try:
        evaluation = schemas.EvaluationJson.model_validate(parsed)
    except Exception:
        raise HTTPException(status_code=500, detail=f"AI JSON did not match schema. Raw: {raw[:500]}")

    item.model_answer = evaluation.model_answer
    item.overall = evaluation.overall
    item.scores_json = json.dumps(evaluation.scores.model_dump())
    item.feedback = json.dumps(
        {
            "strengths": evaluation.strengths,
            "gaps": evaluation.gaps,
            "improvements": evaluation.improvements,
            "next_drill_topic": evaluation.next_drill_topic,
        }
    )
    item.ai_meta_json = json.dumps(
        {
            "feature": "evaluate",
            "model": getattr(settings, "OPENAI_MODEL", None),
            "prompt_version": "v1",
        }
    )

    db.add(item)

    # Update aggregated progress (TopicProgress)
    sess = db.get(models.Session, item.session_id)
    if sess is not None and item.overall is not None:
        prog = db.execute(
            select(models.TopicProgress).where(
                models.TopicProgress.session_id == item.session_id,
                models.TopicProgress.skill == item.skill,
                models.TopicProgress.topic == item.topic,
            )
        ).scalar_one_or_none()

        if prog is None:
            prog = models.TopicProgress(
                session_id=item.session_id,
                track=sess.track,
                skill=item.skill,
                topic=item.topic,
                attempts=0,
                avg_overall=None,
                last_seen_at=None,
            )
            db.add(prog)
            db.flush()

        prev_attempts = int(prog.attempts or 0)
        prev_avg = float(prog.avg_overall) if prog.avg_overall is not None else None
        new_attempts = prev_attempts + 1
        if prev_avg is None:
            new_avg = float(item.overall)
        else:
            new_avg = (prev_avg * prev_attempts + float(item.overall)) / new_attempts

        prog.attempts = new_attempts
        prog.avg_overall = new_avg
        prog.last_seen_at = datetime.now(timezone.utc)

    db.commit()

    return {"overall": item.overall, "evaluation": evaluation}


@router.get("/weak-topics/{session_id}", response_model=list[schemas.WeakTopicOut])
def weak_topics(
    session_id: int,
    db: OrmSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    s = db.get(models.Session, session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    ensure_session_owner(s, current_user)

    rows = compute_weak_topics_for_session(s, db, limit=5)

    out: list[dict[str, Any]] = []
    for r in rows:
        out.append(
            {
                "topic": r["topic"],
                "avg_overall": float(r["avg_overall"]),
                "attempts": int(r["attempts"]),
            }
        )
    return out
