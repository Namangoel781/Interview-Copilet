
from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Any, Literal, Optional, List
from datetime import datetime




# -----------------------------
# Core enums (kept for MVP UI)
# -----------------------------

# Session mode
Mode = Literal["learn", "interview"]

# Engineering track (software domain MVP)
Track = Literal["backend", "frontend", "fullstack"]

# Self-reported seniority
Level = Literal["beginner", "intermediate", "advanced"]

# Interview modality
InterviewType = Literal["hr", "technical", "scenario"]

# Question taxonomy (text questions)
QuestionType = Literal["conceptual", "scenario", "problem"]

# For domain-agnostic future expansion, we accept free-form skills.
# We still publish software-track suggestions for UI dropdowns.
SkillName = str

# Canonical software skills (for suggestions / UI population)
SoftwareSkill = Literal[
    "SQL",
    "DSA",
    "SystemDesign",
    "React",
    "Nextjs",
    "TypeScript",
    "JavaScript",
    "HTML",
    "CSS",
    "WebPerformance",
    "Testing",
]

# Reusable mapping for UI population (software domain MVP)
SKILLS_BY_TRACK: dict[str, list[str]] = {
    "backend": ["SQL", "DSA", "SystemDesign"],
    "frontend": [
        "React",
        "Nextjs",
        "TypeScript",
        "JavaScript",
        "HTML",
        "CSS",
        "WebPerformance",
        "Testing",
    ],
    "fullstack": [
        "SQL",
        "DSA",
        "SystemDesign",
        "React",
        "Nextjs",
        "TypeScript",
        "JavaScript",
        "HTML",
        "CSS",
        "WebPerformance",
        "Testing",
    ],
}

# Difficulty is accepted as either 1-5 or easy/medium/hard.
Difficulty = int | Literal["easy", "medium", "hard"]


def normalize_skill_name(raw: str) -> str:
    """Normalize common user inputs to our canonical skill keys."""
    s = (raw or "").strip()
    if not s:
        return s

    # Remove punctuation-like dots/slashes, normalize spaces
    s2 = (
        s.replace(".", "")
        .replace("/", " ")
        .replace("-", " ")
        .replace("_", " ")
    )
    s2 = " ".join(s2.split())

    # Common aliases -> canonical
    aliases = {
        "system design": "SystemDesign",
        "systemdesign": "SystemDesign",
        "dsa": "DSA",
        "data structures": "DSA",
        "data structures and algorithms": "DSA",
        "next": "Nextjs",
        "nextjs": "Nextjs",
        "next js": "Nextjs",
        "reactjs": "React",
        "react js": "React",
        "typescript": "TypeScript",
        "type script": "TypeScript",
        "javascript": "JavaScript",
        "js": "JavaScript",
        "html": "HTML",
        "css": "CSS",
        "web performance": "WebPerformance",
        "performance": "WebPerformance",
        "testing": "Testing",
        "unit testing": "Testing",
        "sql": "SQL",
    }
    key = s2.lower()
    if key in aliases:
        return aliases[key]

    # If it's already one of the canonical keys, return as-is
    canonical = {
        "SQL",
        "DSA",
        "SystemDesign",
        "React",
        "Nextjs",
        "TypeScript",
        "JavaScript",
        "HTML",
        "CSS",
        "WebPerformance",
        "Testing",
    }
    if s in canonical:
        return s

    # Fallback: title-case tokens (domain-agnostic, still readable)
    return "".join([t[:1].upper() + t[1:] for t in s2.split()])


def normalize_difficulty(value: Any) -> int:
    """Map easy/medium/hard -> 2/3/4 and validate 1..5."""
    if isinstance(value, str):
        v = value.strip().lower()
        mapping = {"easy": 2, "medium": 3, "hard": 4}
        if v in mapping:
            return mapping[v]
        # Attempt numeric strings
        if v.isdigit():
            value = int(v)
        else:
            raise ValueError("difficulty must be 1-5 or one of: easy, medium, hard")
    if not isinstance(value, int):
        raise ValueError("difficulty must be an integer or easy/medium/hard")
    if value < 1 or value > 5:
        raise ValueError("difficulty must be between 1 and 5")
    return value


class CreateSessionIn(BaseModel):
    mode: Mode
    track: Track
    level: Level

    # Optional, for domain-agnostic expansion and analytics
    domain: Optional[str] = None
    role: Optional[str] = None

