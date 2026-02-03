"use client";

import * as React from "react";
import { api } from "@/lib/api";
import type { SessionOut, SessionItem } from "@/types/copilot"; // adjust import path if different
import { useCopilotSession } from "@/hooks/useCopilotSession";
import { useWeakTopics } from "@/hooks/useWeakTopics";
import { AuthGate } from "@/components/auth/AuthGate";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

function avg(nums: number[]) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function BarRow({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground">{label}</div>
        <div className="font-medium">{pct}/100</div>
      </div>
      <div className="h-2 w-full rounded bg-muted">
        <div className="h-2 rounded bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const s = useCopilotSession();

  // If the user refreshes / logs in later, in-memory session can be empty.
  // Resolve the latest session from backend so Dashboard still shows data.
  const [resolvedSessionId, setResolvedSessionId] = React.useState<number | null>(null);
  const [loadingActiveSession, setLoadingActiveSession] = React.useState(false);

  const [session, setSession] = React.useState<SessionOut | null>(null);
  const [loadingSession, setLoadingSession] = React.useState(false);

  // Resolve active session id: prefer in-memory, else ask backend.
  React.useEffect(() => {
    if (typeof s.sessionId === "number") {
      setResolvedSessionId(s.sessionId);
      return;
    }

    setLoadingActiveSession(true);
    api
      .getActiveSession()
      .then((r) => setResolvedSessionId(r.session_id))
      .catch(() => setResolvedSessionId(null))
      .finally(() => setLoadingActiveSession(false));
  }, [s.sessionId]);

  const { weakTopics, loadingWeak } = useWeakTopics(
    resolvedSessionId,
    s.evaluation?.overall ?? null
  );

  // Fetch session details once we have a resolved session id.
  React.useEffect(() => {
    if (!resolvedSessionId) {
      setSession(null);
      return;
    }
    setLoadingSession(true);
    api
      .getSession(resolvedSessionId)
      .then(setSession)
      .finally(() => setLoadingSession(false));
  }, [resolvedSessionId]);

  const items: SessionItem[] = session?.items ?? [];
  const scored = items.filter((it) => typeof it.overall === "number") as Array<
    SessionItem & { overall: number }
  >;

  const overallAvg = avg(scored.map((x) => x.overall));
  const attempts = items.length;

  // Avg by skill
  const bySkill = React.useMemo(() => {
    const map = new Map<string, number[]>();
    for (const it of scored) {
      map.set(it.skill, [...(map.get(it.skill) ?? []), it.overall]);
    }
    return Array.from(map.entries())
      .map(([skill, vals]) => ({ skill, avg: avg(vals) }))
      .sort((a, b) => a.avg - b.avg);
  }, [scored]);

  // Recent history (latest first)
  const recent = React.useMemo(() => [...items].reverse().slice(0, 10), [items]);

  return (
    <AuthGate>
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <div className="space-y-1">
          <div className="text-2xl font-semibold">Dashboard</div>
          <div className="text-sm text-muted-foreground">
            Session analytics (history, weak topics, charts).
          </div>
        </div>

        {!resolvedSessionId ? (
          <Card>
            <CardHeader>
              <CardTitle>{loadingActiveSession ? "Loading dashboard…" : "No sessions found"}</CardTitle>
              <CardDescription>
                {loadingActiveSession
                  ? "Fetching your latest session from the server."
                  : "Start a session from Copilot first, then come back here."}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Session Summary</CardTitle>
                  <CardDescription>Quick snapshot</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Track</span>
                    <Badge variant="secondary">{session?.track ?? s.track ?? "—"}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Level</span>
                    <Badge variant="secondary">{session?.level ?? s.level ?? "—"}</Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Attempts</span>
                    <span className="font-medium">{loadingSession ? "…" : attempts}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Average score</span>
                    <span className="font-medium">{scored.length ? `${Math.round(overallAvg)}/100` : "—"}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Weak Topics</CardTitle>
                  <CardDescription>Lowest average performance</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loadingWeak ? (
                    <div className="text-sm text-muted-foreground">Loading…</div>
                  ) : weakTopics?.length ? (
                    weakTopics.slice(0, 5).map((t) => (
                      <BarRow
                        key={t.topic}
                        label={`${t.topic} (${t.attempts} attempts)`}
                        value={t.avg_overall}
                      />
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No weak topics yet. Evaluate a few answers first.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Skill Performance</CardTitle>
                  <CardDescription>Average score by skill</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loadingSession ? (
                    <div className="text-sm text-muted-foreground">Loading…</div>
                  ) : bySkill.length ? (
                    bySkill.map((row) => <BarRow key={row.skill} label={row.skill} value={row.avg} />)
                  ) : (
                    <div className="text-sm text-muted-foreground">No evaluated attempts yet.</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent History</CardTitle>
                  <CardDescription>Last 10 attempts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loadingSession ? (
                    <div className="text-sm text-muted-foreground">Loading…</div>
                  ) : recent.length ? (
                    recent.map((it) => (
                      <div key={it.id} className="rounded-md border p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{it.skill}</Badge>
                          <Badge variant="secondary">{it.topic}</Badge>
                          <Badge variant="outline">{it.question_type}</Badge>
                          <Badge variant="outline">{it.difficulty}</Badge>
                          <div className="ml-auto text-sm font-medium">
                            {typeof it.overall === "number" ? `${Math.round(it.overall)}/100` : "—"}
                          </div>
                        </div>

                        <div className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">Q:</span> {it.question}
                        </div>

                        {it.user_answer ? (
                          <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">A:</span> {it.user_answer}
                          </div>
                        ) : (
                          <div className="mt-1 text-sm text-muted-foreground">No answer submitted</div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">No attempts yet.</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AuthGate>
  );
}