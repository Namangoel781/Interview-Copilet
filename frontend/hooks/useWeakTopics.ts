"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { WeakTopic } from "@/types/copilot";

export function useWeakTopics(sessionId: number | null, refreshKey: unknown) {
  const [weakTopics, setWeakTopics] = useState<WeakTopic[]>([]);
  const [loadingWeak, setLoadingWeak] = useState(false);
  const [errorWeak, setErrorWeak] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    if (!sessionId) {
      setWeakTopics([]);
      setErrorWeak(null);
      setLoadingWeak(false);
      return () => controller.abort();
    }

    let cancelled = false;

    (async () => {
      setLoadingWeak(true);
      setErrorWeak(null);
      try {
        const data = await api.weakTopics(sessionId, { signal: controller.signal });
        if (!cancelled) setWeakTopics(data);
      } catch (e: any) {
        // Ignore abort errors (navigation/session switch)
        const name = e?.name;
        const msg = e?.message || e?.detail || "Failed to load weak topics";
        if (!cancelled && name !== "AbortError") setErrorWeak(msg);
      } finally {
        if (!cancelled) setLoadingWeak(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [sessionId, refreshKey]);

  // `loading` is kept for older components that expect this name.
  return { weakTopics, loadingWeak, loading: loadingWeak, errorWeak };
}