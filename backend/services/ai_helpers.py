"""
AI-related helper functions: PDF extraction, prompts, JSON parsing.
"""
import io
import shutil
import hashlib
import urllib.parse


def extract_pdf_text(resume_pdf) -> str:
    """Best-effort PDF text extraction.

    Requires either `pypdf` (recommended) or `PyPDF2` installed.
    """
    data = resume_pdf.file.read()
    if not data:
        return ""

    # Try pypdf first
    try:
        from pypdf import PdfReader  # type: ignore

        reader = PdfReader(io.BytesIO(data))
        out = []
        for page in reader.pages:
            txt = page.extract_text() or ""
            if txt.strip():
                out.append(txt)
        return "\n".join(out).strip()
    except Exception:
        pass

    # Try PyPDF2 as fallback
    try:
        from PyPDF2 import PdfReader  # type: ignore

        reader = PdfReader(io.BytesIO(data))
        out = []
        for page in reader.pages:
            txt = page.extract_text() or ""
            if txt.strip():
                out.append(txt)
        return "\n".join(out).strip()
    except Exception:
        pass

    # Try pdfminer.six as a final fallback
    try:
        from pdfminer.high_level import extract_text  # type: ignore

        txt = extract_text(io.BytesIO(data)) or ""
        txt = txt.strip()
        if txt:
            return txt
    except Exception:
        pass

    # OCR fallback for scanned PDFs (image-based). Requires extra deps.
    # pip install pytesseract pdf2image pillow
    # On macOS you may also need: brew install poppler
    try:
        import pytesseract  # type: ignore
        from pdf2image import convert_from_bytes  # type: ignore

        pages = convert_from_bytes(data, fmt="png")
        out = []
        for img in pages:
            text = pytesseract.image_to_string(img) or ""
            if text.strip():
                out.append(text)
        return "\n".join(out).strip()
    except Exception:
        return ""


def ocr_dependency_diagnosis() -> list[str]:
    """Diagnose missing OCR dependencies."""
    issues: list[str] = []

    # Python deps
    try:
        import pytesseract  # type: ignore
    except Exception:
        issues.append("Missing Python package: pytesseract (pip install pytesseract)")

    try:
        import pdf2image  # type: ignore
    except Exception:
        issues.append("Missing Python package: pdf2image (pip install pdf2image)")

    try:
        import PIL  # type: ignore
    except Exception:
        issues.append("Missing Python package: pillow (pip install pillow)")

    # System deps
    if shutil.which("tesseract") is None:
        issues.append("Missing system binary: tesseract (macOS: brew install tesseract)")

    # pdf2image uses poppler tools like pdftoppm/pdftocairo
    if shutil.which("pdftoppm") is None and shutil.which("pdftocairo") is None:
        issues.append("Missing system binary: poppler utils (macOS: brew install poppler)")

    return issues


def youtube_search_url(topic: str) -> str:
    """Generate a YouTube search URL for a topic."""
    q = f"{topic} interview prep"
    return "https://www.youtube.com/results?search_query=" + urllib.parse.quote_plus(q)


def profile_analysis_prompt(jd_text: str, resume_text: str) -> str:
    """Generate the prompt for JD/resume analysis."""
    return f"""
You are a senior tech recruiter + interview coach.

Task:
Analyze the JOB DESCRIPTION and the CANDIDATE RESUME.
Produce a skill-gap analysis, role-fit score, and a study plan to help the candidate crack interviews.

Hard rules:
- Return VALID JSON ONLY (no markdown).
- Be specific and actionable.
- Prefer concrete topic names (e.g., 'SQL joins', 'React hooks', 'System design: caching', 'DSA: two pointers').
- If you infer something, mark it as an inference.

Return JSON with exactly these keys (no extra keys):

1) required_skills: object[]
   - Each object: {{name: string, importance: "must"|"good_to_have", evidence_in_jd: string}}
   - evidence_in_jd should be a short quote or paraphrase from the JD that proves why this skill is required.

2) experience_expectations: string[]
   - Concrete expectations from the JD (years, ownership, architecture scale, leadership, etc.)

3) role_fit_score: number
   - 0–100. Base it on overlap of required_skills + experience_expectations with the resume.

4) gap_report: object
   - {{missing: string[], weak: string[], suggested_projects: {{title: string, stack: string[], why: string, scope_days: number}}[], ats_keywords: string[]}}
   - missing = required skills not present in resume
   - weak = mentioned but insufficient depth/evidence

5) matched_skills: string[]
6) missing_skills: string[]
7) missing_topics: string[]
8) priority_topics: {{topic: string, why: string, difficulty: "easy"|"medium"|"hard", estimated_days: number, drill: string}}[]
9) resume_gaps: string[]
10) resume_improvements: string[]
11) interview_plan_2_weeks: {{day: number, focus: string, tasks: string[]}}[]
12) project_suggestions: {{title: string, stack: string[], why: string, scope_days: number}}[]
13) ats_keywords_to_add: string[]
14) summary: string
15) ats_score: number (0-100 score based on ATS readability, formatting, and keyword optimization)
16) ats_warnings: string[] (list of specific formatting or keyword issues that might hurt ATS parsing)
17) star_rewrites: {{original: string, rewritten: string, reasoning: string}}[]
    - Identify 3 weakest bullet points in the resume that lack impact.
    - Rewrite them using the STAR method (Situation, Task, Action, Result).
    - Provide reasoning for why the rewrite is better.

JOB DESCRIPTION:
{jd_text.strip()}

CANDIDATE RESUME:
{resume_text.strip()}
""".strip()


def extract_first_json_object(text: str) -> str:
    """Extract the first plausible JSON object from a string."""
    if not text:
        return ""
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return ""
    return text[start : end + 1]


def extract_first_json_array(text: str) -> str:
    """Extract the first plausible JSON array from a string."""
    if not text:
        return ""
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1 or end <= start:
        return ""
    return text[start : end + 1]


def normalize_question_for_hash(q: str) -> str:
    """Normalize a question for hashing (deduplication)."""
    return " ".join((q or "").strip().lower().split())


def sha256_hex(s: str) -> str:
    """Compute SHA256 hash of a string."""
    return hashlib.sha256(s.encode("utf-8")).hexdigest()
