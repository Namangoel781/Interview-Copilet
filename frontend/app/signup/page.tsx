"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, setAuthToken } from "@/lib/api";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { RedirectIfAuthenticated } from "@/components/auth/RedirectIfAuthenticated";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await api.signup({ email, password });

      const token = (res as any).token ?? (res as any).access_token;
      if (!token) {
        throw new Error(
          "Signup succeeded but no token was returned by the backend."
        );
      }
      setAuthToken(token);
      const next =
        new URLSearchParams(window.location.search).get("next") || "/";
      router.push(next);
    } catch (e: any) {
      setErr(e?.message ?? "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <RedirectIfAuthenticated>
      <div className="min-h-[calc(100vh-2rem)] flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Create account</CardTitle>
            <CardDescription>
              Start your AI-driven interview prep journey.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Use a strong password (8+ characters recommended).
                </p>
              </div>

              {err && <p className="text-sm text-red-600">{err}</p>}

              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? "Creating..." : "Sign up"}
              </Button>

              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link className="underline" href="/login">
                  Login
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </RedirectIfAuthenticated>
  );
}
