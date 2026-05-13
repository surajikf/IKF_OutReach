"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Edit3, RefreshCw, Send, Search, FileDown, Eye, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { apiPath, appPath } from "@/lib/app-path";

type DispatchStatus = "GENERATED" | "DRAFT_SAVED" | "SENT" | "FAILED" | "PROCESSING";

type CampaignRecord = {
    id: string;
    campaignType: string;
    campaignTopic: string;
    generatedOutput: string;
    dateCreated: string;
    client?: { clientName?: string; email?: string };
    dispatchStatus?: DispatchStatus;
    dispatchUpdatedAt?: string | null;
};

type ConfirmDialog =
    | { type: "send"; record: CampaignRecord }
    | { type: "delete"; record: CampaignRecord }
    | { type: "bulk-delete"; count: number }
    | null;

const STATUS_META: Record<string, { label: string; cls: string }> = {
    GENERATED:  { label: "Generated",  cls: "bg-slate-100 text-slate-700 border-slate-200" },
    DRAFT_SAVED:{ label: "Draft Saved",cls: "bg-amber-50 text-amber-700 border-amber-200" },
    SENT:       { label: "Sent",       cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    FAILED:     { label: "Failed",     cls: "bg-rose-50 text-rose-700 border-rose-200" },
    PROCESSING: { label: "Processing", cls: "bg-blue-50 text-blue-700 border-blue-200" },
};

function ConfirmModal({ dialog, onConfirm, onCancel }: {
    dialog: ConfirmDialog;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    if (!dialog) return null;

    if (dialog.type === "send") {
        const r = dialog.record;
        const clientName = r.client?.clientName || "this client";
        const email = r.client?.email || "";
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md mx-4 p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                            <Send className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-900">Send this email?</p>
                            <p className="text-xs text-slate-500 mt-0.5">This action cannot be undone.</p>
                        </div>
                    </div>
                    <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm space-y-1">
                        <div className="flex gap-2">
                            <span className="text-slate-400 w-10 shrink-0">To:</span>
                            <span className="font-semibold text-slate-800">{clientName}</span>
                        </div>
                        {email && (
                            <div className="flex gap-2">
                                <span className="text-slate-400 w-10 shrink-0"></span>
                                <span className="text-slate-500">{email}</span>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <span className="text-slate-400 w-10 shrink-0">Re:</span>
                            <span className="text-slate-600 truncate">{r.campaignTopic}</span>
                        </div>
                    </div>
                    <div className="flex gap-3 pt-1">
                        <button onClick={onCancel} className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                            Cancel
                        </button>
                        <button onClick={onConfirm} className="flex-1 h-10 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                            <Send className="w-3.5 h-3.5" /> Send Now
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (dialog.type === "bulk-delete") {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm mx-4 p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                            <Trash2 className="w-5 h-5 text-rose-600" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-900">Delete selected campaigns?</p>
                            <p className="text-xs text-slate-500 mt-0.5">This cannot be undone.</p>
                        </div>
                    </div>
                    <p className="text-sm text-slate-600 bg-slate-50 rounded-xl px-4 py-3">
                        <span className="font-semibold text-slate-800">{dialog.count}</span> campaign{dialog.count === 1 ? "" : "s"} will be permanently removed.
                    </p>
                    <div className="flex gap-3">
                        <button onClick={onCancel} className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                            Cancel
                        </button>
                        <button onClick={onConfirm} className="flex-1 h-10 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition-colors flex items-center justify-center gap-2">
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const r = dialog.record;
    const clientName = r.client?.clientName || "this client";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm mx-4 p-6 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                        <Trash2 className="w-5 h-5 text-rose-600" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-900">Delete this campaign?</p>
                        <p className="text-xs text-slate-500 mt-0.5">This cannot be undone.</p>
                    </div>
                </div>
                <p className="text-sm text-slate-600 bg-slate-50 rounded-xl px-4 py-3">
                    Campaign for <span className="font-semibold text-slate-800">{clientName}</span> will be permanently removed.
                </p>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                        Cancel
                    </button>
                    <button onClick={onConfirm} className="flex-1 h-10 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition-colors flex items-center justify-center gap-2">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function CampaignListPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState<CampaignRecord[]>([]);
    const [search, setSearch] = useState("");
    const [busyId, setBusyId] = useState<string | null>(null);
    const [busyMode, setBusyMode] = useState<"SEND" | "DRAFT" | "DELETE" | null>(null);
    const [statusFilter, setStatusFilter] = useState<"ALL" | DispatchStatus>("ALL");
    const [confirm, setConfirm] = useState<ConfirmDialog>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const load = async () => {
        setLoading(true);
        try {
            const qs = new URLSearchParams({ limit: "200" });
            if (search.trim()) qs.set("search", search.trim());
            const res = await fetch(apiPath(`/campaigns/list?${qs}`));
            const json = await res.json();
            setRecords(json?.success && Array.isArray(json.data) ? json.data : []);
        } catch {
            setRecords([]);
            toast.error("Failed to load campaigns.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const t = setTimeout(load, 250);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const runDispatch = async (campaignId: string, mode: "SEND" | "DRAFT") => {
        setBusyId(campaignId);
        setBusyMode(mode);
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
                setBusyId(null);
                return;
            }
            const poll = async () => {
                const jr = await fetch(apiPath(`/jobs/${encodeURIComponent(jobId)}`));
                const j = await jr.json();
                const job = j?.data?.job;
                if (!job || job.status === "RUNNING" || job.status === "QUEUED") { setTimeout(poll, 1500); return; }
                if (job.status === "FAILED") { toast.error(job.error || "Action failed."); setBusyId(null); return; }
                const okCount = Number(job?.result?.successCount ?? 0);
                toast.success(mode === "DRAFT" ? `${okCount || 1} Gmail draft saved.` : `${okCount || 1} email sent successfully.`);
                setBusyId(null);
                await load();
            };
            poll();
        } catch {
            toast.error("Network error.");
            setBusyId(null);
        }
    };

    const runDelete = async (campaignId: string) => {
        setBusyId(campaignId);
        setBusyMode("DELETE");
        try {
            const res = await fetch(apiPath(`/campaigns/${encodeURIComponent(campaignId)}`), { method: "DELETE" });
            if (res.ok) {
                toast.success("Campaign deleted.");
                setRecords((prev) => prev.filter((r) => r.id !== campaignId));
            } else {
                const json = await res.json().catch(() => ({}));
                toast.error(json?.error || "Failed to delete.");
            }
        } catch {
            toast.error("Network error.");
        } finally {
            setBusyId(null);
            setBusyMode(null);
        }
    };

    const runBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        setBusyMode("DELETE");
        try {
            const ids = [...selectedIds];
            const results = await Promise.all(
                ids.map(async (campaignId) => {
                    const res = await fetch(apiPath(`/campaigns/${encodeURIComponent(campaignId)}`), { method: "DELETE" });
                    if (!res.ok) {
                        const json = await res.json().catch(() => ({}));
                        throw new Error(json?.error || "Failed to delete selected campaigns.");
                    }
                    return campaignId;
                })
            );
            setRecords((prev) => prev.filter((r) => !results.includes(r.id)));
            setSelectedIds([]);
            toast.success(`${results.length} campaign${results.length === 1 ? "" : "s"} deleted.`);
        } catch (error: any) {
            toast.error(error?.message || "Failed to delete selected campaigns.");
        } finally {
            setBusyId(null);
            setBusyMode(null);
        }
    };

    const rows = useMemo(() =>
        statusFilter === "ALL" ? records : records.filter((r) => r.dispatchStatus === statusFilter),
        [records, statusFilter]
    );

    useEffect(() => {
        const rowIds = new Set(rows.map((r) => r.id));
        setSelectedIds((prev) => prev.filter((id) => rowIds.has(id)));
    }, [rows]);

    const selectableRows = useMemo(
        () => rows.filter((r) => (r.dispatchStatus || "GENERATED") !== "PROCESSING"),
        [rows]
    );

    const allSelectableSelected = selectableRows.length > 0 && selectableRows.every((r) => selectedIds.includes(r.id));
    const someSelectableSelected = selectedIds.length > 0 && !allSelectableSelected;

    const toggleSelected = (campaignId: string) => {
        setSelectedIds((prev) =>
            prev.includes(campaignId) ? prev.filter((id) => id !== campaignId) : [...prev, campaignId]
        );
    };

    const toggleSelectAllVisible = () => {
        if (allSelectableSelected) {
            setSelectedIds([]);
            return;
        }
        setSelectedIds(selectableRows.map((r) => r.id));
    };

    // --- Per-row action logic ---
    const getActions = (r: CampaignRecord) => {
        const status = r.dispatchStatus || "GENERATED";
        const busy = busyId === r.id;
        const processing = status === "PROCESSING" || busy;

        const editBtn = (
            <button
                key="edit"
                onClick={() => router.push(appPath(`/campaigns/results?campaignId=${encodeURIComponent(r.id)}`))}
                title={status === "SENT" ? "View campaign" : "Edit campaign"}
                className="h-9 w-9 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 flex items-center justify-center transition-all"
            >
                {status === "SENT" ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
            </button>
        );

        const draftBtn = (
            <button
                key="draft"
                onClick={() => runDispatch(r.id, "DRAFT")}
                disabled={processing}
                title={status === "DRAFT_SAVED" ? "Update Gmail draft" : "Save as Gmail draft"}
                className="h-9 w-9 rounded-lg border border-slate-200 text-slate-500 hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50 flex items-center justify-center transition-all disabled:opacity-40"
            >
                {busy && busyMode === "DRAFT" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            </button>
        );

        const sendBtn = (label: string, icon = <Send className="w-3.5 h-3.5" />, style = "bg-blue-600 hover:bg-blue-700") => (
            <button
                key="send"
                onClick={() => setConfirm({ type: "send", record: r })}
                disabled={processing}
                className={`h-9 px-3 rounded-lg ${style} text-white text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40`}
            >
                {busy && busyMode === "SEND" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : icon}
                {label}
            </button>
        );

        const deleteBtn = (
            <button
                key="delete"
                onClick={() => setConfirm({ type: "delete", record: r })}
                disabled={processing}
                title="Delete campaign"
                className="h-9 w-9 rounded-lg border border-transparent text-slate-300 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 flex items-center justify-center transition-all disabled:opacity-40"
            >
                {busy && busyMode === "DELETE" ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
        );

        switch (status) {
            case "GENERATED":
                return [editBtn, draftBtn, sendBtn("Send"), deleteBtn];
            case "DRAFT_SAVED":
                return [editBtn, draftBtn, sendBtn("Send"), deleteBtn];
            case "SENT":
                // No "Save Draft" — already sent. Resend is subtle/secondary.
                return [
                    editBtn,
                    sendBtn("Resend", <RotateCcw className="w-3.5 h-3.5" />, "bg-slate-600 hover:bg-slate-700"),
                    deleteBtn,
                ];
            case "FAILED":
                return [editBtn, sendBtn("Retry", <RotateCcw className="w-3.5 h-3.5" />, "bg-orange-500 hover:bg-orange-600"), deleteBtn];
            case "PROCESSING":
                return [
                    <span key="processing" className="text-xs text-blue-500 flex items-center gap-1.5 font-medium">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Processing…
                    </span>
                ];
            default:
                return [editBtn, draftBtn, sendBtn("Send"), deleteBtn];
        }
    };

    return (
        <>
            <ConfirmModal
                dialog={confirm}
                onCancel={() => setConfirm(null)}
                onConfirm={() => {
                    if (!confirm) return;
                    if (confirm.type === "bulk-delete") {
                        setConfirm(null);
                        runBulkDelete();
                        return;
                    }
                    const r = confirm.record;
                    setConfirm(null);
                    if (confirm.type === "send") runDispatch(r.id, "SEND");
                    if (confirm.type === "delete") runDelete(r.id);
                }}
            />

            <div className="w-full px-3 sm:px-5 lg:px-8 py-5 sm:py-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Campaign List</h1>
                        <p className="text-sm text-slate-500 mt-1">Review, edit, draft, or send your generated campaigns.</p>
                    </div>
                    <button
                        onClick={() => router.push(appPath("/campaigns"))}
                        className="h-10 px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors w-full sm:w-auto"
                    >
                        + Create Campaign
                    </button>
                </div>

                {/* Search */}
                <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 flex items-center gap-2">
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by client, subject, or content…"
                        className="w-full text-sm outline-none"
                    />
                </div>

                {/* Status filter tabs */}
                <div className="flex flex-wrap gap-1.5">
                    {(["ALL", "GENERATED", "DRAFT_SAVED", "SENT", "FAILED", "PROCESSING"] as const).map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`h-8 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                                statusFilter === s
                                    ? "bg-slate-900 text-white border-slate-900"
                                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                            }`}
                        >
                            {s === "ALL" ? "All" : STATUS_META[s].label}
                        </button>
                    ))}
                </div>

                {selectedIds.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3 text-sm flex-wrap">
                            <span className="font-semibold text-slate-900">{selectedIds.length} selected</span>
                            <button
                                type="button"
                                onClick={toggleSelectAllVisible}
                                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                            >
                                {allSelectableSelected ? "Unselect all shown" : "Select all shown"}
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedIds([])}
                                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                            >
                                Clear
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() => setConfirm({ type: "bulk-delete", count: selectedIds.length })}
                            disabled={busyMode === "DELETE"}
                            className="h-10 px-4 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {busyMode === "DELETE" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            Delete Selected
                        </button>
                    </div>
                )}

                {/* Desktop table */}
                <div className="hidden lg:block bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-12 gap-3 px-5 py-3 text-xs font-medium text-slate-400 border-b border-slate-100 bg-slate-50">
                        <div className="col-span-1 flex items-center">
                            <input
                                type="checkbox"
                                checked={allSelectableSelected}
                                ref={(node) => {
                                    if (node) node.indeterminate = someSelectableSelected;
                                }}
                                onChange={toggleSelectAllVisible}
                                aria-label="Select all visible campaigns"
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                        </div>
                        <div className="col-span-3">Client / Subject</div>
                        <div className="col-span-2">Type</div>
                        <div className="col-span-2">Status</div>
                        <div className="col-span-2">Updated</div>
                        <div className="col-span-2 text-right">Actions</div>
                    </div>

                    {loading ? (
                        <div className="p-8 text-sm text-slate-500 flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin" /> Loading campaigns…
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="p-8 text-sm text-slate-500">No campaigns found.</div>
                    ) : rows.map((r) => (
                        <div key={r.id} className="grid grid-cols-12 gap-3 px-5 py-3.5 border-b border-slate-100 last:border-0 items-center hover:bg-slate-50/50 transition-colors">
                            <div className="col-span-1 flex items-center">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.includes(r.id)}
                                    onChange={() => toggleSelected(r.id)}
                                    disabled={(r.dispatchStatus || "GENERATED") === "PROCESSING"}
                                    aria-label={`Select campaign for ${r.client?.clientName || "Unknown Client"}`}
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                                />
                            </div>
                            <div className="col-span-3 min-w-0">
                                <div className="text-sm font-semibold text-slate-900 truncate">{r.client?.clientName || "Unknown Client"}</div>
                                <div className="text-xs text-slate-400 truncate mt-0.5">{r.campaignTopic || "Untitled"}</div>
                            </div>
                            <div className="col-span-2">
                                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                                    {r.campaignType}
                                </span>
                            </div>
                            <div className="col-span-2">
                                <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${STATUS_META[r.dispatchStatus || "GENERATED"].cls}`}>
                                    {STATUS_META[r.dispatchStatus || "GENERATED"].label}
                                </span>
                            </div>
                            <div className="col-span-2 text-xs text-slate-400 flex items-center gap-1">
                                <Clock3 className="w-3 h-3 shrink-0" />
                                {new Date((r.dispatchUpdatedAt || r.dateCreated) as string).toLocaleString()}
                            </div>
                            <div className="col-span-2 flex justify-end items-center gap-1.5">
                                {getActions(r)}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Mobile cards */}
                <div className="lg:hidden space-y-3">
                    {rows.length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3">
                            <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={allSelectableSelected}
                                    ref={(node) => {
                                        if (node) node.indeterminate = someSelectableSelected;
                                    }}
                                    onChange={toggleSelectAllVisible}
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                Select all shown
                            </label>
                            {selectedIds.length > 0 && (
                                <span className="text-xs font-semibold text-slate-500">{selectedIds.length} selected</span>
                            )}
                        </div>
                    )}
                    {loading ? (
                        <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-500 flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin" /> Loading…
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-500">No campaigns found.</div>
                    ) : rows.map((r) => (
                        <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                            <div className="flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.includes(r.id)}
                                    onChange={() => toggleSelected(r.id)}
                                    disabled={(r.dispatchStatus || "GENERATED") === "PROCESSING"}
                                    aria-label={`Select campaign for ${r.client?.clientName || "Unknown Client"}`}
                                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                                />
                                <div>
                                    <div className="text-sm font-semibold text-slate-900">{r.client?.clientName || "Unknown Client"}</div>
                                    <div className="text-xs text-slate-400 mt-0.5">{r.campaignTopic || "Untitled"}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">{r.campaignType}</span>
                                <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${STATUS_META[r.dispatchStatus || "GENERATED"].cls}`}>
                                    {STATUS_META[r.dispatchStatus || "GENERATED"].label}
                                </span>
                                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                    <Clock3 className="w-3 h-3" />
                                    {new Date((r.dispatchUpdatedAt || r.dateCreated) as string).toLocaleString()}
                                </span>
                            </div>
                            <div className="flex gap-2 flex-wrap">{getActions(r)}</div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
