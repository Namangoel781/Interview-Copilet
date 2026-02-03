"""
Mock Interview routes: start, next question, answer evaluation.
"""
import json
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy import select

from db import get_db
import models, schemas
from settings import settings
from core.security import get_current_user
from core.dependencies import set_owner_id, ensure_session_owner
from ai import chat_complete, AIError
from prompts import interview_start_prompt, interview_followup_prompt, interview_evaluate_prompt
from services.ai_helpers import extract_first_json_object, sha256_hex, normalize_question_for_hash
from services.progress import compute_weak_topics_for_session

router = APIRouter(prefix="/interview", tags=["interview"])


# Schemas
class InterviewStartIn(BaseModel):
    track: str = Field(description="backend | frontend | fullstack")
    level: str = Field(description="beginner | intermediate | advanced")
    interview_type: str = Field(description="HR | Technical | Scenario")


class InterviewStartOut(BaseModel):
    session_id: int
    first_question: str
    qa_item_id: int


class InterviewNextIn(BaseModel):
    session_id: int


class InterviewNextOut(BaseModel):
    qa_item_id: int
    question: str
    is_follow_up: bool
    turn_count: int


class InterviewAnswerIn(BaseModel):
    qa_item_id: int
    user_answer: str = Field(min_length=1, max_length=8000)


class InterviewEvaluation(BaseModel):
    scores: dict[str, int]
    overall: float
    strengths: list[str]
    gaps: list[str]
    improvements: list[str]
    model_answer: str


class InterviewAnswerOut(BaseModel):
    evaluation: InterviewEvaluation
    follow_up_question: Optional[str] = None
    follow_up_qa_item_id: Optional[int] = None
    interview_complete: bool
    current_difficulty: int
    turn_count: int


# Helper functions
def _get_conversation_state(session: models.Session) -> dict[str, Any]:
    """Parse conversation state from session."""
    if not session.conversation_state_json:
        return {
            "turn_count": 0,
            "topics_covered": [],
            "weak_spots_identified": [],
            "difficulty_history": [],
            "last_evaluation_summary": "",
            "conversation_history": [],
        }
    try:
        return json.loads(session.conversation_state_json)
    except Exception:
        return {
            "turn_count": 0,
            "topics_covered": [],
            "weak_spots_identified": [],
            "difficulty_history": [],
            "last_evaluation_summary": "",
            "conversation_history": [],
        }


def _save_conversation_state(session: models.Session, state: dict[str, Any], db: OrmSession) -> None:
    """Save conversation state to session."""
    session.conversation_state_json = json.dumps(state)
    db.add(session)


def _get_weak_topics_for_user(db: OrmSession, current_user: models.User) -> list[str]:
    """Get weak topics from user's previous sessions."""
    # Find user's sessions
    sessions = db.execute(
        select(models.Session)
        .where(models.Session.user_id == current_user.id)
        .order_by(models.Session.id.desc())
        .limit(5)
    ).scalars().all()
    
    weak_topics = []
    for s in sessions:
        topics = compute_weak_topics_for_session(s, db, limit=3)
        for t in topics:
            if t["topic"] not in weak_topics:
                weak_topics.append(t["topic"])
    
    return weak_topics[:5]


def _get_mcq_mistakes(db: OrmSession, current_user: models.User) -> list[str]:
    """Get topics where user made MCQ mistakes."""
    # Find recent MCQ items with wrong answers
    sessions = db.execute(
        select(models.Session)
        .where(models.Session.user_id == current_user.id)
        .order_by(models.Session.id.desc())
        .limit(5)
    ).scalars().all()
    
    mistakes = []
    for s in sessions:
        for item in getattr(s, "items", []) or []:
            if str(getattr(item, "question_type", "")).upper() == "MCQ":
                if item.overall is not None and item.overall < 5:
                    if item.topic not in mistakes:
                        mistakes.append(item.topic)
    
    return mistakes[:5]


def _determine_skill_topic(interview_type: str, track: str, weak_topics: list[str]) -> tuple[str, str]:
    """Determine skill and topic for the interview question."""
    if weak_topics:
        topic = weak_topics[0]
        if interview_type == "HR":
            skill = "Behavioral"
        elif interview_type == "Technical":
            skill = "DSA" if track == "backend" else "React" if track == "frontend" else "SystemDesign"
        else:
            skill = "ProblemSolving"
        return skill, topic
    
    # Default topics by interview type
    defaults = {
        "HR": ("Behavioral", "Teamwork"),
        "Technical": ("DSA" if track == "backend" else "React", "fundamentals"),
        "Scenario": ("SystemDesign", "architecture"),
    }
    return defaults.get(interview_type, ("General", "interview"))


