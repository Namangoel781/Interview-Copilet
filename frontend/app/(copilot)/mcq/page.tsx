"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type MCQOptionLetter, type MCQItemOut } from "@/lib/api";
import { AuthGate } from "@/components/auth/AuthGate";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Difficulty = 1 | 2 | 3;

function toLetter(i: number): MCQOptionLetter {
  return (["A", "B", "C", "D"][i] ?? "A") as MCQOptionLetter;
}

function normalizeOptions(options: string[]) {
  // backend may return ["A ...", "B ..."] OR ["Option text", ...]
  return options.map((opt, idx) => {
    const trimmed = opt.trim();
    const letter = toLetter(idx);
    // If already prefixed like "A) ..." or "A ..."
    const looksPrefixed = /^[A-D][\).:\s-]/.test(trimmed);
    return {
      letter,
      text: looksPrefixed ? trimmed.replace(/^[A-D][\).:\s-]+/, "").trim() : trimmed,
    };
  });
}

export default function MCQPage() {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);

  // generate inputs
  const [skill, setSkill] = useState<string>("React");
  const [topic, setTopic] = useState<string>("");
  const [difficulty, setDifficulty] = useState<Difficulty>(2);
  const [n, setN] = useState<number>(5);

  // mcq state
  const [mcqs, setMcqs] = useState<MCQItemOut[]>([]);
  const [idx, setIdx] = useState<number>(0);
  const [selected, setSelected] = useState<MCQOptionLetter | null>(null);

  // feedback
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState<MCQOptionLetter | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);

  // score
  const [correctCount, setCorrectCount] = useState(0);

  // report
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<{ skill: string; attempts: number; correct: number; accuracy: number }[] | null>(null);

  const current = mcqs[idx] ?? null;
  const normalizedOptions = useMemo(() => (current ? normalizeOptions(current.options) : []), [current]);

  useEffect(() => {
    (async () => {
      try {
        setLoadingSession(true);
        const s = await api.getActiveSession();
        setSessionId(s.session_id);
      } catch {
        setSessionId(null);
      } finally {
        setLoadingSession(false);
      }
    })();
  }, []);

  async function onGenerate() {
    if (!sessionId) return;

    // reset run
    setMcqs([]);
    setIdx(0);
    setSelected(null);
    setSubmitted(false);
    setIsCorrect(null);
    setCorrectAnswer(null);
    setExplanation(null);
    setCorrectCount(0);
    setReport(null);

    const topicStr = topic.trim();

    const out = await api.mcqGenerate({
      session_id: sessionId,
      skill,
      topic: topicStr, // ✅ always string
      difficulty,
      n,
    });

    setMcqs(out.mcqs ?? []);
  }

  async function onSubmit() {
    if (!current || !selected) return;
    setSubmitting(true);
    try {
      const out = await api.mcqSubmit({
        qa_item_id: current.qa_item_id,
        selected,
      });

      setSubmitted(true);
      setIsCorrect(out.correct);
      setCorrectAnswer(out.correct_answer);
      setExplanation(out.explanation ?? null);

      if (out.correct) setCorrectCount((c) => c + 1);
    } finally {
      setSubmitting(false);
    }
  }

  function onNext() {
    setIdx((i) => i + 1);
    setSelected(null);

    setSubmitted(false);
    setIsCorrect(null);
    setCorrectAnswer(null);
    setExplanation(null);
  }

  async function loadReport() {
    if (!sessionId) return;
    setReportLoading(true);
    try {
      const out = await api.mcqReport(sessionId);
      setReport(out.by_skill ?? []);
    } finally {
      setReportLoading(false);
    }
  }

  const finished = mcqs.length > 0 && idx >= mcqs.length;

  return (
    <AuthGate>
      <div className="min-h-screen bg-linear-to-b from-background to-muted/25">
        <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">MCQ Practice</h1>
              <p className="text-sm text-muted-foreground">
                Generate MCQs per skill/topic and get instant explanations. Uses your backend routes:
                <span className="ml-2 font-mono text-xs">/mcq/generate</span>,{" "}
                <span className="font-mono text-xs">/mcq/submit</span>,{" "}
                <span className="font-mono text-xs">/mcq/report</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              {loadingSession ? (
                <Badge variant="secondary">Loading session…</Badge>
              ) : sessionId ? (
                <Badge variant="secondary">Session #{sessionId}</Badge>
              ) : (
                <Badge variant="destructive">No active session</Badge>
              )}
            </div>
          </div>

          {/* Generate */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Generate MCQs</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Skill</Label>
                <Select value={skill} onValueChange={setSkill}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select skill" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Add/adjust based on your backend Skill enum */}
                    <SelectItem value="SQL">SQL</SelectItem>
                    <SelectItem value="DSA">DSA</SelectItem>
                    <SelectItem value="SystemDesign">System Design</SelectItem>
                    <SelectItem value="React">React</SelectItem>
                    <SelectItem value="Nextjs">Next.js</SelectItem>
                    <SelectItem value="TypeScript">TypeScript</SelectItem>
                    <SelectItem value="JavaScript">JavaScript</SelectItem>
                    <SelectItem value="HTML">HTML</SelectItem>
                    <SelectItem value="CSS">CSS</SelectItem>
                    <SelectItem value="WebPerformance">Web Performance</SelectItem>
                    <SelectItem value="Testing">Testing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Topic (optional)</Label>
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Hooks, SQL joins, BFS/DFS…"
                />
              </div>

              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label>Difficulty</Label>
                  <Select
                    value={String(difficulty)}
                    onValueChange={(v) => setDifficulty((Number(v) as Difficulty) ?? 2)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Easy</SelectItem>
                      <SelectItem value="2">Medium</SelectItem>
                      <SelectItem value="3">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Count</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={n}
                    onChange={(e) => setN(Math.max(1, Math.min(20, Number(e.target.value || 5))))}
                  />
                </div>
              </div>

              <div className="md:col-span-4 flex gap-2">
                <Button onClick={onGenerate} disabled={!sessionId}>
                  Generate
                </Button>
                <Button variant="outline" onClick={loadReport} disabled={!sessionId || reportLoading}>
                  {reportLoading ? "Loading…" : "Load Report"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* MCQ runner */}
          {!mcqs.length ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Generate MCQs to start.
              </CardContent>
            </Card>
          ) : finished ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Completed</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">
                    Score: {correctCount} / {mcqs.length}
                  </Badge>
                  <Badge variant="outline">
                    Accuracy: {Math.round((correctCount / mcqs.length) * 100)}%
                  </Badge>
                </div>

                <Button onClick={loadReport} variant="outline" disabled={!sessionId || reportLoading}>
                  {reportLoading ? "Loading report…" : "Refresh MCQ Report"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-primary/15">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">Question {idx + 1} / {mcqs.length}</CardTitle>
                  <Badge variant="outline">
                    Correct so far: {correctCount}/{idx}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="text-base font-medium leading-relaxed">{current?.question}</div>

                <RadioGroup
                  value={selected ?? ""}
                  onValueChange={(v) => setSelected(v as MCQOptionLetter)}
                  className="space-y-2"
                  disabled={submitted}
                >
                  {normalizedOptions.map((o) => {
                    const isRight = submitted && correctAnswer === o.letter;
                    const isChosen = submitted && selected === o.letter;
                    return (
                      <label
                        key={o.letter}
                        className={[
                          "flex items-start gap-3 rounded-md border p-3 cursor-pointer",
                          isRight ? "border-green-500/40 bg-green-500/5" : "",
                          isChosen && !isRight ? "border-red-500/40 bg-red-500/5" : "",
                        ].join(" ")}
                      >
                        <RadioGroupItem value={o.letter} id={`opt-${o.letter}`} />
                        <div className="space-y-1">
                          <div className="text-sm">
                            <span className="font-semibold mr-2">{o.letter}.</span>
                            {o.text}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </RadioGroup>

                <div className="flex flex-wrap gap-2">
                  {!submitted ? (
                    <Button onClick={onSubmit} disabled={!selected || submitting}>
                      {submitting ? "Submitting…" : "Submit"}
                    </Button>
                  ) : (
                    <Button onClick={onNext} disabled={idx + 1 > mcqs.length}>
                      Next
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => {
                      // quick skip
                      setIdx((i) => i + 1);
                      setSelected(null);
                      setSubmitted(false);
                      setIsCorrect(null);
                      setCorrectAnswer(null);
                      setExplanation(null);
                    }}
                  >
                    Skip
                  </Button>
                </div>

                {submitted ? (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {isCorrect ? (
                          <Badge className="bg-green-600 text-white">Correct</Badge>
                        ) : (
                          <Badge variant="destructive">Incorrect</Badge>
                        )}
                        <Badge variant="outline">Answer: {correctAnswer}</Badge>
                      </div>

                      {explanation ? (
                        <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {explanation}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          No explanation provided by backend.
                        </div>
                      )}
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>
          )}

          {/* Report table */}
          {report?.length ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">MCQ Report</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Skill</TableHead>
                      <TableHead className="text-right">Attempts</TableHead>
                      <TableHead className="text-right">Correct</TableHead>
                      <TableHead className="text-right">Accuracy</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.map((r) => (
                      <TableRow key={r.skill}>
                        <TableCell className="font-medium">{r.skill}</TableCell>
                        <TableCell className="text-right">{r.attempts}</TableCell>
                        <TableCell className="text-right">{r.correct}</TableCell>
                        <TableCell className="text-right">
                          {Math.round((r.accuracy ?? 0) * 100)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </AuthGate>
  );
}