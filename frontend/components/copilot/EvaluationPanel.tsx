"use client";

import { useMemo, useState } from "react";

import type { EvaluationJson } from "@/types/copilot";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type Props = {
  evaluation: EvaluationJson | null;
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function scoreLabel(overall: number) {
  if (overall >= 4.5) return "Excellent";
  if (overall >= 3.7) return "Strong";
  if (overall >= 3.0) return "Good";
  if (overall >= 2.2) return "Needs work";
  return "Weak";
}

export function EvaluationPanel({ evaluation }: Props) {
  const [showModel, setShowModel] = useState(true);
  const [copied, setCopied] = useState(false);

  // Hooks must run on every render (even when evaluation is null)
  const overall = evaluation?.overall ?? 0;
  const label = useMemo(() => scoreLabel(overall), [overall]);

  const entries = useMemo(
    () =>
      (evaluation
        ? (Object.entries(evaluation.scores) as Array<
            [keyof EvaluationJson["scores"], number]
          >)
        : []),
    [evaluation]
  );

  async function copyModelAnswer() {
    const text = evaluation?.model_answer || "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1000);
    } catch {
      // ignore
    }
  }

  if (!evaluation) return null;
  const ev = evaluation;

  return (
    <Card className="border-primary/15">
      <CardHeader className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Evaluation</CardTitle>
              <Badge variant="outline" className="text-xs">
                Rubric
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Rubric-based scoring with actionable coaching and a suggested model answer.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono">
              {overall.toFixed(2)} / 5
            </Badge>
            <Badge variant="outline">{label}</Badge>
          </div>
        </div>

        {/* overall bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Overall</span>
            <span>{Math.round(clamp01(overall / 5) * 100)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary"
              style={{ width: `${Math.round(clamp01(overall / 5) * 100)}%` }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Rubric */}
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Rubric breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {entries.map(([k, v]) => {
                const pct = Math.round(clamp01(v / 5) * 100);
                return (
                  <div key={String(k)} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize text-muted-foreground">{String(k)}</span>
                      <span className="font-mono">{v}/5</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Coaching */}
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Coaching</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PillsSection title="Strengths" items={ev.strengths} tone="ok" />
              <PillsSection title="Gaps" items={ev.gaps} tone="warn" />
              <PillsSection title="Improvements" items={ev.improvements} tone="info" />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Next drill topic</div>
                  <Badge variant="secondary" className="text-xs">
                    Suggested
                  </Badge>
                </div>
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  {ev.next_drill_topic}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Model answer */}
          <div className="lg:col-span-2">
            <Separator className="my-2" />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium">Model answer</h3>
                <Badge variant="outline" className="text-xs">
                  Suggested response
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowModel((v) => !v)}
                >
                  {showModel ? "Hide" : "Show"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={copyModelAnswer}>
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>

            {showModel ? (
              <div className="mt-2 max-h-105 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-4 text-sm">
                {ev.model_answer}
              </div>
            ) : (
              <div className="mt-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                Hidden — click “Show” to view the suggested answer.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PillsSection({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "ok" | "warn" | "info";
}) {
  const toneClasses =
    tone === "ok"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20"
      : tone === "warn"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/20"
        : "bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-sky-500/20";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{title}</div>
        <span className="text-xs text-muted-foreground">
          {items.length > 0 ? `${items.length} item${items.length > 1 ? "s" : ""}` : "—"}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          No notes.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((x, i) => (
            <span
              key={`${title}-${i}`}
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1 ${toneClasses}`}
            >
              {x}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}