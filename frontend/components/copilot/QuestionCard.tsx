"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  question: string;
  /** Optional metadata (safe defaults) */
  difficulty?: string;
  questionType?: string;
  skill?: string;
};

export function QuestionCard({ question, difficulty, questionType, skill }: Props) {
  const [copied, setCopied] = useState(false);

  const hasQuestion = !!question?.trim();

  const meta = useMemo(() => {
    const items: Array<{ label: string; value: string }> = [];
    if (skill) items.push({ label: "Skill", value: skill });
    if (questionType) items.push({ label: "Type", value: questionType });
    if (difficulty) items.push({ label: "Difficulty", value: difficulty });
    return items;
  }, [difficulty, questionType, skill]);

  async function copyQuestion() {
    if (!hasQuestion) return;
    try {
      await navigator.clipboard.writeText(question);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 900);
    } catch {
      // ignore
    }
  }

  return (
    <Card className="border-primary/15">
      <CardHeader className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Question</CardTitle>
              <Badge variant="outline" className="text-xs">
                Prompt
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Read carefully, then answer with a structured explanation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {meta.map((m) => (
              <Badge key={m.label} variant="secondary" className="text-xs">
                {m.label}: {m.value}
              </Badge>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={copyQuestion}
              disabled={!hasQuestion}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {hasQuestion ? (
          <div className="max-h-90 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-4 text-sm leading-6">
            {question}
          </div>
        ) : (
          <div className="rounded-md border bg-muted/30 p-4">
            <div className="text-sm font-medium">No question yet</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Create a session and click <span className="font-medium">Generate Question</span> to start practicing.
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
                Tip: Use a simple structure → definition, approach, edge cases, complexity.
              </div>
              <div className="rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
                If stuck, use Hint 1 first. Save Hint 3 for the end.
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}