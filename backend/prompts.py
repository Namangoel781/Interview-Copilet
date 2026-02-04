RUBRIC = """
Rubric (0-5 each):
- correctness: factual/technical correctness
- completeness: covers key points
- clarity: structured, easy to follow
- depth: edge cases, complexity, tradeoffs where relevant
- reasoning: explains approach/why

Return ONLY valid JSON matching the required schema.
"""

def question_prompt(
    track: str,
    level: str,
    skill: str,
    topic: str,
    qtype: str,
    difficulty: int,
    avoid_questions: list[str] | None = None,
) -> str:
    # Difficulty guidance: keep it simple but explicit.
    diff_band = {
        1: "Very easy (warm-up): fundamentals, minimal edge cases.",
        2: "Easy: one core concept + a couple edge cases.",
        3: "Medium: requires reasoning, tradeoffs, or a non-trivial approach.",
        4: "Hard: multiple constraints, tricky edge cases, performance considerations.",
        5: "Very hard: interview-challenging; requires strong optimization and careful pitfalls.",
    }.get(int(difficulty), "Medium")

    avoid_block = ""
    if avoid_questions:
        trimmed = [q.strip() for q in avoid_questions if q and q.strip()]
        if trimmed:
            # Keep the list short in the prompt.
            trimmed = trimmed[:10]
            avoid_block = (
                "\nDo NOT repeat any of these previous questions (or close paraphrases):\n"
                + "\n".join([f"- {q}" for q in trimmed])
                + "\n"
            )

    return f"""
You are a strict interview question writer for a Software Developer role.

Goal:
- Produce ONE fresh interview question (no repeats) tailored to the candidate and constraints.

Constraints:
- Track: {track}
- Level: {level}
- Skill: {skill}
- Topic: {topic}
- Question type: {qtype}
- Difficulty: {int(difficulty)}/5 → {diff_band}

Quality rules:
- Write exactly ONE question.
- No answers, no hints, no rubric, no 'Expected answer'.
- Must be realistic for interviews and unambiguous.
- The question must be different in angle/setting from prior questions.
- Prefer concrete details (inputs/outputs, constraints) when relevant.

Difficulty control:
- Match the requested difficulty band. Do NOT over-simplify if difficulty >= 4.
- If the question type is 'problem', include clear constraints and what to return.
- If 'scenario', include a realistic scenario and ask what the candidate would do.
- If 'conceptual', ask for explanation + tradeoffs + one example.

Freshness / anti-repeat:
{avoid_block}

Output:
- Plain text only (not JSON).
""".strip()

def evaluate_prompt(skill: str, topic: str, qtype: str, question: str, user_answer: str) -> str:
    return f"""
You are an interview evaluator for Software Developer candidates.

Skill: {skill}
Topic: {topic}
Question type: {qtype}

Question:
{question}

Candidate answer:
{user_answer}

{RUBRIC}

JSON Schema to follow exactly:
{{
  "scores": {{
    "correctness": 0-5,
    "completeness": 0-5,
    "clarity": 0-5,
    "depth": 0-5,
    "reasoning": 0-5
  }},
  "overall": 0-5 (average of the five scores, can be decimal),
  "strengths": ["..."],
  "gaps": ["..."],
  "improvements": ["..."],
  "model_answer": "...",
  "next_drill_topic": "..."
}}

Rules:
- Be specific and point to what is missing.
- If the answer is wrong, explain the correct direction in model_answer.
- next_drill_topic should be a short topic string (e.g., "SQL joins null behavior", "hash map collisions").
Return ONLY JSON.
""".strip()

def hint_prompt(
    skill: str,
    topic: str,
    question_type: str,
    question: str,
    user_answer: str | None,
    hint_level: int,
) -> str:
    """Builds a prompt that asks the model for a concise hint (not a full solution)."""
    level_map = {1: "tiny nudge", 2: "medium hint", 3: "strong hint"}
    strength = level_map.get(int(hint_level or 1), "tiny nudge")

    parts: list[str] = []
    parts.append("You are an interview coach. Provide ONE helpful hint, not the full answer.")
    parts.append("Rules:")
    parts.append("- Do NOT reveal a full solution.")
    parts.append("- Keep it concise (<= 6 lines).")
    parts.append("- If code is needed, give pseudocode or a small snippet only.")
    parts.append("- Focus on approach, edge cases, or common pitfalls.")
    parts.append(f"- Hint strength: {strength}.")
    parts.append("")

    parts.append(f"Skill: {skill}")
    parts.append(f"Topic: {topic}")
    parts.append(f"Question type: {question_type}")
    parts.append("Question:")
    parts.append(question)

    if user_answer:
        parts.append("")
        parts.append("User's current answer draft:")
        parts.append(user_answer)

    parts.append("")
    parts.append("Return the hint as plain text.")
    return "\n".join(parts)


# -----------------------------
# Mock Interview Prompts
# -----------------------------

