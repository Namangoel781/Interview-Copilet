"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthToken } from "@/lib/api";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const token = getAuthToken();
      if (!token) {
        setOk(false);
        router.replace("/login");
        return;
      }
      // Backend may not expose /auth/me yet.
      // For now, treat presence of a token as authenticated and let protected API calls
      // return 401 if the token is invalid/expired.
      if (!cancelled) setOk(true);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (ok === null) return null; // or a skeleton/loading UI
  if (!ok) return null;
  return <>{children}</>;
}