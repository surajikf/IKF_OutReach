"use client";

import { signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useBranding } from "@/frontend/hooks/useBranding";
import { toast } from "sonner";
import Link from "next/link";
import { appPath } from "@/frontend/lib/app-path";

export default function LoginPage() {
    const { data: session, status: authStatus } = useSession();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(false);
    const { projectLogo } = useBranding();
    const authBrandName = "IKF Outreach";

    useEffect(() => {
        setMounted(true);
        
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const errorMsg = params.get("error");
            if (errorMsg) {
                toast.error(errorMsg);
                window.history.replaceState(null, '', window.location.pathname);
            }
        }
    }, []);

    useEffect(() => {
        if (authStatus !== "authenticated") return;
        const userStatus = (session?.user as any)?.status || "PENDING";
        if (userStatus === "PENDING") {
            router.replace(appPath("/pending-approval"));
            return;
        }
        router.replace(appPath("/"));
    }, [authStatus, session, router]);

    const handleGoogleLogin = async () => {
        setLoading(true);
        try {
            await signIn("google", { callbackUrl: "/" });
        } catch (error) {
            toast.error("Google authentication failed.");
            setLoading(false);
        }
    };

    if (!mounted) return null;

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-50">
            {/* Background Effects */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="w-full max-w-md p-8 relative z-10 animate-in fade-in zoom-in-95 duration-700">
                <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] border border-white/50 relative overflow-hidden">
                    {/* Header */}
                    <div className="text-center mb-10">
                        {projectLogo ? (
                            <div className="bg-slate-900 p-3 rounded-2xl shadow-lg border border-slate-800 flex items-center justify-center min-w-[4rem] w-fit mx-auto mb-6">
                                <img src={projectLogo} alt={authBrandName} className="h-10 w-auto object-contain" />
                            </div>
                        ) : (
                            <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl mx-auto flex items-center justify-center mb-5 shadow-lg shadow-blue-500/30">
                                <span className="text-white text-2xl font-black">{authBrandName.charAt(0)}</span>
                            </div>
                        )}
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 tracking-tight">
                            {authBrandName}
                        </h1>
                        <p className="text-sm font-medium text-slate-500 mt-2">Welcome back</p>
                    </div>

                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full bg-white text-slate-700 border border-slate-200 rounded-xl py-3.5 text-sm font-bold shadow-sm hover:shadow-md hover:bg-slate-50 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 mt-2 disabled:opacity-70 disabled:transform-none disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        ) : (
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                />
                                <path
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    fill="#EA4335"
                                />
                            </svg>
                        )}
                        {loading ? "Signing in..." : "Sign in with Google"}
                    </button>

                    <div className="mt-10 text-center border-t border-slate-100 pt-8">
                        <p className="text-xs font-medium text-slate-500">
                            First time here?{" "}
                            <Link href="/register" className="text-blue-600 font-bold hover:text-blue-700 transition-colors">
                                Register Your Profile
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
