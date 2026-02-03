from __future__ import annotations
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    String,
    Integer,
    Float,
    Text,
    ForeignKey,
    DateTime,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import BigInteger, Integer, String, DateTime, JSON, func
from db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    # Password hash for auth (pbkdf2_sha256 via passlib). Nullable to avoid breaking existing DBs;
    # new signups will always set it.
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # MVP Profile Setup (domain-agnostic). Kept nullable for backward compatibility.
    domain: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)  # e.g., Software
    role: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)  # e.g., Backend Developer
    track: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # backend | frontend | fullstack
    level: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # beginner | intermediate | advanced

    # Normalized profile (preferred). One row per user.
    profile: Mapped[Optional["UserProfile"]] = relationship(
        "UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )

    sessions: Mapped[list["Session"]] = relationship(
        "Session", back_populates="user", cascade="all, delete-orphan"
    )
    profile_docs: Mapped[list["ProfileDocument"]] = relationship(
        "ProfileDocument", back_populates="user", cascade="all, delete-orphan"
    )


# New UserProfile model for normalized profile info
class UserProfile(Base):
    """User profile & role setup (MVP Feature #1).

    Kept separate so the core User table stays minimal.
    """

    __tablename__ = "user_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), unique=True, index=True)

    # Domain/role personalization
    domain: Mapped[str] = mapped_column(String(80))  # Software, Finance, Marketing, etc.
    role: Mapped[str] = mapped_column(String(120))  # Backend Developer, Analyst, etc.
    track: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # backend | frontend | fullstack
    level: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # beginner | intermediate | advanced

    # Optional: user-provided skills/resume summary (stored as JSON string)
    skills_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship("User", back_populates="profile")


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Optional: enables multi-user later without breaking existing installs
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    mode: Mapped[str] = mapped_column(String(20))  # learn | interview | mock_interview

    # Snapshot of the user's target at time of session (MVP Feature #1)
    domain: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    role: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)

    track: Mapped[str] = mapped_column(String(50))  # backend | frontend | fullstack
    level: Mapped[str] = mapped_column(String(20))  # beginner | intermediate | advanced

    # Mock Interview specific fields
    interview_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # HR | Technical | Scenario
    conversation_state_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # AI conversation memory
    difficulty_current: Mapped[int] = mapped_column(Integer, default=3)  # 1-5, adapts during interview

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[Optional["User"]] = relationship("User", back_populates="sessions")

    items: Mapped[list["QAItem"]] = relationship(
        "QAItem", back_populates="session", cascade="all, delete-orphan"
    )

    topic_progress: Mapped[list["TopicProgress"]] = relationship(
        "TopicProgress", back_populates="session", cascade="all, delete-orphan"
    )



class QAItem(Base):
    __tablename__ = "qa_items"

    __table_args__ = (
        # Prevent accidental repeat inserts within a session when hash is present
        UniqueConstraint("session_id", "question_hash", name="uq_qa_session_question_hash"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("sessions.id"), index=True)

    # Domain-agnostic taxonomy
    skill: Mapped[str] = mapped_column(String(120))  # e.g., SQL, DSA, React, Accounting, Sales
    topic: Mapped[str] = mapped_column(String(120))  # e.g., joins, hashing, caching
    question_type: Mapped[str] = mapped_column(String(30))  # conceptual | scenario | problem | hr
    difficulty: Mapped[int] = mapped_column(Integer)  # 1-5

    # open_ended | mcq (MVP Feature #3)
    format: Mapped[str] = mapped_column(String(20), default="open_ended")

    question: Mapped[str] = mapped_column(Text)

    # Used for repeat-avoidance and de-duplication (sha256 of normalized question text)
    question_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    # MCQ fields (stored as JSON string for DB portability)
    mcq_options_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # ["A", "B", "C", "D"]
    mcq_correct_index: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 0-3
    mcq_explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    user_answer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    model_answer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Evaluation
    overall: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    scores_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Reproducibility: store model + temperature + prompt_version + latency/tokens, etc.
    ai_meta_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["Session"] = relationship("Session", back_populates="items")


class TopicProgress(Base):
    """Aggregated progress per (session, skill, topic).

    This powers Dashboard charts and 'weak topics' without scanning every QAItem.
    """

    __tablename__ = "topic_progress"

    __table_args__ = (
        UniqueConstraint("session_id", "skill", "topic", name="uq_progress_session_skill_topic"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("sessions.id"), index=True)

    track: Mapped[str] = mapped_column(String(50))  # backend | frontend | fullstack
    skill: Mapped[str] = mapped_column(String(120))
    topic: Mapped[str] = mapped_column(String(120))

    attempts: Mapped[int] = mapped_column(Integer, default=0)
    avg_overall: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    session: Mapped["Session"] = relationship("Session", back_populates="topic_progress")


class ProfileDocument(Base):
    """Stores JD text + resume text (or extracted text from PDF) and extraction metadata."""

    __tablename__ = "profile_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Optional: enables multi-user later without breaking existing installs
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    role: Mapped[str] = mapped_column(String(120))  # e.g., Frontend Developer

    # Snapshot metadata to make analysis reproducible
    domain: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    track: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    level: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Optional file metadata
    resume_filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    resume_content_type: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)

    jd_text: Mapped[str] = mapped_column(Text)
    resume_text: Mapped[str] = mapped_column(Text)

    # Diagnostics
    resume_extraction_method: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)  # pypdf | pdfminer | ocr | pasted
    resume_extracted_chars: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    resume_preview: Mapped[Optional[str]] = mapped_column(String(400), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[Optional["User"]] = relationship("User", back_populates="profile_docs")

    analyses: Mapped[list["ProfileAnalysis"]] = relationship(
        "ProfileAnalysis", back_populates="document", cascade="all, delete-orphan"
    )


class ProfileAnalysis(Base):
    """AI output for JD/resume matching.

    Stored as JSON strings to keep the DB simple and avoid vendor-specific JSON types.
    """

    __tablename__ = "profile_analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    document_id: Mapped[int] = mapped_column(Integer, ForeignKey("profile_documents.id"), index=True)

    # Outputs
    matched_skills_json: Mapped[str] = mapped_column(Text)  # list of {skill, confidence, evidence_snippet}
    missing_skills_json: Mapped[str] = mapped_column(Text)  # prioritized gaps
    roadmap_json: Mapped[str] = mapped_column(Text)  # study plan
    resources_json: Mapped[str] = mapped_column(Text)  # resources per topic (youtube/doc links)
    resume_improvements_json: Mapped[str] = mapped_column(Text)  # ATS + bullet suggestions

    # Reproducibility
    ai_meta_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    document: Mapped["ProfileDocument"] = relationship("ProfileDocument", back_populates="analyses")

class Roadmap(Base):
    __tablename__ = "roadmaps"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    session_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True, index=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    duration_days: Mapped[int] = mapped_column(Integer, nullable=False, default=14)

    plan_json: Mapped[dict] = mapped_column(JSON, nullable=False)

    created_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())