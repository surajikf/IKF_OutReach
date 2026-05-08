"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
    LayoutDashboard,
    Users,
    Send,
    Settings,
    Zap,
    FolderKanban,
    ShieldAlert,
    LogOut,
    UserCircle2,
    DownloadCloud
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBranding } from "@/hooks/useBranding";
import { apiPath, appPath } from "@/lib/app-path";

const topNavigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
];

const navigation = [
    { name: "Integrations", href: "/import", icon: DownloadCloud },
    { name: "Clients", href: "/clients", icon: Users },
    { name: "Control Panel", href: "/admin", icon: ShieldAlert, adminOnly: true },
    { name: "Settings", href: "/settings", icon: Settings },
];

const campaignNavigation = [
    { name: "1. Create Campaign", href: "/campaigns", icon: Send },
    { name: "2. Campaign List", href: "/campaigns/list", icon: Zap },
];

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { data: session, status: authStatus } = useSession();
    const user = session?.user;
    const [stats, setStats] = useState({ totalClients: 0, integrationReady: false });
    const { projectName, projectLogo } = useBranding();

    const handleLogout = async () => {
        await signOut({ callbackUrl: "/login" });
    };

    // 2. Fetch Sidebar Stats (Fast/Smart)
    useEffect(() => {
        if (authStatus === "authenticated") {
            const fetchSidebarStats = async () => {
                try {
                    const res = await fetch(apiPath("/dashboard-stats"));
                    if (res.ok) setStats(await res.json());
                } catch (error) {
                    console.error("Sidebar stats failure", error);
                }
            };
            fetchSidebarStats();
        }
    }, [pathname, authStatus]);

    // 2. Keyboard Shortcuts (Smart)
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Only trigger if no input is focused
        if (["INPUT", "TEXTAREA"].includes((document.activeElement as HTMLElement)?.tagName)) return;

        if (e.key?.toLowerCase() === "g") {
            const nextKeyHandler = (ne: KeyboardEvent) => {
                const key = ne.key?.toLowerCase();
                if (key === "d") router.push(appPath("/"));
                if (key === "c") router.push(appPath("/clients"));
                if (key === "m") router.push(appPath("/campaigns/list"));
                if (key === "s") router.push(appPath("/settings"));
                if (key === "i") router.push(appPath("/import"));
                window.removeEventListener("keydown", nextKeyHandler);
            };
            window.addEventListener("keydown", nextKeyHandler, { once: true });
        }
    }, [router]);

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    return (
        <div className="w-64 h-screen border-r border-slate-200 bg-slate-50 flex flex-col z-50 sticky top-0 hidden md:flex">
            <div className="p-6 pt-8 pb-8 flex justify-start">
                <div className="flex items-center gap-3 group">
                    {projectLogo ? (
                        <div className="bg-slate-900 p-2 rounded-xl shadow-sm border border-slate-800 flex items-center justify-center min-w-[3rem]">
                            <img src={projectLogo} alt={projectName} className="h-8 w-auto object-contain" />
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-lg shadow-sm">
                                {projectName.charAt(0)}
                            </div>
                            <span className="font-bold text-slate-900 tracking-tight text-lg">{projectName}</span>
                        </div>
                    )}
                </div>
            </div>

            <nav className="flex-1 px-4 space-y-1 mt-4 custom-scrollbar overflow-y-auto">
                <div className="px-4 mb-2 text-xs font-semibold text-slate-400 tracking-wider">OVERVIEW</div>
                {topNavigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-2 rounded-md transition-colors duration-150 group",
                                isActive
                                    ? "bg-white text-slate-900 font-medium shadow-sm border border-slate-200/60"
                                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"
                            )}
                        >
                            <item.icon className={cn(
                                "w-[18px] h-[18px] transition-transform group-hover:scale-110",
                                isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                            )} strokeWidth={isActive ? 2.5 : 2} />
                            <span className="text-sm">{item.name}</span>
                        </Link>
                    );
                })}

                <div className="px-4 mt-5 mb-2 text-xs font-semibold text-slate-400 tracking-wider flex items-center gap-2">
                    <FolderKanban className="w-3.5 h-3.5" />
                    CAMPAIGNS
                </div>
                {campaignNavigation.map((item) => {
                    const href = item.href;
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={appPath(href)}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-2 rounded-md transition-colors duration-150 group",
                                isActive
                                    ? "bg-white text-slate-900 font-medium shadow-sm border border-slate-200/60"
                                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"
                            )}
                        >
                            <item.icon className={cn(
                                "w-[18px] h-[18px] transition-transform group-hover:scale-110",
                                isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                            )} strokeWidth={isActive ? 2.5 : 2} />
                            <span className="text-sm">{item.name}</span>
                        </Link>
                    );
                })}

                <div className="px-4 mt-5 mb-2 text-xs font-semibold text-slate-400 tracking-wider">OPERATIONS</div>
                {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    if ((item as any).adminOnly && (user as any)?.role !== "ADMIN") return null;

                    const defaultLink = (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-2 rounded-md transition-colors duration-150 group",
                                isActive
                                    ? "bg-white text-slate-900 font-medium shadow-sm border border-slate-200/60"
                                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"
                            )}
                        >
                            <item.icon className={cn(
                                "w-[18px] h-[18px] transition-transform group-hover:scale-110",
                                isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                            )} strokeWidth={isActive ? 2.5 : 2} />
                            <div className="flex flex-col items-start translate-y-[1px]">
                                <span className="text-sm">{item.name}</span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">
                                    G + {item.name[0].toUpperCase()}
                                </span>
                            </div>

                            {/* Smart Badges */}
                            {item.name === "Clients" && stats.totalClients > 0 && (
                                <motion.span
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="ml-auto text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors"
                                >
                                    {stats.totalClients}
                                </motion.span>
                            )}
                            {item.name === "Integrations" && stats.integrationReady && (
                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            )}
                        </Link>
                    );

                    return defaultLink;
                })}
            </nav>

            <div className="p-4 border-t border-slate-200/80 bg-slate-50/50">
                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                            {(user as any)?.role === "ADMIN" ? <ShieldAlert className="w-4 h-4 text-red-500" /> : <UserCircle2 className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                                {user?.name || "User"}
                            </p>
                            <p className="text-[10px] font-medium text-slate-500 truncate">
                                {user?.email}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                    >
                        <LogOut className="w-3.5 h-3.5" />
                        Logout
                    </button>
                </div>
            </div>
        </div>
    );
}
