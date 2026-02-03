"use client";

import * as React from "react";
import { api } from "@/lib/api";
import type {
  InterviewStartIn,
  InterviewStartOut,
  InterviewNextOut,
  InterviewAnswerOut,
} from "@/lib/api";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type ChatItem =
  | {
      kind: "question";
      qa_item_id: number;
      text: string;
      meta?: { is_follow_up?: boolean; turn_count?: number; difficulty?: string };
    }
  | { kind: "answer"; text: string }
  | { kind: "evaluation"; evaluation: InterviewAnswerOut["evaluation"] };

type Level = "beginner" | "intermediate" | "advanced";

function coerceLevel(v: unknown): Level {
  if (v === "beginner" || v === "intermediate" || v === "advanced") return v;
  // fallback if backend ever returns numeric difficulty
  if (typeof v === "number") {
    if (v <= 1) return "beginner";
    if (v === 2) return "intermediate";
    return "advanced";
  }
  return "intermediate";
}

const TRACKS = ["Backend", "Frontend", "FullStack"] as const;
const INTERVIEW_TYPES = ["HR", "Technical", "Scenario"] as const;

function clamp01(v: number) {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

export default function InterviewClient() {
  // --- Setup state
  const [track, setTrack] = React.useState<string>("Backend");
  const [level, setLevel] = React.useState<Level>("intermediate");
  const [interviewType, setInterviewType] =
    React.useState<InterviewStartIn["interview_type"]>("Technical");

  // --- Interview runtime state
  const [sessionId, setSessionId] = React.useState<number | null>(null);
  const [currentQaId, setCurrentQaId] = React.useState<number | null>(null);
  const [answer, setAnswer] = React.useState<string>("");

  const [chat, setChat] = React.useState<ChatItem[]>([]);
  const [turnCount, setTurnCount] = React.useState<number>(0);
  const [currentDifficulty, setCurrentDifficulty] = React.useState<Level>(level);

  // --- UI state
  const [busy, setBusy] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const hasActive = sessionId !== null && currentQaId !== null;
  const overallProgress = clamp01(turnCount / 10) * 100;

  async function startInterview() {
    setError(null);
    setBusy(true);
    try {
      const payload: InterviewStartIn = {
        track,
        level,
        interview_type: interviewType,
      };

      const res: InterviewStartOut = await api.interviewStart(payload);

      setSessionId(res.session_id);
      setCurrentQaId(res.qa_item_id);
      setTurnCount(1);
      setCurrentDifficulty(level);

      setChat([
        {
          kind: "question",
          qa_item_id: res.qa_item_id,
          text: res.first_question,
          meta: { is_follow_up: false, turn_count: 1, difficulty: level },
        },
      ]);
      setAnswer("");
    } catch (e: any) {
      setError(e?.message ?? "Failed to start interview");
    } finally {
      setBusy(false);
    }
  }

  async function fetchNextQuestion(sid: number) {
    const next: InterviewNextOut = await api.interviewNext({ session_id: sid });

    setCurrentQaId(next.qa_item_id);
    setTurnCount(next.turn_count);

    setChat((prev) => [
      ...prev,
      {
        kind: "question",
        qa_item_id: next.qa_item_id,
        text: next.question,
        meta: {
          is_follow_up: next.is_follow_up,
          turn_count: next.turn_count,
          difficulty: currentDifficulty,
        },
      },
    ]);

    setAnswer("");
  }

  async function submitAnswer() {
    setError(null);

    if (!hasActive || sessionId === null || currentQaId === null) {
      setError("No active interview. Please start again.");
      return;
    }

    const trimmed = answer.trim();
    if (!trimmed) {
      setError("Please write an answer before submitting.");
      return;
    }

    setBusy(true);
    try {
      setChat((prev) => [...prev, { kind: "answer", text: trimmed }]);

      const res: InterviewAnswerOut = await api.interviewAnswer({
        qa_item_id: currentQaId,
        user_answer: trimmed,
      });

      if (res.evaluation) {
        setChat((prev) => [...prev, { kind: "evaluation", evaluation: res.evaluation }]);
      }

      const nextLevel = coerceLevel(res.current_difficulty);
      setCurrentDifficulty(nextLevel);
      setTurnCount(res.turn_count);

      if (res.follow_up_question && res.follow_up_qa_item_id) {
        setCurrentQaId(res.follow_up_qa_item_id);
        setChat((prev) => [
          ...prev,
          {
            kind: "question",
            qa_item_id: res.follow_up_qa_item_id!,
            text: res.follow_up_question!,
            meta: { is_follow_up: true, turn_count: res.turn_count, difficulty: nextLevel },
          },
        ]);
        setAnswer("");
        return;
      }

      if (res.interview_complete) {
        setCurrentQaId(null);
        setAnswer("");
        return;
      }

      await fetchNextQuestion(sessionId);
    } catch (e: any) {
      setError(e?.message ?? "Failed to submit answer");
    } finally {
      setBusy(false);
    }
  }

  function resetInterview() {
    setSessionId(null);
    setCurrentQaId(null);
    setAnswer("");
    setChat([]);
    setTurnCount(0);
    setCurrentDifficulty(level);
    setError(null);
  }

  return (
    <div className="space-y-6">
      {/* ... unchanged above ... */}

      {!hasActive ? (
        <Card>
          <CardHeader>
            <CardTitle>Setup</CardTitle>
            <CardDescription>Pick your track, difficulty level, and interview style.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              {/* Track */}
              <div className="space-y-2">
                <Label>Track</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={track}
                  onChange={(e) => setTrack(e.target.value)}
                >
                  {TRACKS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* ✅ Level */}
              <div className="space-y-2">
                <Label>Level</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={level}
                  onChange={(e) => setLevel(e.target.value as Level)}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              {/* Interview Type */}
              <div className="space-y-2">
                <Label>Interview Type</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={interviewType}
                  onChange={(e) => setInterviewType(e.target.value as InterviewStartIn["interview_type"])}
                >
                  {INTERVIEW_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={startInterview} disabled={busy}>
                {busy ? "Starting..." : "Start Interview"}
              </Button>
              {chat.length > 0 && (
                <Button variant="outline" onClick={resetInterview} disabled={busy}>
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Live Interview</CardTitle>
              <CardDescription>Answer the question. You’ll get evaluation + follow-ups.</CardDescription>
            </div>
            <Button variant="outline" onClick={resetInterview} disabled={busy}>
              End Interview
            </Button>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-4">
              {chat.map((item, idx) => (
                <div key={idx}>
                  {item.kind === "question" && (
                    <div className="rounded-lg border bg-card p-4">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge>Question</Badge>
                        {item.meta?.is_follow_up && <Badge variant="secondary">Follow-up</Badge>}
                        {typeof item.meta?.turn_count === "number" && (
                          <Badge variant="outline">Turn {item.meta.turn_count}</Badge>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6">{item.text}</p>
                    </div>
                  )}

                  {item.kind === "answer" && (
                    <div className="rounded-lg border bg-muted/40 p-4">
                      <div className="mb-2">
                        <Badge variant="secondary">Your answer</Badge>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6">{item.text}</p>
                    </div>
                  )}

                  {item.kind === "evaluation" && (
                    <div className="rounded-lg border p-4">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge>Evaluation</Badge>
                        <Badge variant="outline">Overall {item.evaluation.overall}/10</Badge>
                      </div>

                      <Separator className="my-3" />

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <h3 className="mb-1 text-sm font-semibold">Strengths</h3>
                          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                            {item.evaluation.strengths?.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h3 className="mb-1 text-sm font-semibold">Improvements</h3>
                          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                            {item.evaluation.improvements?.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <Separator className="my-3" />

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <h3 className="mb-1 text-sm font-semibold">Gaps</h3>
                          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                            {item.evaluation.gaps?.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <h3 className="mb-1 text-sm font-semibold">Scores</h3>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(item.evaluation.scores ?? {}).map(([k, v]) => (
                              <Badge key={k} variant="secondary">
                                {k}: {v}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      <Separator className="my-3" />

                      <div>
                        <h3 className="mb-1 text-sm font-semibold">Ideal Answer</h3>
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-6">
                          {item.evaluation.model_answer}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Your response</Label>
              <Textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Write your answer here..."
                className="min-h-30"
              />
              <div className="flex items-center gap-2">
                <Button onClick={submitAnswer} disabled={busy}>
                  {busy ? "Submitting..." : "Submit Answer"}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || sessionId === null}
                  onClick={() => sessionId !== null && fetchNextQuestion(sessionId)}
                >
                  Skip / Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tips</CardTitle>
          <CardDescription>Quick rules for scoring high.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• Use structure: define → approach → edge cases → complexity → final answer.</p>
          <p>• Give examples and tradeoffs (especially for System Design / scenario questions).</p>
          <p>• Keep answers concise and correct; clarity is scored.</p>
        </CardContent>
      </Card>
    </div>
  );
}