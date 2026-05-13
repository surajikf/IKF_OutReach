"use client";

import { useState, useEffect, useCallback } from "react";
import { apiPath } from "@/lib/app-path";
import type { OnboardingState, OnboardingStep } from "@/app/(api)/api/onboarding/route";

export type { OnboardingState, OnboardingStep };

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);

  const loadState = useCallback(async () => {
    try {
      const res = await fetch(apiPath("/onboarding"));
      const json = await res.json();
      if (json.success) setState(json.data);
    } catch {
      // silently fail — onboarding is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const skipStep = useCallback(async (step: OnboardingStep) => {
    // Optimistic update
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        steps: { ...prev.steps, [step]: { ...prev.steps[step], skipped: true } },
      };
    });
    await fetch(apiPath("/onboarding"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "skip_step", step }),
    });
  }, []);

  const dismiss = useCallback(async () => {
    setState((prev) => (prev ? { ...prev, dismissed: true } : prev));
    await fetch(apiPath("/onboarding"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss" }),
    });
  }, []);

  return { state, loading, skipStep, dismiss, refresh: loadState };
}
