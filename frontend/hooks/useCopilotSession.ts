"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Mode, Track, Level, Skill, QuestionType, EvaluationJson } from "@/types/copilot";

const SKILLS_BY_TRACK: Record<Track, Skill[]> = {
  backend: ["SQL", "DSA", "SystemDesign"],
  frontend: [
    "React",
    "Nextjs",
    "TypeScript",
    "JavaScript",
    "HTML",
    "CSS",
    "WebPerformance",
    "Testing",
  ],
  fullstack: [
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
};

const DEFAULT_TOPIC_BY_SKILL: Record<Skill, string> = {
  SQL: "joins",
  DSA: "arrays",
  SystemDesign: "caching",
  React: "hooks",
  Nextjs: "routing",
  TypeScript: "types",
  JavaScript: "closures",
  HTML: "semantic HTML",
  CSS: "flexbox",
  WebPerformance: "Core Web Vitals",
  Testing: "unit testing",
};

function normalizeError(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const anyErr = e as any;
    return anyErr?.message || anyErr?.detail || "Request failed";
  }
  return "Request failed";
}

export function useCopilotSession() {
  const [mode, setMode] = useState<Mode>("interview");
  const [track, setTrack] = useState<Track>("backend");
  const [level, setLevel] = useState<Level>("intermediate");

  const [skill, setSkill] = useState<Skill>("SQL");
  const [topic, setTopic] = useState("joins");
  const [questionType, setQuestionType] = useState<QuestionType>("scenario");
  const [difficulty, setDifficulty] = useState(3);

  const [sessionId, setSessionId] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [qaItemId, setQaItemId] = useState<number | null>(null);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<EvaluationJson | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);

  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Keep skill/topic aligned with track so the backend enum validation never fails.
  useEffect(() => {
    const allowed = SKILLS_BY_TRACK[track];
    if (!allowed.includes(skill)) {
      const nextSkill = allowed[0];
      setSkill(nextSkill);
      setTopic(DEFAULT_TOPIC_BY_SKILL[nextSkill] ?? "");
      return;
    }
    // If skill is allowed but topic is empty, seed a sensible default.
    if (!topic.trim()) {
      setTopic(DEFAULT_TOPIC_BY_SKILL[skill] ?? "");
    }
  }, [track]);

  // If user changes skill manually, seed topic only if topic is empty.
  useEffect(() => {
    if (!topic.trim()) setTopic(DEFAULT_TOPIC_BY_SKILL[skill] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skill]);
  
  // Load persisted session id once on mount so Dashboard can see the active session.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("copilot_session_id");
    if (raw) {
      const n = Number(raw);
      if (!Number.isNaN(n) && n > 0) setSessionId(n);
    }
    setHydrated(true);
  }, []);

  // Persist session id whenever it changes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hydrated) return;
    if (sessionId) window.localStorage.setItem("copilot_session_id", String(sessionId));
    else window.localStorage.removeItem("copilot_session_id");
  }, [sessionId, hydrated]);

  const canGenerateQuestion = useMemo(() => sessionId !== null && !loading, [sessionId, loading]);
  const canEvaluate = useMemo(() => qaItemId !== null && answer.trim().length > 0 && !loading, [qaItemId, answer, loading]);

  async function createSession() {
    setError(null);
    setLoading("Creating session...");
    setEvaluation(null);
    setQuestion("");
    setAnswer("");
    setQaItemId(null);
    setHint(null);
    setHintLoading(false);

    try {
      const out = await api.createSession({ mode, track, level });
      setSessionId(out.session_id);
    } catch (e) {
      setError(normalizeError(e));
    } finally {
      setLoading(null);
    }
  }

  async function generateQuestion() {
    if (!sessionId) return;
    setError(null);
    setLoading("Generating question...");
    setEvaluation(null);
    setQuestion("");
    setAnswer("");
    setQaItemId(null);
    setHint(null);
    setHintLoading(false);

    try {
      // Safety: if skill became invalid for the chosen track, auto-correct before calling backend.
      const allowed = SKILLS_BY_TRACK[track];
      const safeSkill = allowed.includes(skill) ? skill : allowed[0];
      const safeTopic = topic?.trim() ? topic : (DEFAULT_TOPIC_BY_SKILL[safeSkill] ?? "");

      const out = await api.generateQuestion({
        session_id: sessionId,
        skill: safeSkill,
        topic: safeTopic,
        question_type: questionType,
        difficulty,
      });

      setQaItemId(out.qa_item_id);
      setQuestion(out.question);
    } catch (e) {
      setError(normalizeError(e));
    } finally {
      setLoading(null);
    }
  }

  async function evaluateAnswer() {
    if (!qaItemId) return;
    setError(null);
    setLoading("Evaluating...");

    try {
      const out = await api.evaluate({ qa_item_id: qaItemId, user_answer: answer });
      setEvaluation(out.evaluation);
    } catch (e) {
      setError(normalizeError(e));
    } finally {
      setLoading(null);
    }
  }

  async function getHint(level: 1 | 2 | 3 = 1) {
    if (!qaItemId) return;
    setError(null);
    setHintLoading(true);
    try {
      const out = await api.getHint({
        qa_item_id: qaItemId,
        user_answer: answer || null,
        hint_level: level,
      });
      setHint(out.hint ?? null);
    } catch (e) {
      setError(normalizeError(e));
    } finally {
      setHintLoading(false);
    }
  }

  function resetForNext() {
    setAnswer("");
    setEvaluation(null);
  }

  return {
    // config
    mode, setMode,
    track, setTrack,
    level, setLevel,
    skill, setSkill,
    topic, setTopic,
    questionType, setQuestionType,
    difficulty, setDifficulty,

    // session
    hydrated,
    sessionId, qaItemId,
    question, answer, setAnswer,
    evaluation,
    hint,
    hintLoading,

    // ui state
    loading, error,
    canGenerateQuestion, canEvaluate,

    // actions
    createSession,
    generateQuestion,
    evaluateAnswer,
    getHint,
    resetForNext,
  };
}