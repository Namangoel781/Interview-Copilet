"""
Profile routes: setup, me, analyze.
"""
import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session as OrmSession

from db import get_db
import models
from settings import settings
from core.security import get_current_user
from core.dependencies import set_owner_id
from ai import chat_complete, AIError
from services.ai_helpers import (
    extract_pdf_text,
    ocr_dependency_diagnosis,
    youtube_search_url,
    profile_analysis_prompt,
)

router = APIRouter(prefix="/profile", tags=["profile"])


# Schemas
class ProfileSetupIn(BaseModel):
    domain: str | None = None
    role: str | None = None
    track: str | None = None
    level: str | None = None


class ProfileMeOut(BaseModel):
    id: int
    email: str
    domain: str | None = None
    role: str | None = None
    track: str | None = None
    level: str | None = None


class StarRewrite(BaseModel):
    original: str
    rewritten: str
    reasoning: str


class ProfileAnalyzeOut(BaseModel):
    # Richer, JD-grounded extraction
    required_skills: list[dict[str, Any]] = Field(default_factory=list)
    experience_expectations: list[str] = Field(default_factory=list)
    gap_report: dict[str, Any] = Field(default_factory=dict)
    role_fit_score: int = 0

    # New ATS & STAR features
    ats_score: int = Field(default=0, ge=0, le=100)
    ats_warnings: list[str] = Field(default_factory=list)
    star_rewrites: list[StarRewrite] = Field(default_factory=list)

    # Existing fields (kept for backward compatibility)
    matched_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    missing_topics: list[str] = Field(default_factory=list)
    priority_topics: list[dict[str, Any]] = Field(default_factory=list)
    resume_gaps: list[str] = Field(default_factory=list)
    resume_improvements: list[str] = Field(default_factory=list)
    interview_plan_2_weeks: list[dict[str, Any]] = Field(default_factory=list)
    project_suggestions: list[dict[str, Any]] = Field(default_factory=list)
    ats_keywords_to_add: list[str] = Field(default_factory=list)
    youtube_links: list[dict[str, str]] = Field(default_factory=list)
    summary: str = ""


# Helper functions
def _set_user_profile_fields(user: models.User, payload: ProfileSetupIn) -> None:
    """Update only fields that exist on the mapped User model."""
    mapper_keys = set(getattr(user.__class__, "__mapper__").attrs.keys())
    for field in ("domain", "role", "track", "level"):
        if field not in mapper_keys:
            continue
        val = getattr(payload, field)
        if val is None:
            continue
        if isinstance(val, str):
            val = val.strip() or None
        setattr(user, field, val)


