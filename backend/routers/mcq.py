"""
MCQ routes: generate, submit, report.
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
from services.ai_helpers import extract_first_json_array, sha256_hex, normalize_question_for_hash

router = APIRouter(prefix="/mcq", tags=["mcq"])


def _mcq_generate_prompt(track: str, level: str, skill: str, topic: str, difficulty: int, n: int) -> str:
    """Ask the model to generate N MCQs in strict JSON."""
    return f"""
You are an interview question generator.

Generate {n} multiple-choice questions (MCQs) for:
- Track: {track}
- Level: {level}
- Skill: {skill}
- Topic: {topic}
- Difficulty: {difficulty} (1=easy, 2=medium, 3=hard)

Rules:
- Return VALID JSON ONLY (no markdown).
- Output must be a JSON array of objects.
- Each object MUST have exactly these keys: question, options, answer, explanation
- options must be an array of 4 strings (A..D option texts; do NOT prefix with "A)" etc.)
- answer must be one of: "A", "B", "C", "D"
- explanation must be concise (1–3 sentences)
- Avoid duplicates / near-duplicates.

Return ONLY the JSON array.
""".strip()


def _mcq_meta(options: list[str], answer: str, explanation: str) -> dict[str, Any]:
    """Build MCQ metadata for storage."""
    return {
        "feature": "mcq",
        "mcq": {
            "options": options,
            "answer": answer,
            "explanation": explanation,
        },
    }


def _get_mcq_struct(item: Any) -> tuple[list[str], str | None, str | None]:
    """Read MCQ options/answer/explanation from ai_meta_json."""
    raw = getattr(item, "ai_meta_json", None)
    if not raw:
        return ([], None, None)
    try:
        meta = json.loads(raw)
    except Exception:
        return ([], None, None)

    mcq = meta.get("mcq") if isinstance(meta, dict) else None
    if not isinstance(mcq, dict):
        return ([], None, None)

    options = mcq.get("options")
    if not isinstance(options, list):
        options = []
    options = [str(x) for x in options][:4]

    ans = mcq.get("answer")
    ans = str(ans).strip().upper() if ans else None
    if ans not in {"A", "B", "C", "D"}:
        ans = None

    expl = mcq.get("explanation")
    expl = str(expl).strip() if expl else None

    return (options, ans, expl)


def _mcq_question_hash(question: str, options: list[str]) -> str:
    """Hash MCQ question + options for deduplication."""
    base = normalize_question_for_hash(question) + "||" + "|".join([" ".join(o.lower().split()) for o in options])
    return sha256_hex(base)


@router.post("/generate", response_model=schemas.MCQGenerateOut)
def mcq_generate(
    payload: schemas.MCQGenerateIn,
    db: OrmSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    session = db.get(models.Session, payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    ensure_session_owner(session, current_user)

    # Use recent questions to reduce repeats.
    recent_qs = [it.question for it in session.items if (it.question or "").strip()]
    recent_qs = recent_qs[-12:]

    sys = "You generate interview MCQs only. Return JSON only."
    prompt = _mcq_generate_prompt(session.track, session.level, payload.skill, payload.topic, payload.difficulty, payload.n)
    if recent_qs:
        prompt += "\n\nAvoid repeating any of these questions (verbatim or near-duplicate):\n" + "\n".join(f"- {rq}" for rq in recent_qs)

    try:
        raw = chat_complete(sys, prompt).strip()
    except AIError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Parse model JSON (array)
    try:
        data = json.loads(raw)
    except Exception:
        repaired = extract_first_json_array(raw)
        if not repaired:
            raise HTTPException(status_code=500, detail=f"AI did not return valid JSON array. Raw: {raw[:500]}")
        try:
            data = json.loads(repaired)
        except Exception:
            raise HTTPException(status_code=500, detail=f"AI did not return valid JSON array. Raw: {raw[:500]}")

    if not isinstance(data, list):
        raise HTTPException(status_code=500, detail="AI did not return a JSON array")

    created: list[schemas.MCQOut] = []

    for obj in data[: payload.n]:
        if not isinstance(obj, dict):
            continue

        question = str(obj.get("question") or "").strip()
        options = obj.get("options")
        answer = str(obj.get("answer") or "").strip().upper()
        explanation = str(obj.get("explanation") or "").strip()

        if not question or not isinstance(options, list) or len(options) != 4:
            continue

        options = [str(x).strip() for x in options]
        if any(not o for o in options):
            continue

        if answer not in {"A", "B", "C", "D"}:
            continue

        q_hash = _mcq_question_hash(question, options)

        # Hard de-dupe within session
        existing = db.execute(
            select(models.QAItem.id).where(
                models.QAItem.session_id == session.id,
                models.QAItem.question_hash == q_hash,
            )
        ).first()
        if existing is not None:
            continue

        item = models.QAItem(
            session_id=session.id,
            skill=payload.skill,
            topic=payload.topic,
            question_type="MCQ",
            difficulty=payload.difficulty,
            question=question,
        )
        item.question_hash = q_hash
        item.ai_meta_json = json.dumps(
            {
                **_mcq_meta(options, answer, explanation),
                "model": getattr(settings, "OPENAI_MODEL", None),
                "prompt_version": "v1",
            }
        )

        db.add(item)
        db.flush()

        created.append(schemas.MCQOut(qa_item_id=item.id, question=item.question, options=options))

    db.commit()

    if not created:
        raise HTTPException(status_code=500, detail="AI did not produce any valid MCQs")

    return {"mcqs": [c.model_dump() for c in created]}


@router.post("/submit", response_model=schemas.MCQSubmitOut)
def mcq_submit(
    payload: schemas.MCQSubmitIn,
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

    if str(getattr(item, "question_type", "")).upper() != "MCQ":
        raise HTTPException(status_code=400, detail="QA item is not an MCQ")

    selected = str(payload.selected or "").strip().upper()
    if selected not in {"A", "B", "C", "D"}:
        raise HTTPException(status_code=422, detail="selected must be one of A/B/C/D")

    _, correct_answer, explanation = _get_mcq_struct(item)
    if not correct_answer:
        raise HTTPException(status_code=500, detail="MCQ answer key missing")

    correct = selected == correct_answer

    # Store response
    item.user_answer = selected
    item.overall = 10 if correct else 0
    item.feedback = json.dumps({"correct": correct, "correct_answer": correct_answer})

    # Update ai_meta_json with user submission info
    try:
        meta = json.loads(item.ai_meta_json) if item.ai_meta_json else {}
        if not isinstance(meta, dict):
            meta = {}
    except Exception:
        meta = {}

    meta["mcq"] = meta.get("mcq", {}) if isinstance(meta.get("mcq"), dict) else {}
    meta["mcq"]["selected"] = selected
    meta["mcq"]["answered_at"] = datetime.now(timezone.utc).isoformat()
    item.ai_meta_json = json.dumps(meta)

    # Update TopicProgress
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

    db.add(item)
    db.commit()

    return {
        "correct": bool(correct),
        "selected": selected,
        "correct_answer": correct_answer,
        "explanation": explanation or "",
        "overall": int(item.overall or 0),
    }


@router.get("/report/{session_id}", response_model=schemas.MCQReportOut)
def mcq_report(
    session_id: int,
    db: OrmSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    s = db.get(models.Session, session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    ensure_session_owner(s, current_user)

    by_skill: dict[str, dict[str, int]] = {}

    for it in getattr(s, "items", []) or []:
        if str(getattr(it, "question_type", "")).upper() != "MCQ":
            continue
        if not getattr(it, "user_answer", None):
            continue

        _, correct_answer, _ = _get_mcq_struct(it)
        if not correct_answer:
            continue

        skill = str(getattr(it, "skill", "Unknown") or "Unknown")
        rec = by_skill.setdefault(skill, {"attempts": 0, "correct": 0})
        rec["attempts"] += 1
        if str(it.user_answer).strip().upper() == correct_answer:
            rec["correct"] += 1

    rows: list[schemas.MCQSkillReportRow] = []
    for sk, rec in by_skill.items():
        attempts = rec["attempts"]
        correct = rec["correct"]
        acc = (correct / attempts) if attempts else 0.0
        rows.append(schemas.MCQSkillReportRow(skill=sk, attempts=attempts, correct=correct, accuracy=acc))

    rows.sort(key=lambda r: r.accuracy)

    return {"session_id": s.id, "by_skill": [r.model_dump() for r in rows]}
