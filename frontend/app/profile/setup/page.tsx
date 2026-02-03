"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

type Track = "Backend" | "Frontend" | "FullStack";
type Level = "Beginner" | "Intermediate" | "Advanced";

export default function ProfileSetupPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [domain, setDomain] = useState("Software");
  const [role, setRole] = useState("Software Developer");
  const [track, setTrack] = useState<Track>("Backend");
  const [level, setLevel] = useState<Level>("Intermediate");

  const recommended = useMemo(() => {
    if (track === "Backend") return ["SQL", "DSA", "SystemDesign"];
    if (track === "Frontend") return ["React", "Nextjs", "TypeScript", "WebPerformance", "Testing"];
    return ["SQL", "DSA", "SystemDesign", "React", "Nextjs", "TypeScript", "WebPerformance", "Testing"];
  }, [track]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const me = await api.profileMe();
        if (!mounted) return;

        setDomain(me.domain ?? "Software");
        setRole(me.role ?? "Software Developer");

        // fallback to Backend if null/unknown
        const t = (me.track ?? "Backend") as Track;
        setTrack(["Backend", "Frontend", "FullStack"].includes(t) ? t : "Backend");

        const lv = (me.level ?? "Intermediate") as Level;
        setLevel(["Beginner", "Intermediate", "Advanced"].includes(lv) ? lv : "Intermediate");
      } catch (e: any) {
        // If not logged in, backend likely returns 401; show nice message
        setError(e?.message ?? "Failed to load profile.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      await api.profileSetup({ domain, role, track, level });
    } catch (e: any) {
      setError(e?.message ?? "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Profile Setup</h1>
        <p className="mt-1 text-muted-foreground">
          Set your track and level so the Copilot can personalize questions, hints, and your roadmap.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-5">
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Your Role</CardTitle>
            <CardDescription>These fields control how the AI tailors interview prep.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading profile…
              </div>
            ) : (
              <>
                {error ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    {error}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label>Domain</Label>
                  <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="Software" />
                </div>

                <div className="space-y-2">
                  <Label>Role</Label>
                  <Input
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Software Developer"
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label>Track</Label>
                  <div className="flex flex-wrap gap-2">
                    {(["Backend", "Frontend", "FullStack"] as Track[]).map((t) => (
                      <Button
                        key={t}
                        type="button"
                        variant={track === t ? "default" : "outline"}
                        onClick={() => setTrack(t)}
                      >
                        {t}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Track controls which skills show up in sessions, questions, and dashboards.
                  </p>
                </div>

                <div className="space-y-3">
                  <Label>Skill level</Label>
                  <div className="flex flex-wrap gap-2">
                    {(["Beginner", "Intermediate", "Advanced"] as Level[]).map((lv) => (
                      <Button
                        key={lv}
                        type="button"
                        variant={level === lv ? "default" : "outline"}
                        onClick={() => setLevel(lv)}
                      >
                        {lv}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <Button onClick={onSave} disabled={saving || loading} className="w-full">
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Save Profile"
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Recommended Skills</CardTitle>
            <CardDescription>Based on your selected track.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {recommended.map((s) => (
                <Badge key={s} variant="secondary" className="px-2 py-1">
                  {s}
                </Badge>
              ))}
            </div>

            <Separator className="my-5" />

            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                After saving, go to <span className="font-medium text-foreground">Copilot</span> to start a session.
              </p>
              <p>
                Your selected track will control skill suggestions and interview flows.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}