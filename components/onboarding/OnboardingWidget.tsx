"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  SkipForward,
  ChevronDown,
  ChevronUp,
  X,
  Mail,
  Database,
  Users,
  FolderOpen,
  Send,
  Sparkles,
} from "lucide-react";
import { useOnboarding, type OnboardingStep } from "@/hooks/useOnboarding";
import { useBranding } from "@/hooks/useBranding";
import { appPath } from "@/lib/app-path";

interface StepConfig {
  id: OnboardingStep;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: string; // where to navigate on click
  spotlight: string; // spotlight target param
}

const STEP_CONFIG: StepConfig[] = [
  {
    id: "connect_gmail",
    label: "Connect Gmail",
    description: "Link your Gmail account to send emails and sync contacts.",
    icon: <Mail className="w-4 h-4" />,
    action: "/settings",
    spotlight: "gmail",
  },
  {
    id: "connect_bigin",
    label: "Connect Zoho Bigin",
    description: "Import your CRM deals and contacts from Zoho Bigin.",
    icon: <Database className="w-4 h-4" />,
    action: "/import",
    spotlight: "bigin",
  },
  {
    id: "connect_google_contacts",
    label: "Connect Google Contacts",
    description: "Sync your Google Contacts as outreach targets.",
    icon: <Users className="w-4 h-4" />,
    action: "/import",
    spotlight: "google_contacts",
  },
  {
    id: "import_contacts",
    label: "Import Your Contacts",
    description: "Bring in contacts from your connected sources.",
    icon: <FolderOpen className="w-4 h-4" />,
    action: "/import",
    spotlight: "import",
  },
  {
    id: "create_campaign",
    label: "Create Your First Campaign",
    description: "Draft and send your first outreach email campaign.",
    icon: <Send className="w-4 h-4" />,
    action: "/campaigns",
    spotlight: "campaign",
  },
];

export function OnboardingWidget() {
  const { state, loading, skipStep, dismiss } = useOnboarding();
  const { projectName } = useBranding();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [confirmDismiss, setConfirmDismiss] = useState(false);

  if (loading || !state) return null;
  if (state.dismissed) return null;
  if (state.allDone) return null;

  const completedCount = STEP_CONFIG.filter(
    (s) => state.steps[s.id]?.completed,
  ).length;
  const totalCount = STEP_CONFIG.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);

  const handleStepClick = (step: StepConfig) => {
    const url = appPath(`${step.action}?onboarding=${step.spotlight}`);
    router.push(url);
  };

  const handleDismiss = async () => {
    if (!confirmDismiss) {
      setConfirmDismiss(true);
      return;
    }
    await dismiss();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Get started with {projectName || "IKF Outreach"}
            </h3>
            <p className="text-xs text-slate-500">
              {completedCount} of {totalCount} steps complete
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
          {confirmDismiss ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">Hide forever?</span>
              <button
                onClick={handleDismiss}
                className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 font-medium transition-colors"
              >
                Yes, hide
              </button>
              <button
                onClick={() => setConfirmDismiss(false)}
                className="text-xs px-2 py-1 rounded bg-slate-50 text-slate-600 hover:bg-slate-100 font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
              title="Dismiss guide"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-slate-100">
        <div
          className="h-full bg-blue-500 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Steps */}
      {!collapsed && (
        <div className="divide-y divide-slate-50">
          {STEP_CONFIG.map((step) => {
            const stepState = state.steps[step.id];
            const isCompleted = stepState?.completed;
            const isSkipped = stepState?.skipped;
            const isDone = isCompleted || isSkipped;

            return (
              <div
                key={step.id}
                className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${
                  isDone
                    ? "opacity-50"
                    : "hover:bg-slate-50 cursor-pointer group"
                }`}
                onClick={() => !isDone && handleStepClick(step)}
              >
                {/* Status icon */}
                <div className="flex-shrink-0">
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : isSkipped ? (
                    <SkipForward className="w-5 h-5 text-slate-300" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-300 group-hover:text-blue-400 transition-colors" />
                  )}
                </div>

                {/* Icon + text */}
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isCompleted
                      ? "bg-green-50 text-green-500"
                      : isSkipped
                        ? "bg-slate-50 text-slate-300"
                        : "bg-blue-50 text-blue-500"
                  }`}
                >
                  {step.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      isDone ? "line-through text-slate-400" : "text-slate-800"
                    }`}
                  >
                    {step.label}
                  </p>
                  {!isDone && (
                    <p className="text-xs text-slate-500 truncate">
                      {step.description}
                    </p>
                  )}
                </div>

                {/* Skip button */}
                {!isDone && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      skipStep(step.id);
                    }}
                    className="flex-shrink-0 text-xs text-slate-400 hover:text-slate-600 hover:underline transition-colors opacity-0 group-hover:opacity-100"
                  >
                    Skip
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      {!collapsed && (
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Click any step to go there, or skip ones you don&apos;t need.
          </p>
          <button
            onClick={() => {
              STEP_CONFIG
                .filter((s) => !state.steps[s.id]?.completed && !state.steps[s.id]?.skipped)
                .forEach((s) => skipStep(s.id));
            }}
            className="text-xs text-slate-400 hover:text-slate-600 hover:underline transition-colors"
          >
            Skip all
          </button>
        </div>
      )}
    </div>
  );
}
