"use client";

import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  answer: string;
  setAnswer: (v: string) => void;
  onEvaluate: () => void;
  onHint: (level: 1 | 2 | 3) => void;
  hint: string | null;
  hintLoading: boolean;
  disabled: boolean;
  loading: boolean;
};

function countWords(text: string) {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

export function AnswerEditor({
  answer,
  setAnswer,
  onEvaluate,
  onHint,
  hint,
  hintLoading,
  disabled,
  loading,
}: Props) {
  const words = useMemo(() => countWords(answer), [answer]);
  const chars = useMemo(() => answer.length, [answer]);

  return (
    <Card className="border-primary/15">
      <CardHeader className="space-y-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">Your answer</CardTitle>
            <p className="text-sm text-muted-foreground">
              Write a structured response. Use hints only when needed.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{words} words</Badge>
            <Badge variant="outline">{chars} chars</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-4 md:grid-cols-1">
        {/* Left: Answer editor */}
        <div className="space-y-2">
          <Label htmlFor="answer" className="sr-only">
            Your answer
          </Label>
          <Textarea
            id="answer"
            className="min-h-55 resize-y"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Try: definition → approach → details → edge cases → complexity → example"
            disabled={loading}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Tip: Keep it crisp. Add tradeoffs and an example if you can.
            </p>
            <p className="text-xs text-muted-foreground">
              {words >= 120 ? "Good depth." : "Aim for ~120–220 words for most questions."}
            </p>
          </div>
        </div>

        {/* Right: Hint panel */}
        <div className="rounded-lg border bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium">Hint</div>
              <div className="text-xs text-muted-foreground">
                Level 1: nudge • Level 2: direction • Level 3: near-solution
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onHint(1)}
                disabled={loading || hintLoading}
              >
                Hint 1
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onHint(2)}
                disabled={loading || hintLoading}
              >
                Hint 2
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onHint(3)}
                disabled={loading || hintLoading}
              >
                Hint 3
              </Button>
            </div>
          </div>

          <div className="mt-3">
            {hintLoading ? (
              <div className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
                Generating hint…
              </div>
            ) : hint ? (
              <div className="max-h-55 overflow-auto whitespace-pre-wrap rounded-md border bg-background p-3 text-sm">
                {hint}
              </div>
            ) : (
              <div className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
                Click a hint level to get a nudge.
              </div>
            )}
          </div>

          <div className="mt-3 text-xs text-muted-foreground">
            After evaluation, fix one gap and retry once — that’s where learning sticks.
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button onClick={onEvaluate} disabled={disabled || loading}>
            {loading ? "Working…" : "Evaluate"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setAnswer("")}
            disabled={loading}
          >
            Clear
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          Pro tip: Use headings or bullets for clarity.
        </div>
      </CardFooter>
    </Card>
  );
}