# Routes
@router.post("/start", response_model=InterviewStartOut)
def interview_start(
    payload: InterviewStartIn,
    db: OrmSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Start a new mock interview session."""
    # Get user context
    weak_topics = _get_weak_topics_for_user(db, current_user)
    mcq_mistakes = _get_mcq_mistakes(db, current_user)
    
    # Create session
    session = models.Session(
        mode="mock_interview",
        track=payload.track,
        level=payload.level,
        interview_type=payload.interview_type,
        difficulty_current=3,  # Start at medium
    )
    set_owner_id(session, current_user.id)
    db.add(session)
    db.commit()
    db.refresh(session)
    
    # Generate first question
    sys_prompt = "You are a professional interviewer. Generate interview questions only."
    user_prompt = interview_start_prompt(
        track=payload.track,
        level=payload.level,
        interview_type=payload.interview_type,
        weak_topics=weak_topics,
        mcq_mistakes=mcq_mistakes,
    )
    
    try:
        question = chat_complete(sys_prompt, user_prompt).strip()
    except AIError as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    if len(question) < 10:
        raise HTTPException(status_code=500, detail="AI returned an invalid question")
    
    # Determine skill/topic
    skill, topic = _determine_skill_topic(payload.interview_type, payload.track, weak_topics)
    
    # Create QA item
    item = models.QAItem(
        session_id=session.id,
        skill=skill,
        topic=topic,
        question_type=payload.interview_type.lower(),
        difficulty=session.difficulty_current,
        question=question,
        question_hash=sha256_hex(normalize_question_for_hash(question)),
    )
    item.ai_meta_json = json.dumps({
        "feature": "interview_start",
        "model": getattr(settings, "OPENAI_MODEL", None),
        "interview_type": payload.interview_type,
    })
    db.add(item)
    
    # Initialize conversation state
    state = {
        "turn_count": 1,
        "topics_covered": [topic],
        "weak_spots_identified": weak_topics,
        "difficulty_history": [session.difficulty_current],
        "last_evaluation_summary": "",
        "conversation_history": [{"question": question, "answer": None, "score": None}],
    }
    _save_conversation_state(session, state, db)
    
    db.commit()
    db.refresh(item)
    
    return {
        "session_id": session.id,
        "first_question": question,
        "qa_item_id": item.id,
    }


@router.post("/next", response_model=InterviewNextOut)
def interview_next(
    payload: InterviewNextIn,
    db: OrmSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get the next interview question (for cases where we need a new topic)."""
    session = db.get(models.Session, payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    ensure_session_owner(session, current_user)
    
    if session.mode != "mock_interview":
        raise HTTPException(status_code=400, detail="Session is not a mock interview")
    
    state = _get_conversation_state(session)
    
    # Generate next question using conversation history
    sys_prompt = "You are a professional interviewer. Generate interview questions only."
    user_prompt = interview_followup_prompt(
        track=session.track,
        level=session.level,
        interview_type=session.interview_type or "Technical",
        difficulty=session.difficulty_current,
        conversation_history=state.get("conversation_history", []),
        last_answer_quality=state.get("last_evaluation_summary", "unknown"),
    )
    
    try:
        question = chat_complete(sys_prompt, user_prompt).strip()
    except AIError as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    if len(question) < 10:
        raise HTTPException(status_code=500, detail="AI returned an invalid question")
    
    # Determine skill/topic based on what hasn't been covered
    covered = state.get("topics_covered", [])
    weak = state.get("weak_spots_identified", [])
    uncovered_weak = [t for t in weak if t not in covered]
    
    skill, topic = _determine_skill_topic(
        session.interview_type or "Technical",
        session.track,
        uncovered_weak or weak,
    )
    
    # Create QA item
    item = models.QAItem(
        session_id=session.id,
        skill=skill,
        topic=topic,
        question_type=(session.interview_type or "technical").lower(),
        difficulty=session.difficulty_current,
        question=question,
        question_hash=sha256_hex(normalize_question_for_hash(question)),
    )
    item.ai_meta_json = json.dumps({
        "feature": "interview_next",
        "model": getattr(settings, "OPENAI_MODEL", None),
        "turn": state.get("turn_count", 0) + 1,
    })
    db.add(item)
    
    # Update conversation state
    state["turn_count"] = state.get("turn_count", 0) + 1
    if topic not in state.get("topics_covered", []):
        state.setdefault("topics_covered", []).append(topic)
    state["conversation_history"].append({"question": question, "answer": None, "score": None})
    state["difficulty_history"].append(session.difficulty_current)
    _save_conversation_state(session, state, db)
    
    db.commit()
    db.refresh(item)
    
    return {
        "qa_item_id": item.id,
        "question": question,
        "is_follow_up": False,
        "turn_count": state["turn_count"],
    }


@router.post("/answer", response_model=InterviewAnswerOut)
def interview_answer(
    payload: InterviewAnswerIn,
    db: OrmSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Submit answer, get evaluation, and possibly a follow-up question."""
    item = db.get(models.QAItem, payload.qa_item_id)
    if not item:
        raise HTTPException(status_code=404, detail="QA item not found")
    
    session = db.get(models.Session, item.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    ensure_session_owner(session, current_user)
    
    if session.mode != "mock_interview":
        raise HTTPException(status_code=400, detail="Session is not a mock interview")
    
    # Store user answer
    item.user_answer = payload.user_answer
    
    # Evaluate the answer
    sys_prompt = "You are a strict interview evaluator. Return JSON only."
    user_prompt = interview_evaluate_prompt(
        skill=item.skill,
        topic=item.topic,
        interview_type=session.interview_type or "Technical",
        question=item.question,
        user_answer=payload.user_answer,
        difficulty=session.difficulty_current,
    )
    
    try:
        raw = chat_complete(sys_prompt, user_prompt).strip()
    except AIError as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    # Parse evaluation
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
    
    # Extract evaluation data
    scores = parsed.get("scores", {})
    overall = float(parsed.get("overall", 3))
    
    item.overall = overall
    item.model_answer = parsed.get("model_answer", "")
    item.scores_json = json.dumps(scores)
    item.feedback = json.dumps({
        "strengths": parsed.get("strengths", []),
        "gaps": parsed.get("gaps", []),
        "improvements": parsed.get("improvements", []),
        "next_drill_topic": parsed.get("next_drill_topic", ""),
    })
    item.ai_meta_json = json.dumps({
        "feature": "interview_evaluate",
        "model": getattr(settings, "OPENAI_MODEL", None),
        "difficulty_adjustment": parsed.get("difficulty_adjustment", 0),
        "should_follow_up": parsed.get("should_follow_up", False),
    })
    db.add(item)
    
    # Update conversation state
    state = _get_conversation_state(session)
    if state.get("conversation_history"):
        # Update last entry with answer and score
        state["conversation_history"][-1]["answer"] = payload.user_answer[:500]
        state["conversation_history"][-1]["score"] = overall
    
    quality = "strong" if overall >= 4 else "weak" if overall <= 2 else "moderate"
    state["last_evaluation_summary"] = f"{quality} answer on {item.topic} (score: {overall})"
    
    # Adjust difficulty
    adjustment = parsed.get("difficulty_adjustment", 0)
    new_difficulty = max(1, min(5, session.difficulty_current + adjustment))
    session.difficulty_current = new_difficulty
    
    # Determine if we should generate a follow-up
    should_follow_up = parsed.get("should_follow_up", False)
    follow_up_question = None
    follow_up_qa_item_id = None
    
    # Limit interview to ~10 turns
    turn_count = state.get("turn_count", 1)
    interview_complete = turn_count >= 10
    
    if should_follow_up and not interview_complete:
        # Generate follow-up question
        follow_up_prompt = interview_followup_prompt(
            track=session.track,
            level=session.level,
            interview_type=session.interview_type or "Technical",
            difficulty=new_difficulty,
            conversation_history=state.get("conversation_history", []),
            last_answer_quality=quality,
        )
        
        try:
            follow_up_question = chat_complete(
                "You are a professional interviewer. Generate interview questions only.",
                follow_up_prompt
            ).strip()
        except AIError:
            follow_up_question = None
        
        if follow_up_question and len(follow_up_question) >= 10:
            # Create follow-up QA item
            follow_up_item = models.QAItem(
                session_id=session.id,
                skill=item.skill,
                topic=item.topic,
                question_type=(session.interview_type or "technical").lower(),
                difficulty=new_difficulty,
                question=follow_up_question,
                question_hash=sha256_hex(normalize_question_for_hash(follow_up_question)),
            )
            follow_up_item.ai_meta_json = json.dumps({
                "feature": "interview_followup",
                "model": getattr(settings, "OPENAI_MODEL", None),
                "turn": turn_count + 1,
            })
            db.add(follow_up_item)
            
            # Update state
            state["turn_count"] = turn_count + 1
            state["conversation_history"].append({
                "question": follow_up_question,
                "answer": None,
                "score": None,
            })
            state["difficulty_history"].append(new_difficulty)
            
            db.flush()
            follow_up_qa_item_id = follow_up_item.id
    
    _save_conversation_state(session, state, db)
    db.commit()
    
    evaluation = InterviewEvaluation(
        scores=scores,
        overall=overall,
        strengths=parsed.get("strengths", []),
        gaps=parsed.get("gaps", []),
        improvements=parsed.get("improvements", []),
        model_answer=parsed.get("model_answer", ""),
    )
    
    return {
        "evaluation": evaluation,
        "follow_up_question": follow_up_question,
        "follow_up_qa_item_id": follow_up_qa_item_id,
        "interview_complete": interview_complete and not follow_up_question,
        "current_difficulty": new_difficulty,
        "turn_count": state.get("turn_count", turn_count),
    }
