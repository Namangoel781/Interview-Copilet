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
          <header className="sticky top-0 z-20 -mx-6 mb-10 border-b bg-background/70 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/50">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
                  <div className="h-5 w-5 rounded-md bg-primary/30" />
                </div>
                <div className="leading-tight">
                  <div className="text-sm font-semibold tracking-tight">AI Learning Copilot</div>
                  <div className="text-xs text-muted-foreground">Practice • Feedback • Progress</div>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                {/* Profile chip (desktop) */}
                <div className="hidden items-center gap-3 rounded-2xl border bg-background/60 px-3 py-2 shadow-sm md:flex">
                  <div className="flex flex-col leading-tight">
                    <div className="text-[11px] text-muted-foreground">Signed in</div>

                    {meState === "loading" && (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 animate-pulse rounded-full bg-primary/60" />
                        <span className="text-sm font-medium">Loading profile…</span>
                      </div>
                    )}

                    {meState === "error" && (
                      <span className="text-sm font-medium">Couldn’t load profile</span>
                    )}

                    {meState === "ready" && (
                      <div className="space-y-1">
                        <div className="text-sm font-medium">{me?.email ?? "User"}</div>
                        <div className="flex flex-wrap gap-1">
                          {me?.domain ? <Badge variant="secondary">{me.domain}</Badge> : null}
                          {me?.role ? <Badge variant="outline">{me.role}</Badge> : null}
                          {me?.track ? <Badge variant="outline">{me.track}</Badge> : null}
                          {me?.level ? <Badge variant="outline">{me.level}</Badge> : null}
                        </div>
                      </div>
                    )}
                  </div>

                  <Button size="sm" variant="secondary" asChild>
                    <Link href="/profile/setup">Edit</Link>
                  </Button>
                </div>

                {/* Nav */}
                <div className="flex items-center gap-1">
                  <Button variant="ghost" asChild>
                    <Link href="/dashboard">Dashboard</Link>
                  </Button>
                  <Button variant="ghost" asChild>
                    <Link href="/profile">Analyzer</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/copilot">Open Copilot</Link>
                  </Button>
                </div>
              </div>
            </div>
          </header>

          {/* Hero */}
          <section className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Software Developer</Badge>
                <Badge variant="outline">Backend • Frontend • Fullstack</Badge>
                <Badge variant="outline">Role-focused practice</Badge>
              </div>

              <div className="space-y-3">
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                  Learn faster. Practice smarter.{" "}
                  <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    Crack interviews.
                  </span>
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                  Generate interview questions, write answers, get rubric-based feedback, track weak topics,
                  and use the JD + Resume Analyzer to build a focused learning plan for your target role.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button size="lg" asChild>
                  <Link href="/copilot">Start practicing</Link>
                </Button>
                <Button size="lg" variant="secondary" asChild>
                  <Link href="/profile">Analyze JD + Resume</Link>
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border bg-background/60 p-4 shadow-sm">
                  <div className="text-sm font-semibold">Rubric feedback</div>
                  <div className="text-sm text-muted-foreground">Accuracy • Depth • Clarity</div>
                </div>
                <div className="rounded-2xl border bg-background/60 p-4 shadow-sm">
                  <div className="text-sm font-semibold">Weak topics</div>
                  <div className="text-sm text-muted-foreground">Always know what’s next</div>
                </div>
                <div className="rounded-2xl border bg-background/60 p-4 shadow-sm">
                  <div className="text-sm font-semibold">Roadmap</div>
                  <div className="text-sm text-muted-foreground">Targeted 2‑week plan</div>
                </div>
              </div>

              {/* Mobile profile chip */}
              <div className="md:hidden">
                <Card className="border-primary/15 bg-background/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Your profile</CardTitle>
                    <CardDescription>Keep your setup aligned with your target role.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {meState === "loading" && (
                      <div className="text-sm text-muted-foreground">Loading profile…</div>
                    )}
                    {meState === "no-token" && (
                      <div className="text-sm text-muted-foreground">Not signed in</div>
                    )}
                    {meState === "error" && (
                      <div className="text-sm text-muted-foreground">Couldn’t load profile</div>
                    )}
                    {meState === "ready" && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium">{me?.email ?? "User"}</div>
                        <div className="flex flex-wrap gap-1">
                          {me?.domain ? <Badge variant="secondary">{me.domain}</Badge> : null}
                          {me?.role ? <Badge variant="outline">{me.role}</Badge> : null}
                          {me?.track ? <Badge variant="outline">{me.track}</Badge> : null}
                          {me?.level ? <Badge variant="outline">{me.level}</Badge> : null}
                        </div>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button variant="secondary" className="w-full" asChild>
                      <Link href="/profile/setup">Edit profile</Link>
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </div>

            <Card className="border-primary/15 bg-background/60 shadow-sm">
              <CardHeader>
                <CardTitle>Quick Start</CardTitle>
                <CardDescription>Be productive in under 2 minutes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border bg-background p-4">
                  <div className="text-sm font-medium">1) Practice questions</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Open <span className="font-mono">Copilot</span> → choose track/skill → generate → answer → evaluate.
                  </div>
                </div>
                <div className="rounded-2xl border bg-background p-4">
                  <div className="text-sm font-medium">2) Analyze a job</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Open <span className="font-mono">Analyzer</span> → paste JD → upload resume → get topics + plan + keywords.
                  </div>
                </div>
                <div className="rounded-2xl border bg-background p-4">
                  <div className="text-sm font-medium">3) Track progress</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Use <span className="font-mono">Dashboard</span> to review history + weak topics.
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <Button variant="secondary" asChild className="w-full sm:w-auto">
                  <Link href="/dashboard">Open Dashboard</Link>
                </Button>
                <Button asChild className="w-full sm:w-auto">
                  <Link href="/copilot">Open Copilot</Link>
                </Button>
              </CardFooter>
            </Card>
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