# Routes
@router.post("/setup", response_model=ProfileMeOut)
@router.post("/setup/", response_model=ProfileMeOut)
def profile_setup(
    payload: ProfileSetupIn,
    db: OrmSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Create/update the current user's profile fields (domain/role/track/level)."""
    _set_user_profile_fields(current_user, payload)
    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    return {
        "id": current_user.id,
        "email": current_user.email,
        "domain": getattr(current_user, "domain", None),
        "role": getattr(current_user, "role", None),
        "track": getattr(current_user, "track", None),
        "level": getattr(current_user, "level", None),
    }


@router.get("/me", response_model=ProfileMeOut)
@router.get("/me/", response_model=ProfileMeOut)
def profile_me(current_user: models.User = Depends(get_current_user)):
    """Fetch the current user's profile."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "domain": getattr(current_user, "domain", None),
        "role": getattr(current_user, "role", None),
        "track": getattr(current_user, "track", None),
        "level": getattr(current_user, "level", None),
    }


@router.post("/analyze", response_model=ProfileAnalyzeOut)
def profile_analyze(
    db: OrmSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    jd_text: str = Form(...),
    resume_text: str | None = Form(None),
    resume_pdf: UploadFile | None = File(None),
):
    if not jd_text or len(jd_text.strip()) < 40:
        raise HTTPException(status_code=400, detail="JD text is too short")

    # Resume can be provided either as pasted text or as a PDF upload.
    final_resume_text = (resume_text or "").strip()

    if not final_resume_text:
        if not resume_pdf or not resume_pdf.filename:
            raise HTTPException(status_code=400, detail="Provide either resume_text or resume_pdf")
        if not resume_pdf.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Please upload a PDF resume")

        final_resume_text = extract_pdf_text(resume_pdf)

    extracted_len = len(final_resume_text or "")
    if not final_resume_text or extracted_len < 40:
        preview = (final_resume_text or "").replace("\n", " ").strip()[:200]

        extra = ""
        if extracted_len == 0 and resume_pdf is not None and (resume_text or "").strip() == "":
            issues = ocr_dependency_diagnosis()
            if issues:
                extra = " OCR is enabled but dependencies seem missing: " + "; ".join(issues)
            else:
                extra = (
                    " OCR is enabled and dependencies appear installed. "
                    "If it still extracts 0 chars, the PDF may be protected, very low-quality, or require higher OCR settings. "
                    "Try uploading a clearer PDF or paste resume_text."
                )

        raise HTTPException(
            status_code=400,
            detail=(
                f"Could not extract enough text from the resume (extracted_chars={extracted_len}). "
                "Try exporting as a text-based PDF (not scanned), or paste resume_text instead. "
                f"Preview: '{preview}'." + extra
            ),
        )

    sys = "You are a senior recruiter + interview coach. Return JSON only."
    user = profile_analysis_prompt(jd_text, final_resume_text)

    try:
        raw = chat_complete(sys, user).strip()
        parsed = json.loads(raw)
        result = ProfileAnalyzeOut.model_validate(parsed)

        # Normalize/derive fields for robustness.
        if not isinstance(result.gap_report, dict):
            result.gap_report = {}

        result.gap_report.setdefault("missing", list(result.missing_skills or []))

        if "weak" not in result.gap_report or not isinstance(result.gap_report.get("weak"), list):
            result.gap_report["weak"] = list(result.resume_gaps or [])

        if "suggested_projects" not in result.gap_report or not isinstance(result.gap_report.get("suggested_projects"), list):
            result.gap_report["suggested_projects"] = list(result.project_suggestions or [])

        if "ats_keywords" not in result.gap_report or not isinstance(result.gap_report.get("ats_keywords"), list):
            result.gap_report["ats_keywords"] = list(result.ats_keywords_to_add or [])

        try:
            result.role_fit_score = int(result.role_fit_score or 0)
        except Exception:
            result.role_fit_score = 0
        if result.role_fit_score < 0:
            result.role_fit_score = 0
        if result.role_fit_score > 100:
            result.role_fit_score = 100

        # Normalize new ATS/STAR fields
        if result.ats_score < 0: result.ats_score = 0
        if result.ats_score > 100: result.ats_score = 100
        if not result.ats_warnings: result.ats_warnings = []
        if not result.star_rewrites: result.star_rewrites = []

        # Build YouTube search links for topics
        topics: list[str] = []

        for t in result.priority_topics:
            topic = (t.get("topic") if isinstance(t, dict) else None) or ""
            topic = str(topic).strip()
            if topic:
                topics.append(topic)

        for mt in result.missing_topics:
            mt = (mt or "").strip()
            if mt:
                topics.append(mt)

        for rs in result.required_skills:
            if not isinstance(rs, dict):
                continue
            name = str(rs.get("name") or "").strip()
            if name:
                topics.append(name)

        for exp in result.experience_expectations:
            exp = (exp or "").strip()
            if exp:
                topics.append(exp)

        # De-duplicate while preserving order
        seen: set[str] = set()
        uniq: list[str] = []
        for t in topics:
            key = t.lower()
            if key in seen:
                continue
            seen.add(key)
            uniq.append(t)
        uniq = uniq[:25]

        result.youtube_links = [{"topic": t, "url": youtube_search_url(t)} for t in uniq]

        # Persist document + analysis (best-effort)
        try:
            role_guess = "Software Developer"
            jd_l = jd_text.lower()
            if "frontend" in jd_l or "react" in jd_l or "next" in jd_l:
                role_guess = "Frontend Developer"
            elif "backend" in jd_l or "api" in jd_l or "microservice" in jd_l:
                role_guess = "Backend Developer"

            doc = models.ProfileDocument(
                role=role_guess,
                jd_text=jd_text.strip(),
                resume_text=final_resume_text.strip(),
                resume_extraction_method=("pasted" if (resume_text or "").strip() else "pdf"),
                resume_extracted_chars=extracted_len,
                resume_preview=(final_resume_text.replace("\n", " ").strip()[:400] if final_resume_text else ""),
            )
            set_owner_id(doc, current_user.id)
            db.add(doc)
            db.flush()

            analysis = models.ProfileAnalysis(
                document_id=doc.id,
                matched_skills_json=json.dumps(result.matched_skills),
                missing_skills_json=json.dumps(result.missing_skills),
                roadmap_json=json.dumps(result.interview_plan_2_weeks),
                resources_json=json.dumps(result.youtube_links),
                resume_improvements_json=json.dumps(
                    {
                        "resume_gaps": result.resume_gaps,
                        "resume_improvements": result.resume_improvements,
                        "ats_keywords_to_add": result.ats_keywords_to_add,
                        "project_suggestions": result.project_suggestions,
                        "priority_topics": result.priority_topics,
                        "missing_topics": result.missing_topics,
                        "required_skills": result.required_skills,
                        "experience_expectations": result.experience_expectations,
                        "gap_report": result.gap_report,
                        "role_fit_score": result.role_fit_score,
                        "ats_score": result.ats_score,
                        "ats_warnings": result.ats_warnings,
                        "star_rewrites": [r.model_dump() for r in result.star_rewrites],
                    }
                ),
                ai_meta_json=json.dumps(
                    {
                        "feature": "profile_analyze",
                        "model": getattr(settings, "OPENAI_MODEL", None),
                        "prompt_version": "v1",
                    }
                ),
            )
            db.add(analysis)
            db.commit()
        except Exception:
            db.rollback()

        return result
    except Exception:
        raise HTTPException(status_code=500, detail=f"AI did not return valid JSON. Raw: {raw[:800]}")
