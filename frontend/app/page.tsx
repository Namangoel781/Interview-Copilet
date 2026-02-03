"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { api, type ProfileMeOut } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AuthGate } from "@/components/auth/AuthGate";



type LoadState = "idle" | "loading" | "ready" | "no-token" | "error";

export default function Home() {
  const [me, setMe] = useState<ProfileMeOut | null>(null);
  const [meState, setMeState] = useState<LoadState>("idle");

  useEffect(() => {
    let cancelled = false;

    // Build a quick "load" function to handle the async call
    async function load() {
      // If we have no token in localStorage, api.profileMe() might still try
      // but the AuthGate or the API helper usually handles the token.
      // However, for "meState", let's check existence first if we want
      // to mimic the old logic, OR just try the API.
      // The API helper `api.profileMe()` automatically attaches the token
      // if it exists in localStorage (key="access_token").

      setMeState("loading");

      try {
        const data = await api.profileMe();
        if (cancelled) return;
        setMe(data);
        setMeState("ready");
      } catch (err) {
        if (cancelled) return;
        setMe(null);
        // If it's 401, it means invalid token or no token.
        setMeState("error");
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthGate>
      <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
        {/* Subtle background */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsla(var(--primary)/0.10),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,hsla(var(--muted-foreground)/0.10),transparent_55%)]" />
          <div className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,hsla(var(--muted-foreground)/0.08)_1px,transparent_1px),linear-gradient(to_bottom,hsla(var(--muted-foreground)/0.08)_1px,transparent_1px)] [background-size:56px_56px]" />
        </div>

        <div className="mx-auto max-w-6xl px-6 py-8 sm:py-10">
          {/* Top nav */}
          {/* Hero */}
          <section className="grid gap-8 lg:grid-cols-2 lg:items-center py-12 md:py-24">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="px-3 py-1">Software Developer Preparation</Badge>
                <Badge variant="outline" className="px-3 py-1">Fullstack • Backend • Frontend</Badge>
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl font-extrabold tracking-tight lg:text-6xl">
                  Master your next <br className="hidden lg:block" />
                  <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    Technical Interview.
                  </span>
                </h1>
                <p className="max-w-xl text-lg text-muted-foreground leading-relaxed">
                  Generate realistic questions, practice with AI feedback, and identify your weak spots.
                  Get a personalized roadmap based on your target job description.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center pt-2">
                <Button size="lg" className="h-12 px-8 text-base shadow-lg shadow-primary/20" asChild>
                  <Link href="/copilot">Start Practicing</Link>
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-8 text-base border-primary/20 hover:bg-primary/5" asChild>
                  <Link href="/profile">Analyze Job Description</Link>
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3 pt-6">
                <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-sm">
                  <div className="font-semibold text-foreground">AI Feedback</div>
                  <div className="text-xs text-muted-foreground">Instant rubric grading & hints</div>
                </div>
                <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-sm">
                  <div className="font-semibold text-foreground">Progress Tracking</div>
                  <div className="text-xs text-muted-foreground">Visualize weak topics over time</div>
                </div>
                <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-sm">
                  <div className="font-semibold text-foreground">Custom Roadmap</div>
                  <div className="text-xs text-muted-foreground">Tailored 2-week study plan</div>
                </div>
              </div>
            </div>

            {/* Quick Start Card (Right Side) */}
            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-primary/30 to-secondary/30 opacity-50 blur-2xl" />
              <Card className="relative border-primary/10 bg-background/80 backdrop-blur-sm shadow-xl">
                <CardHeader>
                  <CardTitle>Quick Start Guide</CardTitle>
                  <CardDescription>Be productive in under 2 minutes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">1</div>
                    <div>
                      <div className="font-medium">Practice Questions</div>
                      <div className="text-sm text-muted-foreground">Choose a track & difficulty. Get instant feedback.</div>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">2</div>
                    <div>
                      <div className="font-medium">Analyze JD + Resume</div>
                      <div className="text-sm text-muted-foreground">Upload your target JD to get a tailored plan.</div>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">3</div>
                    <div>
                      <div className="font-medium">Track Progress</div>
                      <div className="text-sm text-muted-foreground">Focus on what matters most.</div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/30 p-4">
                  <Button variant="ghost" className="w-full justify-between" asChild>
                    <Link href="/dashboard">Go to Dashboard <span className="ml-2">→</span></Link>
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </section>

          <Separator className="my-12" />

          {/* Feature cards */}
          <section className="space-y-5">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">What you can do</h2>
              <p className="text-sm text-muted-foreground">
                A focused workflow for learning + interviewing — built around practice, feedback, and iteration.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="group h-full bg-background/60 transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Copilot Practice</CardTitle>
                    <Badge variant="secondary">Core</Badge>
                  </div>
                  <CardDescription>Generate questions and improve with feedback.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Track: Backend / Frontend / Fullstack</li>
                    <li>Skill + difficulty control</li>
                    <li>Hints + evaluation rubric</li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button asChild className="w-full">
                    <Link href="/copilot">Open Copilot</Link>
                  </Button>
                </CardFooter>
              </Card>

              <Card className="group h-full bg-background/60 transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">JD + Resume Analyzer</CardTitle>
                    <Badge variant="outline">New</Badge>
                  </div>
                  <CardDescription>Get a targeted plan for your job application.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Skill match + missing topics</li>
                    <li>Priority list + 2‑week plan</li>
                    <li>YouTube topic search links</li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button variant="secondary" asChild className="w-full">
                    <Link href="/profile">Open Analyzer</Link>
                  </Button>
                </CardFooter>
              </Card>

              <Card className="group h-full bg-background/60 transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Progress Dashboard</CardTitle>
                    <Badge variant="secondary">Insights</Badge>
                  </div>
                  <CardDescription>See weak topics and session history.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Weak topics over time</li>
                    <li>Session history + charts</li>
                    <li>Pick what to practice next</li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button variant="secondary" asChild className="w-full">
                    <Link href="/dashboard">Open Dashboard</Link>
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </section>

          <Separator className="my-12" />

          {/* How it works */}
          <section className="space-y-5">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
              <p className="text-sm text-muted-foreground">
                A simple loop that improves your answers and keeps your learning plan focused.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="bg-background/60">
                <CardHeader>
                  <CardTitle className="text-base">1) Generate</CardTitle>
                  <CardDescription>Pick track → skill → difficulty.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Practice relevant questions for your role: backend (SQL/DSA/system design), frontend (React/Next/TS), or fullstack.
                </CardContent>
              </Card>
              <Card className="bg-background/60">
                <CardHeader>
                  <CardTitle className="text-base">2) Answer</CardTitle>
                  <CardDescription>Write your best response.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Use hints when needed. Your answer is evaluated on clarity, depth, correctness, and completeness.
                </CardContent>
              </Card>
              <Card className="bg-background/60">
                <CardHeader>
                  <CardTitle className="text-base">3) Improve</CardTitle>
                  <CardDescription>Fix gaps → repeat → track weak topics.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  The dashboard surfaces weak topics so your next practice session is always targeted.
                </CardContent>
              </Card>
            </div>
          </section>

          <footer className="mt-14 flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div>
              Tip: run the frontend in dev mode with <span className="font-mono">npm run dev</span>.
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono">/copilot</span>
              <span>•</span>
              <span className="font-mono">/profile</span>
              <span>•</span>
              <span className="font-mono">/dashboard</span>
            </div>
          </footer>
        </div>
      </div>
    </AuthGate>
  );
}