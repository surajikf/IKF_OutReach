"use client";

import { signOut } from "next-auth/react";
import { Ban, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { appPath } from "@/lib/app-path";

export default function BannedPage() {
    const router = useRouter();

    const handleLogout = async () => {
        await signOut({ callbackUrl: appPath("/login") });
    };
    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-900">
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-900/10 rounded-full blur-3xl pointer-events-none" />

            <div className="w-full max-w-md p-8 relative z-10 animate-in fade-in zoom-in-95 duration-700">
                <div className="bg-slate-800/80 backdrop-blur-xl rounded-3xl p-10 shadow-2xl border border-red-500/20 relative overflow-hidden text-center">

                    <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-3xl mx-auto flex items-center justify-center mb-6 relative">
                        <Ban className="w-10 h-10" />
                    </div>

                    <h1 className="text-2xl font-bold text-white tracking-tight mb-2">Access Revoked</h1>

                    <p className="text-sm font-medium text-slate-400 leading-relaxed mb-8">
                        Your neural profile has been permanently severed from the matrix by an Administrator.
                        Unauthorized access attempts are logged.
                    </p>

                    <button
                        onClick={handleLogout}
                        className="w-full bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl py-3 text-sm font-bold shadow-sm hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
                    >
                        <LogOut className="w-4 h-4" />
                        Logout
                    </button>
                </div>
            </div>
        </div>
    );
}
