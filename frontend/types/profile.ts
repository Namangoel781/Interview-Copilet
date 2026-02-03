export type Difficulty = "easy" | "medium" | "hard";

export type PriorityTopic = {
  topic: string;
  why: string;
  difficulty: Difficulty;
  estimated_days: number;
  drill: string;
};

export type InterviewDayPlan = {
  day: number;
  focus: string;
  tasks: string[];
};

export type ProjectSuggestion = {
  title: string;
  stack: string[];
  why: string;
  scope_days: number;
};

export type RequiredSkill = {
  name: string;
  importance: "must" | "good_to_have";
  evidence_in_jd: string;
};

export type GapReport = {
  missing: string[];
  weak: string[];
  suggested_projects: any[];
  ats_keywords: string[];
};

export type StarRewrite = {
  original: string;
  rewritten: string;
  reasoning: string;
};

export interface ProfileAnalyzeOut {
  summary: string;
  role_fit_score?: number; // 0-100
  required_skills?: RequiredSkill[];
  experience_expectations?: string[];
  gap_report?: GapReport;
  matched_skills: string[];
  missing_skills: string[];
  missing_topics: string[];
  youtube_links?: { topic: string; url: string }[];
  priority_topics?: { topic: string; difficulty: string; estimated_days: number; why: string; drill: string }[];
  interview_plan_2_weeks?: { day: number; focus: string; tasks: string[] }[];
  resume_gaps: string[];
  resume_improvements: string[];
  ats_keywords_to_add: string[];
  project_suggestions?: { title: string; why: string; stack: string[]; scope_days: number }[];
  // New ATS & STAR features
  ats_score?: number;
  ats_warnings?: string[];
  star_rewrites?: StarRewrite[];
}
