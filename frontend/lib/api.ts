// frontend/lib/api.ts
import type {
  CreateSessionIn,
  CreateSessionOut,
  GenerateQuestionIn,
  GenerateQuestionOut,
  EvaluateIn,
  EvaluateOut,
  WeakTopic,
} from "@/types/copilot";

import type { ProfileAnalyzeOut } from "@/types/profile";

export type ProfileSetupIn = {
  domain?: string | null;
  role?: string | null;
  track?: string | null;
  level?: string | null;
};

export type ProfileMeOut = {
  id: number;
  email: string;
  domain: string | null;
  role: string | null;
  track: string | null;
  level: string | null;
};

export type SessionSummaryOut = {
  id: number;
  mode: string;
  track: string;
  level: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ActiveSessionOut = {
  session_id: number;
};

// Keep it loose unless you have a strong DashboardOut type in your project.
export type DashboardOut = any;

// --- MCQ types (match your new backend routes) ---
export type MCQOptionLetter = "A" | "B" | "C" | "D";

export type MCQGenerateIn = {
  session_id: number;
  skill: string;
  topic: string; // ✅ required by backend
  difficulty?: number | null; // 1 easy, 2 medium, 3 hard
  n?: number | null;
};

export type MCQItemOut = {
  qa_item_id: number;
  question: string;
  options: string[]; // ["A ...", "B ...", "C ...", "D ..."] or raw option strings
};

export type MCQGenerateOut = {
  mcqs: MCQItemOut[];
};

export type MCQSubmitIn = {
  qa_item_id: number;
  selected: MCQOptionLetter;
};

export type MCQSubmitOut = {
  correct: boolean;
  selected: MCQOptionLetter;
  correct_answer: MCQOptionLetter;
  explanation: string | null;
  overall?: number | null;
};

export type MCQReportRow = {
  skill: string;
  attempts: number;
  correct: number;
  accuracy: number; // 0..1
};

export type MCQReportOut = {
  session_id: number;
  by_skill: MCQReportRow[];
};

/** -------------------------
 * Interview routes
 * ------------------------- */
export type InterviewStartIn = {
  track: string;
  level: string;
  interview_type: "HR" | "Technical" | "Scenario";
};

export type InterviewStartOut = {
  session_id: number;
  first_question: string;
  qa_item_id: number;
};

export type InterviewNextIn = {
  session_id: number;
};

export type InterviewNextOut = {
  qa_item_id: number;
  question: string;
  is_follow_up: boolean;
  turn_count: number;
};

export type InterviewAnswerIn = {
  qa_item_id: number;
  user_answer: string;
};

export type InterviewEvaluation = {
  scores: Record<string, number>;
  overall: number;
  strengths: string[];
  gaps: string[];
  improvements: string[];
  model_answer: string;
};

export type InterviewAnswerOut = {
  evaluation: InterviewEvaluation;
  follow_up_question?: string | null;
  follow_up_qa_item_id?: number | null;
  interview_complete: boolean;
  current_difficulty: number;
  turn_count: number;
};

// Safer default for local dev if env var isn't set.
const BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000";

// --- Auth token helpers (localStorage) ---
const TOKEN_KEY = "access_token";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string) {
  if (typeof window === "undefined") return;
  if (!token) return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

export function clearAuthToken() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

function pickFastApiDetail(payload: any): string | null {
  // FastAPI commonly returns { detail: "..." } or { detail: [{...}] }
  const d = payload?.detail;
  if (!d) return null;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    const msgs = d
      .map((x) => x?.msg)
      .filter(Boolean)
      .slice(0, 4);
    if (msgs.length) return msgs.join(" | ");
  }
  return null;
}

function compactObject<T extends Record<string, any>>(obj: T): Partial<T> {
  // Remove null/undefined keys so FastAPI/Pydantic doesn't see invalid values
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (v === undefined || v === null) continue;
    out[k] = v;
  }
  return out as Partial<T>;
}

function jsonBody(obj: any): string {
  return JSON.stringify(compactObject(obj ?? {}));
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const json = await res.clone().json();
    return (
      pickFastApiDetail(json) ||
      json?.error?.message ||
      json?.message ||
      JSON.stringify(json)
    );
  } catch {
    const text = await res.text().catch(() => "");
    return text || `Request failed: ${res.status}`;
  }
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? undefined);

  // Attach bearer token if present and caller didn't already set Authorization.
  const token = getAuthToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Only set JSON content-type when we're actually sending JSON and caller didn't override.
  const hasBody = init?.body !== undefined && init?.body !== null;
  const isStringBody = typeof init?.body === "string";
  if (hasBody && isStringBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearAuthToken();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    const msg = await readErrorMessage(res);
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }

  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

