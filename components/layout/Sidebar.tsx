"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
    LayoutDashboard,
    Users,
    Send,
    Settings,
    ListChecks,
    ShieldAlert,
    LogOut,
    UserCircle2,
    DownloadCloud,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    SlidersHorizontal,
    PlusCircle,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBranding } from "@/hooks/useBranding";
import { apiPath, appPath } from "@/lib/app-path";

const SETTINGS_PATHS = new Set(["/settings", "/import", "/admin"]);

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { data: session, status: authStatus } = useSession();
    const user = session?.user;
    const isAdmin = (user as any)?.role === "ADMIN";
    const [stats, setStats] = useState({ totalClients: 0, integrationReady: false });
    const { projectName, projectLogo } = useBranding();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);

    useEffect(() => {
        if (SETTINGS_PATHS.has(pathname)) setSettingsOpen(true);
    }, [pathname]);

    useEffect(() => {
        const saved = localStorage.getItem("sidebar_collapsed");
        if (saved === "true") setIsCollapsed(true);
    }, []);

    const toggleCollapse = () => {
        const next = !isCollapsed;
        setIsCollapsed(next);
        localStorage.setItem("sidebar_collapsed", String(next));
    };

    useEffect(() => {
        if (authStatus !== "authenticated") return;
        fetch(apiPath("/dashboard-stats"))
            .then((r) => r.ok ? r.json() : null)
            .then((d) => d && setStats(d))
            .catch(() => {});
    }, [pathname, authStatus]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (["INPUT", "TEXTAREA"].includes((document.activeElement as HTMLElement)?.tagName)) return;
        if (e.key?.toLowerCase() !== "g") return;
        const handler = (ne: KeyboardEvent) => {
            const k = ne.key?.toLowerCase();
            if (k === "d") router.push(appPath("/"));
            if (k === "c") router.push(appPath("/clients"));
            if (k === "m") router.push(appPath("/campaigns/list"));
            if (k === "s") router.push(appPath("/settings"));
            if (k === "i") router.push(appPath("/import"));
        };
        window.addEventListener("keydown", handler, { once: true });
    }, [router]);

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    const active = (href: string) => pathname === href;
    const isSettingsActive = SETTINGS_PATHS.has(pathname);

    const navItem = (href: string, Icon: any, label: string, badge?: React.ReactNode) => {
        const isActive = active(href);
        return (
            <Link
                key={href}
                href={appPath(href)}
                title={isCollapsed ? label : ""}
                className={cn(
                    "relative flex items-center rounded-xl transition-all duration-150 group/nav",
                    isCollapsed ? "justify-center w-10 h-10 mx-auto" : "gap-3 px-3 py-2.5",
                    isActive
                        ? "bg-white text-blue-600 shadow-sm border border-slate-200"
                        : "text-slate-500 hover:text-slate-800 hover:bg-white/70"
                )}
            >
                {isActive && (
                    <motion.div
                        layoutId="nav-pill"
                        className="absolute -left-[17px] w-[3px] h-5 bg-blue-600 rounded-r-full"
                    />
                )}
                <Icon
                    className={cn("shrink-0 w-[18px] h-[18px] transition-all",
                        isActive ? "text-blue-600" : "text-slate-400 group-hover/nav:text-slate-700")}
                    strokeWidth={isActive ? 2.5 : 2}
                />
                {!isCollapsed && (
                    <span className="text-[13px] font-medium tracking-tight flex-1">{label}</span>
                )}
                {!isCollapsed && badge}
                {isCollapsed && badge}
            </Link>
        );
    };

    return (
        <motion.div
            animate={{ width: isCollapsed ? 64 : 240 }}
            transition={{ type: "spring", stiffness: 400, damping: 40, mass: 1 }}
            className={cn(
                "h-screen border-r border-slate-200 bg-slate-50 flex flex-col z-50 sticky top-0 hidden md:flex group/sidebar overflow-hidden"
            )}
        >
            {/* Logo */}
            <div className={cn("px-4 pt-6 pb-4 flex items-center relative", isCollapsed ? "justify-center" : "justify-between")}>
                <div className="flex items-center gap-2.5">
                    {projectLogo ? (
                        <div className="bg-slate-900 p-2 rounded-xl border border-slate-800 flex items-center justify-center min-w-[2.5rem]">
                            <img
                                src={projectLogo}
                                alt={projectName}
                                className="h-7 w-auto object-contain"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                            />
                        </div>
                    ) : null}
                    {!projectLogo && (
                        <>
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-base shadow-sm shrink-0">
                                {projectName.charAt(0)}
                            </div>
                            {!isCollapsed && (
                                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-bold text-slate-900 text-[15px] tracking-tight leading-tight">
                                    {projectName}
                                </motion.span>
                            )}
                        </>
                    )}
                </div>
                <button
                    onClick={toggleCollapse}
                    className={cn(
                        "absolute -right-3 top-8 w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-300 shadow-md z-50 transition-all",
                        isCollapsed ? "opacity-100" : "opacity-0 group-hover/sidebar:opacity-100"
                    )}
                >
                    {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
                </button>
            </div>

            {/* Nav */}
            <nav className={cn("flex-1 flex flex-col gap-0.5 overflow-y-auto custom-scrollbar", isCollapsed ? "px-2.5" : "px-3")}>

                {/* Main items */}
                {navItem("/", LayoutDashboard, "Dashboard")}

                {/* Divider */}
                <div className={cn("my-1.5", isCollapsed ? "w-6 mx-auto border-t border-slate-200" : "border-t border-slate-200 mx-1")} />

                {navItem("/campaigns", PlusCircle, "Create Campaign")}
                {navItem("/campaigns/list", ListChecks, "Campaign List")}

                {/* Divider */}
                <div className={cn("my-1.5", isCollapsed ? "w-6 mx-auto border-t border-slate-200" : "border-t border-slate-200 mx-1")} />

                {navItem(
                    "/clients",
                    Users,
                    "Clients",
                    stats.totalClients > 0 ? (
                        <span className={cn(
                            "font-bold text-[11px] rounded-full transition-all",
                            isCollapsed
                                ? "absolute top-1 right-1 min-w-[14px] h-[14px] flex items-center justify-center bg-blue-600 text-white text-[9px] ring-2 ring-slate-50"
                                : "ml-auto px-1.5 py-0.5 bg-slate-100 text-slate-500 group-hover/nav:bg-blue-50 group-hover/nav:text-blue-600"
                        )}>
                            {isCollapsed && stats.totalClients > 999 ? "1k+" : stats.totalClients}
                        </span>
                    ) : undefined
                )}

                {/* Divider */}
                <div className={cn("my-1.5", isCollapsed ? "w-6 mx-auto border-t border-slate-200" : "border-t border-slate-200 mx-1")} />

                {/* Settings group */}
                {isCollapsed ? (
                    <button
                        onClick={() => { setIsCollapsed(false); localStorage.setItem("sidebar_collapsed", "false"); setSettingsOpen(true); }}
                        title="Settings"
                        className={cn(
                            "relative flex justify-center items-center w-10 h-10 mx-auto rounded-xl transition-all duration-150",
                            isSettingsActive ? "bg-white text-blue-600 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-800 hover:bg-white/70"
                        )}
                    >
                        <Settings className={cn("w-[18px] h-[18px]", isSettingsActive ? "text-blue-600" : "text-slate-400")} strokeWidth={isSettingsActive ? 2.5 : 2} />
                        {stats.integrationReady && (
                            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-1 ring-slate-50" />
                        )}
                    </button>
                ) : (
                    <>
                        {/* Settings toggle button */}
                        <button
                            onClick={() => setSettingsOpen((o) => !o)}
                            className={cn(
                                "relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group/nav w-full",
                                isSettingsActive ? "text-blue-600" : "text-slate-500 hover:text-slate-800 hover:bg-white/70"
                            )}
                        >
                            <Settings className={cn("shrink-0 w-[18px] h-[18px]", isSettingsActive ? "text-blue-600" : "text-slate-400 group-hover/nav:text-slate-700")} strokeWidth={isSettingsActive ? 2.5 : 2} />
                            <span className="text-[13px] font-medium tracking-tight flex-1 text-left">Settings</span>
                            {stats.integrationReady && !settingsOpen && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            )}
                            <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0", settingsOpen ? "rotate-180" : "")} />
                        </button>

                        {/* Sub-items */}
                        <AnimatePresence initial={false}>
                            {settingsOpen && (
                                <motion.div
                                    key="settings-sub"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.15, ease: "easeInOut" }}
                                    className="overflow-hidden"
                                >
                                    <div className="ml-4 pl-3 border-l-2 border-slate-200 flex flex-col gap-0.5 py-0.5">
                                        {[
                                            { href: "/settings", icon: SlidersHorizontal, label: "Configuration" },
                                            { href: "/import", icon: DownloadCloud, label: "Integrations" },
                                            ...(isAdmin ? [{ href: "/admin", icon: ShieldAlert, label: "Control Panel" }] : []),
                                        ].map(({ href, icon: Icon, label }) => {
                                            const isActive = pathname === href;
                                            return (
                                                <Link
                                                    key={href}
                                                    href={appPath(href)}
                                                    className={cn(
                                                        "flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 group/sub",
                                                        isActive
                                                            ? "bg-white text-blue-600 shadow-sm border border-slate-200"
                                                            : "text-slate-500 hover:text-slate-800 hover:bg-white/70"
                                                    )}
                                                >
                                                    <Icon className={cn("w-[15px] h-[15px] shrink-0", isActive ? "text-blue-600" : "text-slate-400 group-hover/sub:text-slate-600")} strokeWidth={isActive ? 2.5 : 2} />
                                                    <span className="text-[12px] font-medium">{label}</span>
                                                    {label === "Integrations" && stats.integrationReady && (
                                                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                    )}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </>
                )}
            </nav>

            {/* User footer */}
            <div className={cn("border-t border-slate-200 bg-slate-50", isCollapsed ? "p-2 flex flex-col items-center gap-1" : "p-3")}>
                {isCollapsed ? (
                    <>
                        <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-white text-xs font-bold">
                            {(user?.name || user?.email || "U")[0].toUpperCase()}
                        </div>
                        <button onClick={() => signOut({ callbackUrl: "/login" })} title="Logout" className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all">
                            <LogOut className="w-4 h-4" />
                        </button>
                    </>
                ) : (
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {(user?.name || user?.email || "U")[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-slate-800 truncate">{user?.name || "User"}</p>
                            <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
                        </div>
                        <button onClick={() => signOut({ callbackUrl: "/login" })} title="Logout" className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all shrink-0">
                            <LogOut className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
