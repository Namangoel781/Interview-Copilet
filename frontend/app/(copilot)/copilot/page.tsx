"use client";

import { useMemo } from "react";

import { useCopilotSession } from "@/hooks/useCopilotSession";
import { useWeakTopics } from "@/hooks/useWeakTopics";
import { AuthGate } from "@/components/auth/AuthGate";
import { SessionSetupCard } from "@/components/copilot/SessionSetupCard";
import { QuestionCard } from "@/components/copilot/QuestionCard";
import { AnswerEditor } from "@/components/copilot/AnswerEditor";
import { EvaluationPanel } from "@/components/copilot/EvaluationPanel";
import { WeakTopicsCard } from "@/components/copilot/WeakTopicsCard";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function CopilotPage() {
  const s = useCopilotSession();
  const { weakTopics, loading: loadingWeak } = useWeakTopics(
    s.sessionId,
    s.evaluation?.overall
  );

  const status = useMemo(() => {
    if (s.loading) return { label: "Working…", variant: "secondary" as const };
    if (s.error) return { label: "Needs attention", variant: "destructive" as const };
    if (s.sessionId) return { label: `Session #${s.sessionId}`, variant: "secondary" as const };
    return { label: "No active session", variant: "outline" as const };
  }, [s.loading, s.error, s.sessionId]);

  return (
    <AuthGate>
    <div className="min-h-screen bg-linear-to-b from-background to-muted/25">
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Interview Copilot</h1>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Generate a question, write your answer, get rubric-based feedback, and track weak topics.
              Use hints when you’re stuck — then iterate.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {s.track ? <Badge variant="outline">Track: {String(s.track)}</Badge> : null}
            {s.skill ? <Badge variant="outline">Skill: {String(s.skill)}</Badge> : null}
            {s.difficulty ? <Badge variant="outline">Difficulty: {String(s.difficulty)}</Badge> : null}
          </div>
        </div>

        {/* Setup */}
        <SessionSetupCard
          mode={s.mode}
          setMode={s.setMode}
          track={s.track}
          setTrack={s.setTrack}
          level={s.level}
          setLevel={s.setLevel}
          skill={s.skill}
          setSkill={s.setSkill}
          topic={s.topic}
          setTopic={s.setTopic}
          questionType={s.questionType}
          setQuestionType={s.setQuestionType}
          difficulty={s.difficulty}
          setDifficulty={s.setDifficulty}
          sessionId={s.sessionId}
          loading={s.loading}
          error={s.error}
          onCreateSession={() => s.createSession().catch((e) => console.error(e))}
          onGenerateQuestion={() => s.generateQuestion().catch((e) => console.error(e))}
          canGenerateQuestion={s.canGenerateQuestion}
        />

        {/* Main grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Practice flow */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-primary/15">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Practice</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <QuestionCard question={s.question} />

                <Separator />

                <AnswerEditor
                  answer={s.answer}
                  setAnswer={s.setAnswer}
                  onEvaluate={() => s.evaluateAnswer().catch((e) => console.error(e))}
                  onHint={(level) => s.getHint(level).catch((e) => console.error(e))}
                  hint={s.hint}
                  hintLoading={s.hintLoading}
                  disabled={!s.canEvaluate}
                  loading={!!s.loading}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right: Insights */}
          
        </div>
        <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Insights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <WeakTopicsCard weakTopics={weakTopics} loading={loadingWeak} />

                <Separator />

                <EvaluationPanel evaluation={s.evaluation} />
              </CardContent>
            </Card>
          </div>
      </div>
    </div>
    </AuthGate>
  );
}