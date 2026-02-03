"use client";

import type { WeakTopic } from "@/types/copilot";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  weakTopics: WeakTopic[];
  loading: boolean;
};

export function WeakTopicsCard({ weakTopics, loading }: Props) {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Weak topics</CardTitle>
            <p className="text-sm text-muted-foreground">
              Lowest average rubric scores across answered questions.
            </p>
          </div>

          {loading ? (
            <Badge variant="secondary" className="text-xs">
              Loading…
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              {weakTopics.length} topic{weakTopics.length === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          {weakTopics.length === 0 ? (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              No data yet. Answer a few questions.
            </div>
          ) : (
            weakTopics.map((t) => (
              <div
                key={t.topic}
                className="rounded-md border bg-muted/30 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{t.topic}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Attempts: {t.attempts}
                    </div>
                  </div>

                  <Badge variant="secondary" className="shrink-0 font-mono">
                    {t.avg_overall.toFixed(2)} / 5
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}