class CreateSessionOut(BaseModel):
    session_id: int

# -----------------------------
# 1) User Profile & Role Setup
# -----------------------------

class ProfileSetupIn(BaseModel):
    domain: str = Field(min_length=1, max_length=100)
    role: str = Field(min_length=1, max_length=120)
    level: Level

    # Optional (useful for software MVP)
    track: Optional[Track] = None

    # Optional explicit skills list (manual override)
    skills: Optional[list[str]] = None

    # Optional: resume text pasted by user (PDF upload handled at API layer)
    resume_text: Optional[str] = None


class ProfileOut(BaseModel):
    id: int
    domain: str
    role: str
    level: Level
    track: Optional[str]
    skills: Optional[list[str]]


class GenerateQuestionIn(BaseModel):
    session_id: int

    # Free-form skill for domain-agnostic support (backend will normalize)
    skill: SkillName

    # Topic can be a free-form string; backend may normalize into a topic taxonomy
    topic: str

    question_type: QuestionType

    # Accept 1-5 or easy/medium/hard
    difficulty: Difficulty = Field(default=3)

    @field_validator("skill")
    @classmethod
    def _norm_skill(cls, v: str) -> str:
        v2 = normalize_skill_name(v)
        if not v2:
            raise ValueError("skill is required")
        return v2

    @field_validator("difficulty")
    @classmethod
    def _norm_diff(cls, v: Any) -> int:
        return normalize_difficulty(v)

class GenerateQuestionOut(BaseModel):
    qa_item_id: int
    question: str

class GetHintIn(BaseModel):
    qa_item_id: int
    # Optional: pass the user's current draft answer so the hint can target gaps.
    user_answer: Optional[str] = None
    # 1 = small nudge, 2 = medium, 3 = strong hint (not full solution)
    hint_level: int = Field(default=1, ge=1, le=3)


class GetHintOut(BaseModel):
    hint: str

# --------------------------------
# 2) Job Description Skill Gap AI
# --------------------------------

class SkillRequirement(BaseModel):
    name: str
    importance: Literal["must", "good_to_have"]
    evidence_in_jd: Optional[str] = None


class SkillGapReport(BaseModel):
    missing_skills: list[str]
    weak_skills: list[str]
    focus_areas: list[str]
    ats_keywords: list[str] = []


class LearningResource(BaseModel):
    title: str
    url: str


class LearningTopic(BaseModel):
    topic: str
    why: str
    estimated_hours: Optional[int] = None
    youtube_links: list[LearningResource] = []


class ProfileAnalyzeIn(BaseModel):
    # Text JD is required
    jd_text: str = Field(min_length=1, max_length=60000)

    # Either resume_text OR a resume PDF upload should be provided by the endpoint
    resume_text: Optional[str] = None

    # Optional overrides (defaults to user's profile on server)
    domain: Optional[str] = None
    role: Optional[str] = None
    track: Optional[Track] = None
    level: Optional[Level] = None


class StarRewrite(BaseModel):
    original: str
    rewritten: str
    reasoning: str

class ProfileAnalyzeOut(BaseModel):
    summary: str
    role_fit_score: int = Field(ge=0, le=100)
    
    # New ATS & STAR features
    ats_score: int = Field(default=0, ge=0, le=100)
    ats_warnings: list[str] = Field(default_factory=list)
    star_rewrites: list[StarRewrite] = Field(default_factory=list)

    required_skills: list[SkillRequirement]
    experience_expectations: list[str]

    gap_report: SkillGapReport

    recommended_topics: list[LearningTopic]


# -----------------------------
# 3) AI MCQ Assessment (Legacy / unused placeholders removed)
# -----------------------------



# -----------------------------
# 4) AI Mock Interview
# -----------------------------

class InterviewStartIn(BaseModel):
    track: Track
    level: Level
    interview_type: InterviewType


class InterviewStartOut(BaseModel):
    session_id: int


class InterviewNextIn(BaseModel):
    session_id: int
    # Optionally send the user's last answer to drive follow-ups
    last_answer: Optional[str] = None


class InterviewNextOut(BaseModel):
    qa_item_id: int
    question: str


class InterviewAnswerIn(BaseModel):
    qa_item_id: int
    user_answer: str = Field(min_length=1, max_length=8000)

# -----------------------------
# MCQ API schemas
# -----------------------------