def interview_start_prompt(
    track: str,
    level: str,
    interview_type: str,
    weak_topics: list[str] | None = None,
    mcq_mistakes: list[str] | None = None,
) -> str:
    """Generate the opening interview question based on user context."""
    weak_block = ""
    if weak_topics:
        weak_block = f"\nCandidate's weak topics (prioritize these): {', '.join(weak_topics[:5])}"
    
    mcq_block = ""
    if mcq_mistakes:
        mcq_block = f"\nRecent MCQ mistakes: {', '.join(mcq_mistakes[:5])}"

    interview_focus = {
        "HR": "behavioral questions, situational judgment, communication skills, teamwork, conflict resolution",
        "Technical": "coding problems, system design, data structures, algorithms, technical depth",
        "Scenario": "real-world scenarios, debugging, architecture decisions, trade-off analysis",
    }.get(interview_type, "general software engineering topics")

    return f"""
You are a senior interviewer conducting a mock {interview_type} interview.

Candidate profile:
- Track: {track}
- Level: {level}
- Interview type: {interview_type}
{weak_block}
{mcq_block}

Focus areas: {interview_focus}

Your task:
1. Generate ONE opening interview question
2. The question should be appropriate for the candidate's level
3. If weak topics are provided, start with those areas
4. Make it conversational and realistic

Rules:
- Be professional but friendly
- Don't reveal the answer
- Keep the question clear and specific
- For Technical: include constraints if relevant
- For HR: use the STAR format context
- For Scenario: describe a realistic situation

Output format:
Return ONLY the question text (no JSON, no metadata).
""".strip()


def interview_followup_prompt(
    track: str,
    level: str,
    interview_type: str,
    difficulty: int,
    conversation_history: list[dict],
    last_answer_quality: str,
) -> str:
    """Generate a follow-up question based on conversation history."""
    
    # Build conversation context
    history_text = ""
    for i, turn in enumerate(conversation_history[-5:], 1):  # Last 5 turns
        q = (turn.get("question") or "")[:200]
        a = (turn.get("answer") or "")[:200]
        score = turn.get("score", "N/A")
        history_text += f"\nTurn {i}:\nQ: {q}\nA: {a}\nScore: {score}\n"

    diff_guidance = {
        1: "Very easy - basics only",
        2: "Easy - single concept",
        3: "Medium - some depth required",
        4: "Hard - multiple concepts, edge cases",
        5: "Very hard - expert level",
    }.get(difficulty, "Medium")

    return f"""
You are continuing a mock {interview_type} interview.

Candidate profile:
- Track: {track}
- Level: {level}
- Current difficulty: {difficulty}/5 ({diff_guidance})

Previous conversation:
{history_text}

Last answer quality: {last_answer_quality}

Your task:
Generate the NEXT interview question that:
1. Builds on the previous conversation naturally
2. If last answer was weak, probe deeper on that topic
3. If last answer was strong, move to a harder/related topic
4. Matches the current difficulty level
5. Feels like a natural interview flow (not random jumps)

Rules:
- Reference previous answers if relevant ("You mentioned X, can you elaborate...")
- Keep it conversational
- Don't repeat questions already asked
- Return ONLY the question text
""".strip()


def interview_evaluate_prompt(
    skill: str,
    topic: str,
    interview_type: str,
    question: str,
    user_answer: str,
    difficulty: int,
) -> str:
    """Evaluate interview answer and suggest next action."""
    return f"""
You are evaluating a mock {interview_type} interview answer.

Context:
- Skill area: {skill}
- Topic: {topic}
- Difficulty: {difficulty}/5
- Interview type: {interview_type}

Question asked:
{question}

Candidate's answer:
{user_answer}

{RUBRIC}

Return JSON with this exact schema:
{{
  "scores": {{
    "correctness": 0-5,
    "completeness": 0-5,
    "clarity": 0-5,
    "depth": 0-5,
    "reasoning": 0-5
  }},
  "overall": 0-5,
  "strengths": ["..."],
  "gaps": ["..."],
  "improvements": ["..."],
  "model_answer": "...",
  "next_drill_topic": "...",
  "should_follow_up": true/false,
  "follow_up_reason": "..." (why we should/shouldn't follow up),
  "difficulty_adjustment": -1/0/+1 (based on answer quality)
}}

Rules:
- should_follow_up = true if answer is incomplete or shows interesting depth to explore
- should_follow_up = false if topic is exhausted or interview should move on
- difficulty_adjustment: +1 if answer was strong, -1 if weak, 0 if okay
- Return ONLY valid JSON
""".strip()


def code_assistance_prompt(
    skill: str,
    topic: str,
    difficulty: str,
    problem_description: str,
    user_code: str,
) -> str:
    """Generate a prompt for code assistance/completion."""
    return f"""
You are an expert pair programmer helping a candidate solve a coding interview problem.

Context:
- Skill: {skill}
- Topic: {topic}
- Difficulty: {difficulty}

Problem Description:
{problem_description}

User's Current Code:
{user_code}

Your Task:
Provide a helpful code suggestion to move the user forward.
1. If the code is empty, suggest a starting template or structure.
2. If the code is partial, suggest the next logical block or complete the current function.
3. If the code has errors, suggest a fix.
4. Do NOT solve the entire problem unless the user is very close or it's a small utility. Focus on unblocking.

Output Format:
Return ONLY valid JSON with this structure:
{{
    "suggestion_code": "...",  // The actual python code snippet to insert or replace
    "explanation": "..."       // Brief explanation of what this code does or why it helps
}}
""".strip()