"use client";

import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { ProfileAnalyzeOut } from "@/types/profile";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AuthGate } from "@/components/auth/AuthGate";

// Attempt to import Progress; if not present, fallback to null and use div-based progress bar
let Progress: React.ComponentType<{ value: number }> | null = null;
try {
  // eslint-disable-next-line import/no-unresolved
  // @ts-ignore
  Progress = require("@/components/ui/progress").Progress;
} catch {
  Progress = null;
}

function PillList({ items }: { items: string[] }) {
  if (!items?.length) return <p className="text-sm text-muted-foreground">None</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((x) => (
        <Badge key={x} variant="secondary">{x}</Badge>
      ))}
    </div>
  );
}

function BulletList({ items }: { items: Array<any> }) {
  if (!items?.length) return <p className="text-sm text-muted-foreground">None</p>;
  return (
    <ul className="list-disc pl-5 space-y-1 text-sm">
      {items.map((x, i) => {
        const text =
          typeof x === "string"
            ? x
            : x && typeof x === "object"
              ? (
                  (x.title as string | undefined) ||
                  (x.name as string | undefined) ||
                  (x.topic as string | undefined) ||
                  JSON.stringify(x)
                )
              : String(x);

        const extra =
          x && typeof x === "object" && Array.isArray((x as any).stack)
            ? ` — ${(x as any).stack.join(", ")}`
            : "";

        return <li key={`${text}-${i}`}>{text}{extra}</li>;
      })}
    </ul>
  );
}