// IMPORTANT: Do NOT set Content-Type for FormData; browser sets correct boundary.
async function httpForm<T>(
  path: string,
  form: FormData,
  init?: RequestInit
): Promise<T> {
  const headers = new Headers(init?.headers ?? undefined);
  const token = getAuthToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    body: form,
    ...init,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearAuthToken();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    const msg = await readErrorMessage(res);
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }

  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export const api = {
  health: () => http<{ ok: boolean }>("/health"),

  // --- Auth ---
  signup: async (body: { email: string; password: string }) => {
    const res = await http<{
      token?: string;
      access_token?: string;
      user?: { id: number; email: string };
    }>("/auth/signup", {
      method: "POST",
      body: jsonBody(body),
    });

    const token = res.token ?? res.access_token ?? "";
    if (token) setAuthToken(token);

    return {
      token,
      user: res.user ?? { id: 0, email: body.email },
    };
  },

  login: async (body: { email: string; password: string }) => {
    const res = await http<{
      token?: string;
      access_token?: string;
      user?: { id: number; email: string };
    }>("/auth/login", {
      method: "POST",
      body: jsonBody(body),
    });

    const token = res.token ?? res.access_token ?? "";
    if (token) setAuthToken(token);

    return {
      token,
      user: res.user ?? { id: 0, email: body.email },
    };
  },

  // --- Sessions ---
  createSession: (body: CreateSessionIn) =>
    http<CreateSessionOut>("/session", {
      method: "POST",
      body: jsonBody(body),
    }),

  // Keep loose typing to avoid breakage if SessionOut shape changes
  getSession: (sessionId: number) => http<any>(`/session/${sessionId}`),

  listSessions: () => http<SessionSummaryOut[]>(`/sessions`, { method: "GET" }),

  getActiveSession: () =>
    http<ActiveSessionOut>(`/sessions/active`, { method: "GET" }),

  // --- Core QA ---
  generateQuestion: (body: GenerateQuestionIn) =>
    http<GenerateQuestionOut>("/question", {
      method: "POST",
      body: jsonBody(body),
    }),

  evaluate: (body: EvaluateIn) =>
    http<EvaluateOut>("/evaluate", {
      method: "POST",
      body: jsonBody(body),
    }),

  getHint: (body: {
    qa_item_id: number;
    user_answer: string | null;
    hint_level: 1 | 2 | 3;
  }) =>
    http<{ hint: string | null }>("/hint", {
      method: "POST",
      body: jsonBody(body),
    }),

  weakTopics: (sessionId: number) =>
    http<WeakTopic[]>(`/weak-topics/${sessionId}`, { method: "GET" }),

  // --- Dashboard ---
  dashboard: () => http<DashboardOut>(`/dashboard/me`, { method: "GET" }),

  // --- Profile ---
  profileSetup: (body: ProfileSetupIn) =>
    http<ProfileMeOut>("/profile/setup", {
      method: "POST",
      body: jsonBody(body),
    }),

  profileMe: () => http<ProfileMeOut>("/profile/me", { method: "GET" }),

  profileAnalyze: (payload: {
    jd_text: string;
    resume_pdf?: File | null;
    resume_text?: string | null;
  }) => {
    const fd = new FormData();
    fd.append("jd_text", payload.jd_text);

    if (payload.resume_text?.trim())
      fd.append("resume_text", payload.resume_text.trim());
    if (payload.resume_pdf) fd.append("resume_pdf", payload.resume_pdf);

    return httpForm<ProfileAnalyzeOut>("/profile/analyze", fd);
  },

  mcqGenerate: (body: MCQGenerateIn) =>
    http<MCQGenerateOut>("/mcq/generate", {
      method: "POST",
      body: jsonBody({
        ...body,
        topic: (body.topic ?? "").trim(), // ✅ always a string
      }),
    }),

  mcqSubmit: (body: MCQSubmitIn) =>
    http<MCQSubmitOut>("/mcq/submit", {
      method: "POST",
      body: jsonBody(body),
    }),

  mcqReport: (sessionId: number) =>
    http<MCQReportOut>(`/mcq/report/${sessionId}`, { method: "GET" }),

  interviewStart: (body: InterviewStartIn) =>
    http<InterviewStartOut>("/interview/start", {
      method: "POST",
      body: jsonBody(body),
    }),

  interviewNext: (body: InterviewNextIn) =>
    http<InterviewNextOut>("/interview/next", {
      method: "POST",
      body: jsonBody(body),
    }),

  interviewAnswer: (body: InterviewAnswerIn) =>
    http<InterviewAnswerOut>("/interview/answer", {
      method: "POST",
      body: jsonBody(body),
    }),
};
