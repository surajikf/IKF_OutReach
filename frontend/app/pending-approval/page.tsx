"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { CheckCircle2, Clock3, LogOut, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { appPath } from "@/frontend/lib/app-path";

export default function PendingApprovalPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  const userStatus = useMemo(() => (session?.user as any)?.status, [session]);
  const userEmail = useMemo(() => session?.user?.email || "", [session]);

  useEffect(() => {
    if (status === "authenticated" && userStatus === "APPROVED") {
      router.replace(appPath("/"));
    }
    if (status === "unauthenticated") {
      router.replace(appPath("/login"));
    }
  }, [status, userStatus, router]);

  const checkNow = async () => {
    setChecking(true);
    try {
      await fetch(appPath("/api/auth/session"), { cache: "no-store" });
      router.refresh();
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (status !== "authenticated" || userStatus !== "PENDING") return;
    const id = setInterval(() => {
      checkNow().catch(() => {});
    }, 15000);
    return () => clearInterval(id);
  }, [status, userStatus]);

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(59,130,246,0.25),transparent_35%),radial-gradient(circle_at_85%_75%,rgba(14,165,233,0.2),transparent_35%)]" />
      <div className="absolute inset-0 opacity-30 bg-[linear-gradient(to_right,rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[size:28px_28px]" />

      <div className="relative min-h-screen flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-xl rounded-3xl border border-white/15 bg-white/10 backdrop-blur-xl p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/20 text-amber-300 flex items-center justify-center">
              <Clock3 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">IKF Outreach</p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Approval Pending</h1>
            </div>
          </div>

          <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
            Your profile is created. An admin will review and approve access shortly.
          </p>

          <div className="mt-4 flex items-center gap-2 text-xs text-slate-300">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Status: Waiting for admin approval</span>
          </div>

          {userEmail ? (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs sm:text-sm text-slate-100">
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              Signed in as <span className="font-semibold">{userEmail}</span>
            </div>
          ) : null}

          <div className="mt-6 rounded-2xl border border-white/15 bg-slate-900/40 p-4 sm:p-5">
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-300" />
              What happens next
            </p>
            <ul className="mt-3 space-y-2 text-sm text-slate-200">
              <li>1. Admin reviews your account request.</li>
              <li>2. After approval, this page will open the app automatically.</li>
            </ul>
            <p className="mt-3 text-xs text-slate-300">
              Tip: Keep this tab open. Status auto-check runs every 15 seconds.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={checkNow}
              disabled={checking}
              className="w-full rounded-xl border border-cyan-200/40 bg-cyan-400/10 text-cyan-50 py-3 text-sm font-semibold hover:bg-cyan-400/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {checking ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {checking ? "Checking..." : "Check Status"}
            </button>

            <button
              onClick={() => signOut({ callbackUrl: appPath("/login") })}
              className="w-full rounded-xl bg-white text-slate-900 py-3 text-sm font-semibold hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
