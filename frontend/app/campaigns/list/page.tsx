"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Edit3, RefreshCw, Send, Search, FileDown } from "lucide-react";
import { toast } from "sonner";
import { apiPath, appPath } from "@/frontend/lib/app-path";

type CampaignRecord = {
    id: string;
    campaignType: string;
    campaignTopic: string;
    generatedOutput: string;
    dateCreated: string;
    client?: {
        clientName?: string;
        email?: string;
    };
    dispatchStatus?: "GENERATED" | "DRAFT_SAVED" | "SENT" | "FAILED" | "PROCESSING";
    dispatchUpdatedAt?: string | null;
};

export default function CampaignListPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState<CampaignRecord[]>([]);
    const [search, setSearch] = useState("");
    const [dispatchingId, setDispatchingId] = useState<string | null>(null);
    const [dispatchMode, setDispatchMode] = useState<"SEND" | "DRAFT">("SEND");
    const [statusFilter, setStatusFilter] = useState<"ALL" | "GENERATED" | "DRAFT_SAVED" | "SENT" | "FAILED" | "PROCESSING">("ALL");

    const load = async () => {
        setLoading(true);
        try {
            const qs = new URLSearchParams();
            qs.set("limit", "200");
            if (search.trim()) qs.set("search", search.trim());
            const res = await fetch(apiPath(`/campaigns/list?${qs.toString()}`));
            const json = await res.json();
            if (json?.success && Array.isArray(json.data)) {
                setRecords(json.data);
            } else {
                setRecords([]);
            }
        } catch {
            setRecords([]);
            toast.error("Failed to load campaigns.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const t = setTimeout(() => {
            load();
        }, 250);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const runDispatch = async (campaignId: string, mode: "SEND" | "DRAFT") => {
        setDispatchingId(campaignId);
        setDispatchMode(mode);
        try {
            const res = await fetch(apiPath("/campaigns/dispatch/batch"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ campaignIds: [campaignId], dispatchMode: mode }),
            });
            const json = await res.json();
            const jobId = json?.data?.jobId as string | undefined;
            if (!res.ok || !json?.success || !jobId) {
                toast.error(json?.error?.message || "Could not start action.");
                return;
            }

            const poll = async () => {
                const jr = await fetch(apiPath(`/jobs/${encodeURIComponent(jobId)}`));
                const j = await jr.json();
                const job = j?.data?.job;
                if (!job) {
                    setTimeout(poll, 1500);
                    return;
                }
                if (job.status === "RUNNING" || job.status === "QUEUED") {
                    setTimeout(poll, 1500);
                    return;
                }
                if (job.status === "FAILED") {
                    toast.error(job.error || "Action failed.");
                    setDispatchingId(null);
                    return;
                }
                const okCount = Number(job?.result?.successCount ?? 0);
                toast.success(
                    mode === "DRAFT"
                        ? `${okCount || 1} Gmail draft created.`
                        : `${okCount || 1} email sent.`
                );
                setDispatchingId(null);
                await load();
            };

            poll();
        } catch {
            toast.error("Network error.");
            setDispatchingId(null);
        }
    };

    const rows = useMemo(() => {
        if (statusFilter === "ALL") return records;
        return records.filter((r) => r.dispatchStatus === statusFilter);
    }, [records, statusFilter]);

    const statusMeta: Record<string, { label: string; cls: string }> = {
        GENERATED: { label: "Generated", cls: "bg-slate-100 text-slate-700 border-slate-200" },
        DRAFT_SAVED: { label: "Draft Saved", cls: "bg-amber-50 text-amber-700 border-amber-200" },
        SENT: { label: "Sent", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
        FAILED: { label: "Failed", cls: "bg-rose-50 text-rose-700 border-rose-200" },
        PROCESSING: { label: "Processing", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    };

    const getPrimaryActionLabel = (status: CampaignRecord["dispatchStatus"]) => {
        if (status === "SENT") return "Resend";
        if (status === "FAILED") return "Retry";
        return "Send";
    };

    return (
        <div className="w-full px-3 sm:px-5 lg:px-8 py-5 sm:py-6 space-y-5 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Campaign List</h1>
                    <p className="text-sm text-slate-500 mt-1">Open, send, or save drafts from recent campaigns.</p>
                </div>
                <button
                    onClick={() => router.push(appPath("/campaigns"))}
                    className="h-10 px-4 rounded-md border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 w-full sm:w-auto"
                >
                    Create Campaign
                </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by client, subject, or content..."
                    className="w-full text-sm outline-none"
                />
            </div>
            <div className="flex flex-wrap gap-2">
                {(["ALL", "GENERATED", "DRAFT_SAVED", "SENT", "FAILED", "PROCESSING"] as const).map((s) => (
                    <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`h-9 px-3 rounded-md border text-xs font-semibold ${
                            statusFilter === s ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-300"
                        }`}
                    >
                        {s === "ALL" ? "All" : statusMeta[s].label}
                    </button>
                ))}
            </div>

            <div className="hidden lg:block bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-12 gap-3 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 bg-slate-50">
                    <div className="col-span-4">Client / Subject</div>
                    <div className="col-span-2">Type</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-2">Updated</div>
                    <div className="col-span-2 text-right">Actions</div>
                </div>

                {loading ? (
                    <div className="p-8 text-sm text-slate-500 flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Loading campaigns...
                    </div>
                ) : rows.length === 0 ? (
                    <div className="p-8 text-sm text-slate-500">No campaigns found.</div>
                ) : (
                    rows.map((r) => {
                        const busy = dispatchingId === r.id;
                        return (
                            <div key={r.id} className="grid grid-cols-12 gap-3 px-4 py-4 border-b border-slate-100 items-center">
                                <div className="col-span-4 min-w-0">
                                    <div className="text-sm font-semibold text-slate-900 truncate">{r.client?.clientName || "Unknown Client"}</div>
                                    <div className="text-xs text-slate-500 truncate">{r.campaignTopic || "Untitled Campaign"}</div>
                                </div>
                                <div className="col-span-2">
                                    <span className="px-2 py-1 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                                        {r.campaignType}
                                    </span>
                                </div>
                                <div className="col-span-2 text-xs text-slate-500 flex items-center gap-1">
                                    <span className={`px-2 py-1 rounded-md text-[11px] font-semibold border ${statusMeta[r.dispatchStatus || "GENERATED"].cls}`}>
                                        {statusMeta[r.dispatchStatus || "GENERATED"].label}
                                    </span>
                                </div>
                                <div className="col-span-2 text-xs text-slate-500 flex items-center gap-1">
                                    <Clock3 className="w-3.5 h-3.5" />
                                    {new Date((r.dispatchUpdatedAt || r.dateCreated) as string).toLocaleString()}
                                </div>
                                <div className="col-span-2 flex justify-end gap-2">
                                    <button
                                        onClick={() => router.push(appPath(`/campaigns/results?campaignId=${encodeURIComponent(r.id)}`))}
                                        className="h-11 min-w-[106px] px-3 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5"
                                    >
                                        <Edit3 className="w-3.5 h-3.5" />
                                        {r.dispatchStatus === "DRAFT_SAVED" ? "Continue Draft" : "Continue"}
                                    </button>
                                    <button
                                        onClick={() => runDispatch(r.id, "DRAFT")}
                                        disabled={busy || r.dispatchStatus === "PROCESSING"}
                                        className="h-11 min-w-[106px] px-3 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5 disabled:opacity-50"
                                    >
                                        {busy && dispatchMode === "DRAFT" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                                        {r.dispatchStatus === "DRAFT_SAVED" ? "Update Draft" : "Save Draft"}
                                    </button>
                                    <button
                                        onClick={() => runDispatch(r.id, "SEND")}
                                        disabled={busy || r.dispatchStatus === "PROCESSING"}
                                        className="h-11 min-w-[88px] px-3 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 flex items-center justify-center gap-1.5 disabled:opacity-50"
                                    >
                                        {busy && dispatchMode === "SEND" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                        {getPrimaryActionLabel(r.dispatchStatus)}
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <div className="lg:hidden space-y-3">
                {loading ? (
                    <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-500 flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Loading campaigns...
                    </div>
                ) : rows.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-500">No campaigns found.</div>
                ) : (
                    rows.map((r) => {
                        const busy = dispatchingId === r.id;
                        return (
                            <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                                <div>
                                    <div className="text-sm font-semibold text-slate-900">{r.client?.clientName || "Unknown Client"}</div>
                                    <div className="text-xs text-slate-500 mt-1">{r.campaignTopic || "Untitled Campaign"}</div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="px-2 py-1 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                                        {r.campaignType}
                                    </span>
                                    <span className={`px-2 py-1 rounded-md text-[11px] font-semibold border ${statusMeta[r.dispatchStatus || "GENERATED"].cls}`}>
                                        {statusMeta[r.dispatchStatus || "GENERATED"].label}
                                    </span>
                                    <span className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                                        <Clock3 className="w-3.5 h-3.5" />
                                        {new Date((r.dispatchUpdatedAt || r.dateCreated) as string).toLocaleString()}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <button
                                        onClick={() => router.push(appPath(`/campaigns/results?campaignId=${encodeURIComponent(r.id)}`))}
                                        className="h-10 px-3 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5"
                                    >
                                        <Edit3 className="w-3.5 h-3.5" />
                                        {r.dispatchStatus === "DRAFT_SAVED" ? "Continue Draft" : "Continue"}
                                    </button>
                                    <button
                                        onClick={() => runDispatch(r.id, "DRAFT")}
                                        disabled={busy || r.dispatchStatus === "PROCESSING"}
                                        className="h-10 px-3 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5 disabled:opacity-50"
                                    >
                                        {busy && dispatchMode === "DRAFT" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                                        {r.dispatchStatus === "DRAFT_SAVED" ? "Update Draft" : "Save Draft"}
                                    </button>
                                    <button
                                        onClick={() => runDispatch(r.id, "SEND")}
                                        disabled={busy || r.dispatchStatus === "PROCESSING"}
                                        className="h-10 px-3 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 flex items-center justify-center gap-1.5 disabled:opacity-50"
                                    >
                                        {busy && dispatchMode === "SEND" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                        {getPrimaryActionLabel(r.dispatchStatus)}
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
