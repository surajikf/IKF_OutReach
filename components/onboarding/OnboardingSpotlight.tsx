"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { X, ArrowRight } from "lucide-react";
import { useOnboarding } from "@/hooks/useOnboarding";
import type { OnboardingStep } from "@/hooks/useOnboarding";
import { appPath } from "@/lib/app-path";

interface SpotlightConfig {
  param: string;
  step: OnboardingStep;
  title: string;
  body: string;
  targetSelector: string;
  nextRoute?: string;
  nextLabel?: string;
}

const SPOTLIGHT_MAP: SpotlightConfig[] = [
  {
    param: "gmail",
    step: "connect_gmail",
    title: "Connect your Gmail account",
    body: "Click 'Add Gmail Account' to link your Gmail. Once connected, you can send outreach emails directly from your inbox.",
    targetSelector: "[data-onboarding='gmail-section']",
    nextRoute: "/import?onboarding=bigin",
    nextLabel: "Next: Connect Bigin",
  },
  {
    param: "bigin",
    step: "connect_bigin",
    title: "Connect Zoho Bigin",
    body: "Click 'Connect Zoho' to import your CRM contacts and deals directly into IKF Outreach.",
    targetSelector: "[data-onboarding='bigin-section']",
    nextRoute: "/import?onboarding=google_contacts",
    nextLabel: "Next: Google Contacts",
  },
  {
    param: "google_contacts",
    step: "connect_google_contacts",
    title: "Sync Google Contacts",
    body: "Connect Google Contacts to pull in your address book as outreach targets.",
    targetSelector: "[data-onboarding='google-contacts-section']",
    nextRoute: "/import?onboarding=import",
    nextLabel: "Next: Import Contacts",
  },
  {
    param: "import",
    step: "import_contacts",
    title: "Import your contacts",
    body: "Use the sync buttons to pull contacts from your connected sources into your client list.",
    targetSelector: "[data-onboarding='import-section']",
    nextRoute: "/campaigns?onboarding=campaign",
    nextLabel: "Next: Create a Campaign",
  },
  {
    param: "campaign",
    step: "create_campaign",
    title: "Create your first campaign",
    body: "Click 'New Campaign' to start crafting your first outreach email. Choose a template, select recipients, and send!",
    targetSelector: "[data-onboarding='new-campaign-btn']",
  },
];

interface TooltipPos {
  // All viewport-relative (for position: fixed)
  top?: number;
  bottom?: number;
  left: number;
  placement: "above" | "below";
}

export function OnboardingSpotlight() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { state, skipStep } = useOnboarding();
  const [tooltipPos, setTooltipPos] = useState<TooltipPos | null>(null);
  const [visible, setVisible] = useState(false);
  const observerRef = useRef<MutationObserver | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onboardingParam = searchParams.get("onboarding");
  const config = SPOTLIGHT_MAP.find((c) => c.param === onboardingParam);

  const positionTooltip = useCallback((targetSelector: string) => {
    const target = document.querySelector(targetSelector);
    if (!target) return false;

    // Use "instant" so rect is accurate immediately after scroll
    target.scrollIntoView({ behavior: "instant", block: "center" });

    // Read rect after scroll settles (one rAF is enough for instant scroll)
    requestAnimationFrame(() => {
      const rect = target.getBoundingClientRect();
      const viewportH = window.innerHeight;
      const spaceBelow = viewportH - rect.bottom;
      const placement = spaceBelow >= 180 ? "below" : "above";

      // All coordinates are viewport-relative (fixed positioning)
      const left = Math.max(16, Math.min(rect.left, window.innerWidth - 336));

      setTooltipPos(
        placement === "below"
          ? { top: rect.bottom + 12, left, placement }
          : { bottom: viewportH - rect.top + 12, left, placement },
      );
      setVisible(true);
      target.classList.add("onboarding-pulse");
    });

    return true;
  }, []);

  // Reset visibility whenever config changes (new spotlight param)
  useEffect(() => {
    setVisible(false);
    setTooltipPos(null);
  }, [onboardingParam]);

  useEffect(() => {
    if (!config || !state) return;
    if (state.dismissed) return;

    const selector = config.targetSelector;

    const tryPosition = () => positionTooltip(selector);

    if (!tryPosition()) {
      observerRef.current = new MutationObserver(() => {
        if (tryPosition()) {
          observerRef.current?.disconnect();
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
        }
      });
      observerRef.current.observe(document.body, { childList: true, subtree: true });

      // Safety timeout — give up after 5s if target never appears
      timeoutRef.current = setTimeout(() => {
        observerRef.current?.disconnect();
      }, 5000);
    }

    return () => {
      observerRef.current?.disconnect();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      document.querySelector(selector)?.classList.remove("onboarding-pulse");
    };
  }, [config, state, positionTooltip]);

  const cleanUrl = () => router.replace(appPath(pathname));

  const handleSkip = async () => {
    if (config) await skipStep(config.step);
    setVisible(false);
    cleanUrl();
  };

  const handleNext = () => {
    setVisible(false);
    if (config?.nextRoute) router.push(appPath(config.nextRoute));
    else cleanUrl();
  };

  const handleClose = () => {
    setVisible(false);
    cleanUrl();
  };

  if (!config || !visible || !tooltipPos || !state || state.dismissed) return null;

  const stepState = state.steps[config.step];
  const isAlreadyDone = stepState?.completed || stepState?.skipped;

  return (
    <>
      {/* Clickable dim overlay — clicking outside closes the spotlight */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        aria-hidden="true"
        onClick={handleClose}
      />

      {/* Tooltip card */}
      <div
        className="fixed z-50 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl p-5"
        style={{
          top: tooltipPos.top,
          bottom: tooltipPos.bottom,
          left: tooltipPos.left,
        }}
      >
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-medium mb-3">
          Setup Guide
        </div>

        <h4 className="text-sm font-semibold text-slate-900 mb-1.5 pr-6">
          {config.title}
        </h4>
        <p className="text-xs text-slate-500 leading-relaxed mb-4">
          {isAlreadyDone
            ? "You've already completed this step! Move on to the next one."
            : config.body}
        </p>

        <div className="flex items-center gap-2">
          {config.nextRoute && (
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors"
            >
              {config.nextLabel || "Next"}
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
          {!isAlreadyDone && (
            <button
              onClick={handleSkip}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 hover:underline transition-colors"
            >
              Skip this step
            </button>
          )}
          {isAlreadyDone && (
            <button
              onClick={handleClose}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 hover:underline transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </>
  );
}
