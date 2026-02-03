export type Mode = "learn" | "interview";
export type Track = "backend" | "frontend" | "fullstack";
export type Level = "beginner" | "intermediate" | "advanced";

export type Skill =
  | "SQL"
  | "DSA"
  | "SystemDesign"
  | "React"
  | "Nextjs"
  | "TypeScript"
  | "JavaScript"
  | "HTML"
  | "CSS"
  | "WebPerformance"
  | "Testing";

export const SKILLS_BY_TRACK: Record<Track, Skill[]> = {
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

export type QuestionType = "conceptual" | "scenario" | "problem";

export type CreateSessionIn = { mode: Mode; track: Track; level: Level };
export type CreateSessionOut = { session_id: number };

export type GenerateQuestionIn = {
  session_id: number;
  skill: Skill;
  topic: string;
  question_type: QuestionType;
  difficulty: number; // 1-5
};
export type GenerateQuestionOut = { qa_item_id: number; question: string };

export type EvaluationJson = {
  scores: {
    correctness: number;
    completeness: number;
    clarity: number;
    depth: number;
    reasoning: number;
  };
  overall: number;
  strengths: string[];
  gaps: string[];
  improvements: string[];
  model_answer: string;
  next_drill_topic: string;
};

export type EvaluateIn = { qa_item_id: number; user_answer: string };
export type EvaluateOut = { overall: number; evaluation: EvaluationJson };

export type WeakTopic = { topic: string; avg_overall: number; attempts: number };

export type DashboardHistoryItem = {
  id: number;
  skill: Skill;
  topic: string;
  question_type: QuestionType;
  difficulty: number;
  overall: number | null;
  created_at?: string;
};

export type DashboardSkillAgg = {
  skill: Skill;
  avg_overall: number | null;
  attempts: number;
};

export type DashboardOut = {
  session_id: number;
  questions_total: number;
  answered: number;
  avg_overall: number | null;
  history: DashboardHistoryItem[];
  weak_topics: WeakTopic[];
  by_skill: DashboardSkillAgg[];
};

export type SessionItem = {
  id: number;
  skill: Skill;
  topic: string;
  question_type: QuestionType;
  difficulty: number; // 1-5
  question: string;
  user_answer: string | null;
  overall: number | null;
  evaluation: EvaluationJson | null;
  created_at?: string;
};

export type SessionOut = {
  id: number;
  mode: Mode;
  track: Track;
  level: Level;
  created_at?: string;
  items: SessionItem[];
};