export default function ProfilePage() {
  const [jd, setJd] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ProfileAnalyzeOut | null>(null);

  const canSubmit = useMemo(() => jd.trim().length >= 40 && (!!resumeFile || resumeText.trim().length >= 40), [jd, resumeFile, resumeText]);

  async function onAnalyze() {
    setErr(null);
    setData(null);
    setLoading(true);
    try {
      const res = await api.profileAnalyze({
        jd_text: jd,
        resume_pdf: resumeFile,
        resume_text: resumeText,
      });
      setData(res);
    } catch (e: any) {
      setErr(e?.message || "Failed to analyze profile");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthGate>
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>JD + Resume Analyzer</CardTitle>
          <CardDescription>
            Paste a job description and upload your resume (PDF) or paste resume text. We’ll identify skill gaps + a 2-week interview plan.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="text-sm font-medium">Job Description (JD)</div>
            <Textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste JD here (minimum ~40 chars)"
              className="min-h-40"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium">Resume PDF (optional)</div>
              <Input
                type="file"
                accept="application/pdf"
                onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                If your PDF is scanned/image-based, OCR will be used (slower). You can paste resume text instead.
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Resume Text (optional)</div>
              <Textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste resume text here (recommended if PDF extraction fails)"
                className="min-h-30"
              />
            </div>
          </div>

          {err && (
            <Alert variant="destructive">
              <AlertTitle>Request failed</AlertTitle>
              <AlertDescription className="whitespace-pre-wrap">{err}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={onAnalyze} disabled={!canSubmit || loading}>
              {loading ? "Analyzing..." : "Analyze"}
            </Button>
            {!canSubmit && (
              <p className="text-xs text-muted-foreground">
                Provide JD + either Resume PDF or Resume Text.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {data && (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>{data.summary}</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Role fit section */}
            <div className="mb-4">
              <Badge variant="secondary" className="mb-2 inline-block">
                Role fit: {data.role_fit_score != null ? `${data.role_fit_score}%` : "0%"}
              </Badge>
              {data.role_fit_score != null ? (
                Progress ? (
                  <Progress value={data.role_fit_score} />
                ) : (
                  <div className="w-full bg-muted h-2 rounded">
                    <div
                      className="bg-primary h-2 rounded"
                      style={{ width: `${data.role_fit_score}%` }}
                    />
                  </div>
                )
              ) : (
                <p className="text-xs text-muted-foreground mt-1">Role fit score not available.</p>
              )}
            </div>

            <Tabs defaultValue="gaps" className="w-full">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="gaps">Gaps</TabsTrigger>
                <TabsTrigger value="topics">Topics</TabsTrigger>
                <TabsTrigger value="plan">2-Week Plan</TabsTrigger>
                <TabsTrigger value="resume">Resume</TabsTrigger>
                <TabsTrigger value="projects">Projects</TabsTrigger>
                <TabsTrigger value="jd">JD</TabsTrigger>
              </TabsList>

              <TabsContent value="gaps" className="space-y-4">
                {/* Show gap_report missing/weak pills near top */}
                {(data.gap_report?.missing?.length || data.gap_report?.weak?.length) && (
                  <div className="space-y-2">
                    {data.gap_report?.missing?.length ? (
                      <div>
                        <div className="text-sm font-semibold mb-1">Gap Report - Missing</div>
                        <PillList items={data.gap_report.missing} />
                      </div>
                    ) : null}
                    {data.gap_report?.weak?.length ? (
                      <div>
                        <div className="text-sm font-semibold mb-1">Gap Report - Weak</div>
                        <PillList items={data.gap_report.weak} />
                      </div>
                    ) : null}
                    <Separator />
                  </div>
                )}
                <div>
                  <div className="text-sm font-semibold mb-2">Matched Skills</div>
                  <PillList items={data.matched_skills} />
                </div>
                <Separator />
                <div>
                  <div className="text-sm font-semibold mb-2">Missing Skills</div>
                  <PillList items={data.missing_skills} />
                </div>
              </TabsContent>

              <TabsContent value="topics" className="space-y-4">
                <div>
                  <div className="text-sm font-semibold mb-2">Missing Topics</div>
                  <BulletList items={data.missing_topics} />
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="text-sm font-semibold">YouTube (topic search)</div>
                  {!data.youtube_links?.length ? (
                    <p className="text-sm text-muted-foreground">No links available.</p>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-2">
                      {data.youtube_links.map((l) => (
                        <Card key={l.url}>
                          <CardContent className="pt-6 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{l.topic}</div>
                              <div className="text-xs text-muted-foreground truncate">{l.url}</div>
                            </div>
                            <Button variant="secondary" asChild>
                              <a href={l.url} target="_blank" rel="noreferrer">
                                Open
                              </a>
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="text-sm font-semibold">Priority Topics</div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {data.priority_topics?.map((t, idx) => (
                      <Card key={`${t.topic}-${idx}`}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            {t.topic}
                            <Badge variant="outline">{t.difficulty}</Badge>
                            <Badge variant="secondary">{t.estimated_days}d</Badge>
                          </CardTitle>
                          <CardDescription>{t.why}</CardDescription>
                        </CardHeader>
                        <CardContent className="text-sm">
                          <div className="font-medium mb-1">Drill</div>
                          <div className="text-muted-foreground">{t.drill}</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="plan" className="space-y-4">
                <div className="grid gap-3">
                  {data.interview_plan_2_weeks?.map((d) => (
                    <Card key={d.day}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Day {d.day}: {d.focus}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <BulletList items={d.tasks} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="resume" className="space-y-4">
                <div>
                  <div className="text-sm font-semibold mb-2">Resume Gaps</div>
                  <BulletList items={data.resume_gaps} />
                </div>
                <Separator />
                <div>
                  <div className="text-sm font-semibold mb-2">Resume Improvements</div>
                  <BulletList items={data.resume_improvements} />
                </div>
                <Separator />
                <div>
                  <div className="text-sm font-semibold mb-2">ATS Keywords to Add</div>
                  <PillList items={data.ats_keywords_to_add} />
                </div>
              </TabsContent>

              <TabsContent value="projects" className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  {data.project_suggestions?.map((p, idx) => (
                    <Card key={`${p.title}-${idx}`}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{p.title}</CardTitle>
                        <CardDescription>{p.why}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {p.stack.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
                        </div>
                        <p className="text-sm text-muted-foreground">Scope: ~{p.scope_days} days</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="jd" className="space-y-6">
                {/* Required Skills */}
                <div>
                  <div className="text-sm font-semibold mb-2">Required Skills</div>
                  {!data.required_skills?.length ? (
                    <p className="text-sm text-muted-foreground">None</p>
                  ) : (
                    <div className="space-y-3">
                      {data.required_skills.map((skill, idx) => (
                        <Card key={`${skill.name}-${idx}`}>
                          <CardContent className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <div className="font-medium">{skill.name}</div>
                              <Badge
                                variant={
                                  skill.importance === "must"
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {skill.importance === "must" ? "Must" : "Good to have"}
                              </Badge>
                            </div>
                            {skill.evidence_in_jd ? (
                              <div className="text-xs text-muted-foreground italic truncate" title={skill.evidence_in_jd}>
                                {skill.evidence_in_jd}
                              </div>
                            ) : null}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {/* Experience Expectations */}
                <div>
                  <div className="text-sm font-semibold mb-2">Experience Expectations</div>
                  <BulletList items={data.experience_expectations ?? []} />
                </div>

                {/* Gap Report */}
                <div className="space-y-4">
                  <div className="text-sm font-semibold mb-2">Gap Report</div>
                  <div>
                    <div className="font-semibold mb-1">Missing</div>
                    <PillList items={data.gap_report?.missing ?? []} />
                  </div>
                  <div>
                    <div className="font-semibold mb-1">Weak</div>
                    <PillList items={data.gap_report?.weak ?? []} />
                  </div>
                  <div>
                    <div className="font-semibold mb-1">ATS Keywords</div>
                    <PillList items={data.gap_report?.ats_keywords ?? []} />
                  </div>
                  <div>
                    <div className="font-semibold mb-1">Suggested Projects</div>
                    <BulletList
                      items={(data.gap_report?.suggested_projects ?? []).map((p: any) =>
                        typeof p === "string" ? p : p
                      )}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
    </AuthGate>
  );
}