class MCQGenerateIn(BaseModel):
    session_id: int
    skill: str
    topic: str
    difficulty: int = Field(default=3, ge=1, le=3)
    n: int = Field(default=5, ge=1, le=20)


class MCQOut(BaseModel):
    qa_item_id: int
    question: str
    options: list[str]


class MCQGenerateOut(BaseModel):
    mcqs: list[MCQOut]


class MCQSubmitIn(BaseModel):
    qa_item_id: int
    selected: str  # A/B/C/D


class MCQSubmitOut(BaseModel):
    correct: bool
    selected: str
    correct_answer: str
    explanation: str
    overall: int  # 10 if correct else 0


class MCQSkillReportRow(BaseModel):
    skill: str
    attempts: int
    correct: int
    accuracy: float


class MCQReportOut(BaseModel):
    session_id: int
    by_skill: list[MCQSkillReportRow]

# -----------------------------
# 6) Personalized Learning Roadmap
# -----------------------------

class RoadmapTask(BaseModel):
    skill: str
    topic: str
    objective: str
    practice_prompt: str
    resources: list[LearningResource] = []


class RoadmapGenerateIn(BaseModel):
    session_id: Optional[int] = None
    # Optional override target
    domain: Optional[str] = None
    role: Optional[str] = None
    track: Optional[Track] = None
    level: Optional[Level] = None
    horizon_days: int = Field(default=14, ge=3, le=60)


class RoadmapOut(BaseModel):
    summary: str
    tasks: list[RoadmapTask]


# -----------------------------
# 7) Dashboard
# -----------------------------

class DashboardSkillReadiness(BaseModel):
    skill: str
    readiness_percent: float = Field(ge=0, le=100)
    attempts: int
    avg_overall: Optional[float] = None


class DashboardSeriesPoint(BaseModel):
    ts: str  # ISO timestamp
    value: float


class DashboardOut(BaseModel):
    session_id: int
    track: str
    level: str

    overall_readiness_percent: float = Field(ge=0, le=100)

    # Charts-ready series
    mcq_accuracy_series: list["DashboardSeriesPoint"] = []
    interview_score_series: list["DashboardSeriesPoint"] = []

    weak_topics: list["WeakTopicOut"] = []
    skill_readiness: list[DashboardSkillReadiness] = []

class EvaluateIn(BaseModel):
    qa_item_id: int
    user_answer: str = Field(min_length=1, max_length=8000)

class RubricScores(BaseModel):
    correctness: int = Field(ge=0, le=5)
    completeness: int = Field(ge=0, le=5)
    clarity: int = Field(ge=0, le=5)
    depth: int = Field(ge=0, le=5)
    reasoning: int = Field(ge=0, le=5)

class EvaluationJson(BaseModel):
    # Allow fields that begin with "model_" (e.g., model_answer)
    model_config = ConfigDict(protected_namespaces=())

    scores: RubricScores
    overall: float = Field(ge=0, le=5)
    strengths: list[str]
    gaps: list[str]
    improvements: list[str]
    model_answer: str
    next_drill_topic: str

class EvaluateOut(BaseModel):
    overall: float
    evaluation: EvaluationJson

class SessionItemOut(BaseModel):
    id: int
    skill: str
    topic: str
    question_type: str
    difficulty: int
    question: str
    user_answer: Optional[str]
    overall: Optional[float]

class SessionOut(BaseModel):
    id: int
    mode: str
    track: str
    level: str
    items: list[SessionItemOut]

class WeakTopicOut(BaseModel):
    topic: str
    avg_overall: float
    attempts: int

class RoadmapMicroTask(BaseModel):
    topic: str
    drill_prompt: str
    resources: List[str] = Field(default_factory=list)
    expected_output: str


class RoadmapPlan(BaseModel):
    two_week_plan: str
    micro_tasks: List[RoadmapMicroTask] = Field(default_factory=list)


class RoadmapGenerateIn(BaseModel):
    # if session_id is provided -> roadmap for that session
    # else -> roadmap for user profile
    session_id: Optional[int] = None
    duration_days: int = 14


class RoadmapOut(BaseModel):
    id: int
    user_id: int
    session_id: Optional[int] = None
    title: str
    duration_days: int
    plan: RoadmapPlan
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class RoadmapGenerateOut(BaseModel):
    roadmap: RoadmapOut

DashboardOut.model_rebuild()