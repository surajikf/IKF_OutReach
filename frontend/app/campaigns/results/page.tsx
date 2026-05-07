"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import {
    FileDown,
    Share2,
    Check,
    ChevronLeft,
    User,
    Mail as MailIcon,
    ChevronRight,
    Sparkles,
    Edit3,
    Bot,
    RefreshCw,
    Target,
    ShieldCheck,
    SendHorizontal,
    ArrowLeft,
    Send,
    Zap,
    Bold,
    Italic,
    List,
    Link,
    Type,
    Save,
    Clock,
    AlignLeft
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { toast } from "sonner";
import { RichTextEditor } from "@/frontend/components/RichTextEditor";
import { normalizeEmailBodyHtml } from "@/shared/lib/email-format";
import { sanitizeEmailHtml } from "@/shared/lib/email-sanitize";
import { apiPath, appPath } from "@/frontend/lib/app-path";
import { clearCampaignSession, readCampaignSession, writeCampaignSession } from "@/frontend/lib/campaign-session";

const MicroGauge = ({ value, label, icon: Icon, color = "blue" }: { value: number, label: string, icon: any, color?: "blue" | "red" | "emerald" | "slate" }) => {
    const radius = 18;
    const circumference = 2 * Math.PI * radius;
    const safeValue = isNaN(value) || value === undefined || value === null ? 0 : value;
    const offset = circumference - (safeValue / 100) * circumference;

    const colorMap = {
        blue: "text-blue-600",
        red: "text-red-500",
        emerald: "text-emerald-500",
        slate: "text-slate-900"
    };

    const bgMap = {
        blue: "bg-blue-50",
        red: "bg-red-50",
        emerald: "bg-emerald-50",
        slate: "bg-slate-50"
    };

    return (
        <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 group/gauge">
            <div className="relative w-16 h-16">
                <svg className="w-full h-full -rotate-90 drop-shadow-sm">
                    <circle
                        cx="32"
                        cy="32"
                        r={radius}
                        fill="transparent"
                        stroke="currentColor"
                        strokeWidth="4"
                        className="text-slate-50"
                    />
                    <circle
                        cx="32"
                        cy="32"
                        r={radius}
                        fill="transparent"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        className={cn("transition-all duration-[1500ms] ease-in-out", colorMap[color])}
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <Icon className={cn("w-5 h-5 opacity-20 group-hover/gauge:opacity-40 transition-opacity", colorMap[color])} />
                </div>
            </div>
            <div className="text-center space-y-0.5">
                <span className="block text-lg font-bold text-slate-900 leading-none">{safeValue}%</span>
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
            </div>
        </div>
    );
};

const StudioSkeleton = () => (
    <div className="space-y-12 animate-pulse">
        <div className="flex justify-between items-center px-2">
            <div className="space-y-3">
                <div className="h-8 w-64 bg-slate-200 rounded-lg" />
                <div className="h-4 w-48 bg-slate-100 rounded-md" />
            </div>
            <div className="h-10 w-32 bg-slate-100 rounded-xl" />
        </div>
        <div className="grid lg:grid-cols-12 gap-8">
            <div className="lg:col-span-3 space-y-4">
                <div className="h-4 w-32 bg-slate-100 rounded mb-6 mx-2" />
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-white border border-slate-100 rounded-xl" />
                ))}
            </div>
            <div className="lg:col-span-6">
                <div className="h-[600px] bg-white border border-slate-100 rounded-xl" />
            </div>
            <div className="lg:col-span-3 space-y-6">
                <div className="h-48 bg-white border border-slate-100 rounded-xl" />
                <div className="h-32 bg-slate-100 rounded-xl" />
            </div>
        </div>
    </div>
);

function CampaignResultsContent() {
    const router = useRouter();
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeIndex, setActiveIndex] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [editedBody, setEditedBody] = useState("");
    const [editedSubject, setEditedSubject] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isDispatching, setIsDispatching] = useState(false);
    const [dispatchProgress, setDispatchProgress] = useState(0);
    const [dispatchMode, setDispatchMode] = useState<"SEND" | "DRAFT">("SEND");
    const [draftRestored, setDraftRestored] = useState(false);
    const [pendingDraft, setPendingDraft] = useState<{ subject?: string; bodyHtml?: string; updatedAt?: string } | null>(null);
    const [hasEditedSinceLoad, setHasEditedSinceLoad] = useState(false);
    const [jobCreatedAt, setJobCreatedAt] = useState<string | null>(null);

    const searchParams = useSearchParams();
    const jobId = searchParams.get("jobId");
    const campaignId = searchParams.get("campaignId");

    useEffect(() => {
        if (jobId) {
            writeCampaignSession({ activeJobId: jobId });
            return;
        }
        if (campaignId) return;
        const saved = readCampaignSession();
        if (saved?.activeJobId) {
            router.replace(appPath(`/campaigns/results?jobId=${encodeURIComponent(saved.activeJobId)}`));
            return;
        }
        router.replace(appPath("/campaigns"));
    }, [jobId, campaignId, router]);

    const safeParseGeneratedOutput = (generatedOutput: string) => {
        try {
            const parsed = JSON.parse(generatedOutput);
            const subject = typeof parsed?.subject === "string" ? parsed.subject : "";
            const body = typeof parsed?.body === "string"
                ? sanitizeEmailHtml(normalizeEmailBodyHtml(parsed.body))
                : "";
            if (!subject.trim() || !body.trim()) return null;
            return {
                ...parsed,
                subject,
                body,
            };
        } catch {
            return null;
        }
    };

    useEffect(() => {
        let cancelled = false;

        const start = async () => {
            // Reset state when switching jobId so we don't show old campaigns.
            setCampaigns([]);
            setActiveIndex(0);
            setEditedBody("");
            setEditedSubject("");
            setSelectedIds(new Set());
            setJobCreatedAt(null);
            setDraftRestored(false);
            setPendingDraft(null);
            setHasEditedSinceLoad(false);

            if (!jobId) {
                fetchLatestResults(null);
                return;
            }

            // Wait for the queued batch generation job to complete,
            // so the results page shows fresh campaign payloads immediately.
            const poll = async () => {
                try {
            const res = await fetch(apiPath(`/jobs/${encodeURIComponent(jobId)}`));
                    const json = await res.json();
                    const job = json?.data?.job;

                    if (json?.success && job) {
                        if (!jobCreatedAt && job.createdAt) {
                            setJobCreatedAt(String(job.createdAt));
                        }

                        if (job.status === "SUCCEEDED") {
                            if (cancelled) return;
                            await fetchLatestResults(job.createdAt ? String(job.createdAt) : jobCreatedAt);
                            return;
                        }

                        if (job.status === "FAILED") {
                            if (cancelled) return;
                            toast.error(job.error || "Batch generation failed.");
                            setLoading(false);
                            return;
                        }
                    }
                } catch {
                    // Non-blocking; keep polling.
                }

                if (!cancelled) setTimeout(poll, 2000);
            };

            setLoading(true);
            poll();
        };

        start();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jobId, campaignId]);

    const activeDraftContext = campaigns[activeIndex]?.id ? `campaigns__results__${campaigns[activeIndex].id}` : null;

    // Restore draft when active campaign changes
    useEffect(() => {
        if (!activeDraftContext) return;
        let cancelled = false;
        setDraftRestored(false);
        setPendingDraft(null);
        setHasEditedSinceLoad(false);
        (async () => {
            try {
            const res = await fetch(apiPath(`/drafts/${encodeURIComponent(activeDraftContext)}`));
                const json = await res.json();
                const draft = json?.data?.draft;
                if (!cancelled && draft) {
                    // Never auto-restore; ask user explicitly.
                    setPendingDraft({
                        subject: draft.subject || "",
                        bodyHtml: draft.bodyHtml || "",
                        updatedAt: draft.updatedAt,
                    });
                }
            } catch {
                // non-blocking
            }
        })();
        return () => {
            cancelled = true;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeDraftContext]);

    // Debounced autosave
    useEffect(() => {
        if (!activeDraftContext) return;
        if (pendingDraft && !hasEditedSinceLoad) return;
        const t = setTimeout(() => {
            fetch(apiPath(`/drafts/${encodeURIComponent(activeDraftContext)}`), {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    subject: editedSubject || "",
                    bodyHtml: normalizeEmailBodyHtml(editedBody || ""),
                    metadata: {
                        campaignId: campaigns[activeIndex]?.id,
                        clientId: campaigns[activeIndex]?.clientId,
                    },
                }),
            }).catch(() => {});
        }, 700);
        return () => clearTimeout(t);
    }, [activeDraftContext, editedSubject, editedBody, campaigns, activeIndex, pendingDraft, hasEditedSinceLoad]);

    const fetchLatestResults = async (sinceOverride?: string | null) => {
        try {
            const res = await fetch(apiPath("/campaigns/history?limit=20"));
            const result = await res.json();
            if (result.success) {
                const since = sinceOverride !== undefined ? sinceOverride : jobCreatedAt;
                const sinceTs = since ? new Date(since).getTime() : null;
                const processed = result.data
                    .map((c: any) => {
                        const content = safeParseGeneratedOutput(c.generatedOutput);
                        if (!content) return null;
                        const dateTs = c?.dateCreated ? new Date(c.dateCreated).getTime() : null;
                        if (sinceTs !== null && dateTs !== null && dateTs < sinceTs) return null;
                        return { ...c, content };
                    })
                    .filter(Boolean);
                setCampaigns(processed);
                if (processed.length > 0) {
                    const focusIndex = campaignId ? processed.findIndex((c: any) => c.id === campaignId) : -1;
                    const startIndex = focusIndex >= 0 ? focusIndex : 0;
                    setActiveIndex(startIndex);
                    setEditedBody(processed[startIndex].content.body);
                    setEditedSubject(processed[startIndex].content.subject);
                } else {
                    toast.error("Campaign payloads are invalid. Please regenerate campaigns.");
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setTimeout(() => setLoading(false), 800);
        }
    };

    const toggleSelect = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === campaigns.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(campaigns.map(c => c.id)));
        }
    };

    const handleBatchDispatch = async (mode: "SEND" | "DRAFT" = "SEND") => {
        const selectedCampaigns = selectedIds.size > 0
            ? campaigns.filter(c => selectedIds.has(c.id))
            : [campaigns[activeIndex]];

        const dispatchable = selectedCampaigns.filter((c: any) => {
            if (!c?.id || !c?.content?.subject || !c?.content?.body) return false;
            return true;
        });

        if (dispatchable.length === 0) {
            toast.error("No valid campaigns selected for dispatch.");
            return;
        }

        if (dispatchable.length < selectedCampaigns.length) {
            toast.warning("Some selected campaigns were skipped due to invalid payload.");
        }

        const idsToDispatch = dispatchable.map((c: any) => c.id);

        try {
            setIsDispatching(true);
            setDispatchMode(mode);
            setDispatchProgress(0);

            const res = await fetch(apiPath("/campaigns/dispatch/batch"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ campaignIds: idsToDispatch, dispatchMode: mode })
            });

            const data = await res.json().catch(() => null);
            const jobId = data?.data?.jobId as string | undefined;

            if (!res.ok || !data?.success || !jobId) {
                toast.error(data?.error?.message || "Failed to enqueue dispatch.");
                setIsDispatching(false);
                setDispatchProgress(0);
                return;
            }

            const poll = async () => {
                try {
                const jr = await fetch(apiPath(`/jobs/${encodeURIComponent(jobId)}`));
                    const jdata = await jr.json();
                    const job = jdata?.data?.job;

                    if (!jdata?.success || !job) {
                        setTimeout(poll, 2000);
                        return;
                    }

                    if (job.status === "RUNNING" || job.status === "QUEUED") {
                        setDispatchProgress(Math.max(0, Math.min(100, job.progress || 0)));
                        setTimeout(poll, 2000);
                        return;
                    }

                    if (job.status === "FAILED") {
                        toast.error(job.error || "Dispatch batch failed.");
                        setIsDispatching(false);
                        setDispatchProgress(0);
                        return;
                    }

                    if (job.status === "SUCCEEDED") {
                        const r = job.result || {};
                        const total = r.total ?? idsToDispatch.length;
                        const successCount = r.successCount ?? r.successes ?? 0;
                        const actionWord = mode === "DRAFT" ? "drafts created" : "emails sent";
                        if (successCount === total) {
                            toast.success(`${total} ${actionWord}.`);
                        } else {
                            toast.warning(`${successCount}/${total} ${actionWord}. Please check errors.`);
                        }

                        setIsDispatching(false);
                        setDispatchProgress(100);
                        setSelectedIds(new Set());
                        // Refresh history after dispatch completes (keep newly-generated filter if present)
                        await fetchLatestResults(jobCreatedAt);
                        return;
                    }
                } catch {
                    setTimeout(poll, 2000);
                }
            };

            poll();
        } catch (err) {
            console.error(err);
            setIsDispatching(false);
            setDispatchProgress(0);
            toast.error("Failed to dispatch batch.");
        }
    };

    const handleSelectCampaign = (index: number) => {
        setActiveIndex(index);
        setEditedBody(campaigns[index].content.body);
        setEditedSubject(campaigns[index].content.subject);
    };

    const handleSaveEvolution = async () => {
        if (!campaigns[activeIndex]) return;
        setIsSaving(true);
        try {
            const res = await fetch(apiPath(`/campaigns/${campaigns[activeIndex].id}`), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ subject: editedSubject, body: editedBody })
            });
            if (res.ok) {
                const updated = await res.json();
                const newCampaigns = [...campaigns];
                newCampaigns[activeIndex] = {
                    ...updated,
                    content: safeParseGeneratedOutput(updated.generatedOutput) || newCampaigns[activeIndex].content
                };
                setCampaigns(newCampaigns);
                toast.success("Timeline evolved: Matrix resonance updated.");
                return true;
            }
        } catch (err) {
            console.error(err);
            toast.error("Could not save changes. Please try again.");
        } finally {
            setIsSaving(false);
        }
        return false;
    };

    const readingTime = Math.ceil(editedBody.split(/\s+/).length / 200);
    const charCount = editedBody.length;

    if (loading) return (
        <div className="w-full py-8 px-3 sm:px-4 lg:px-6">
            <StudioSkeleton />
        </div>
    );

    if (campaigns.length === 0) return (
        <div className="w-full min-h-[60vh] flex flex-col items-center justify-center space-y-6 animate-in fade-in duration-500 px-3 sm:px-4 lg:px-6">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center shadow-sm">
                <Zap className="w-6 h-6 text-slate-400" />
            </div>
            <div className="text-center space-y-1.5">
                <h3 className="text-xl font-semibold text-slate-900 tracking-tight">No Campaigns Yet</h3>
                <p className="text-sm font-medium text-slate-500">No campaigns found right now.</p>
            </div>
                <button
                    onClick={() => {
                        clearCampaignSession();
                        router.push(appPath("/campaigns"));
                    }}
                    className="bg-blue-600 text-white px-6 py-2.5 rounded-md text-sm font-semibold shadow-sm hover:bg-blue-700 active:scale-[0.98] transition-all"
                >
                    Generate First Campaign
            </button>
        </div>
    );

    const activeCampaign = campaigns[activeIndex];

    return (
        <div className="w-full space-y-8 pb-20 px-3 sm:px-4 lg:px-6">
            <header className="flex items-center justify-between px-2">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-3">
                        Campaign Editor
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-600 uppercase tracking-widest animate-pulse">Sync Active</span>
                    </h2>
                    <p className="text-sm font-medium text-slate-500 mt-1">Review and edit your generated emails before sending.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => router.push(appPath("/campaigns"))}
                        className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-4 py-2 rounded-md hover:bg-slate-100 border border-transparent hover:border-slate-200"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Config
                    </button>
                    <button
                        onClick={() => {
                            clearCampaignSession();
                            router.push(appPath("/campaigns"));
                        }}
                        className="text-sm font-medium text-rose-600 hover:text-rose-700 transition-colors px-4 py-2 rounded-md hover:bg-rose-50 border border-rose-200"
                    >
                        New Campaign
                    </button>
                </div>
            </header>

            <div className="grid lg:grid-cols-12 gap-6 items-start">
                {/* Left: Campaign List */}
                <div className="lg:col-span-3 space-y-3">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-xs font-semibold text-slate-500 tracking-wide">Company Queue</h3>
                        {campaigns.length > 1 && (
                            <button
                                onClick={toggleSelectAll}
                                className="text-xs font-semibold text-slate-400 hover:text-slate-900 transition-colors flex items-center gap-1.5"
                            >
                                <div className={cn(
                                    "w-3.5 h-3.5 rounded border transition-all flex items-center justify-center",
                                    selectedIds.size === campaigns.length && campaigns.length > 0
                                        ? "bg-blue-600 border-blue-700 text-white"
                                        : "bg-white border-slate-300"
                                )}>
                                    {selectedIds.size === campaigns.length && campaigns.length > 0 && <Check className="w-2.5 h-2.5" />}
                                </div>
                                {selectedIds.size === campaigns.length && campaigns.length > 0 ? "DESELECT" : "SELECT ALL"}
                            </button>
                        )}
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto custom-scrollbar divide-y divide-slate-100 max-h-[700px]">
                        {campaigns.map((c, i) => (
                            <div
                                key={c.id}
                                onClick={() => handleSelectCampaign(i)}
                                className={cn(
                                    "p-4 cursor-pointer transition-all duration-200 relative group flex items-start gap-3",
                                    activeIndex === i ? "bg-slate-50" : "bg-white hover:bg-slate-50/50",
                                    selectedIds.has(c.id) && "ring-1 ring-inset ring-blue-500/20 bg-blue-50/30"
                                )}
                            >
                                <div
                                    onClick={(e) => toggleSelect(c.id, e)}
                                    className={cn(
                                        "mt-0.5 w-4 h-4 rounded border transition-all flex items-center justify-center shrink-0",
                                        selectedIds.has(c.id)
                                            ? "bg-blue-600 border-blue-700 text-white"
                                            : "bg-white border-slate-300 opacity-0 group-hover:opacity-100"
                                    )}
                                >
                                    {selectedIds.has(c.id) && <Check className="w-3 h-3" />}
                                </div>
                                <div className="flex flex-col gap-2 flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className={cn("w-1.5 h-1.5 rounded-full", activeIndex === i ? "bg-blue-600" : "bg-slate-300")} />
                                            <h4 className={cn("text-xs font-semibold uppercase tracking-wide truncate transition-colors", activeIndex === i ? "text-slate-900" : "text-slate-500 group-hover:text-slate-700")}>
                                                {c.client?.clientName}
                                            </h4>
                                        </div>
                                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-widest shrink-0">
                                            {c.campaignType}
                                        </span>
                                    </div>
                                    <p className={cn(
                                        "text-[10px] font-medium leading-relaxed line-clamp-1 transition-colors pl-3.5",
                                        activeIndex === i ? "text-slate-600" : "text-slate-400"
                                    )}>
                                        {c.content?.subject}
                                    </p>
                                    <div className="pl-3.5">
                                        <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-500">
                                            Standard
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Center: Editor */}
                <div className="lg:col-span-6 space-y-6">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col h-[720px] transition-all">
                        <div className="p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar bg-white">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 group">
                                    <div className="w-1 h-4 bg-blue-600 rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity" />
                                    <label className="text-xs font-semibold text-slate-500 tracking-wide">Subject</label>
                                </div>
                                <input
                                    type="text"
                                    value={editedSubject}
                                    onChange={(e) => { setEditedSubject(e.target.value); setHasEditedSinceLoad(true); }}
                                    className="w-full bg-transparent border-none text-[2rem] font-bold text-slate-900 outline-none placeholder:text-slate-300 focus:ring-0 leading-tight p-0"
                                    placeholder="Write your subject line..."
                                />
                            </div>

                            <div className="w-full h-px bg-slate-100" />

                            <div className="space-y-4">
                                <div className="flex items-center gap-2 group">
                                    <div className="w-1 h-4 bg-blue-600 rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity" />
                                    <label className="text-xs font-semibold text-slate-500 tracking-wide">Message</label>
                                </div>
                                {pendingDraft && (
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs font-medium text-amber-900 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                                        <span>Saved draft found. Restore your last edits?</span>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditedSubject(pendingDraft.subject || "");
                                                    setEditedBody(pendingDraft.bodyHtml || "");
                                                    setDraftRestored(true);
                                                    setPendingDraft(null);
                                                    toast.info("Draft restored.");
                                                }}
                                                    className="px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
                                            >
                                                Restore
                                            </button>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    try {
                await fetch(apiPath(`/drafts/${encodeURIComponent(activeDraftContext!)}`), { method: "DELETE" });
                                                    } catch {}
                                                    setPendingDraft(null);
                                                    toast.info("Draft discarded.");
                                                }}
                                                    className="px-3 py-1.5 rounded-md bg-white border border-amber-300 text-amber-900 text-xs font-semibold hover:bg-amber-100 transition-colors"
                                            >
                                                Discard
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {draftRestored && !pendingDraft && (
                                    <div className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">
                                        Draft restored. Auto-save is on.
                                    </div>
                                )}
                                <RichTextEditor
                                    content={editedBody}
                                    onChange={(v) => { setEditedBody(v); setHasEditedSinceLoad(true); }}
                                    placeholder="Refine the narrative..."
                                    sampleData={activeCampaign?.client}
                                />
                            </div>
                        </div>

                        {/* Footer HUD */}
                        <div className="px-8 py-4 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                    <AlignLeft className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-xs font-semibold text-slate-500">
                                        {editedBody.replace(/<[^>]*>/g, '').length} Chars
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-xs font-semibold text-slate-500">{readingTime}m read</span>
                                </div>
                            </div>
                            <button
                                onClick={handleSaveEvolution}
                                disabled={isSaving}
                                className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-blue-600 transition-all px-3 py-1.5 rounded-full hover:bg-blue-50 border border-transparent hover:border-blue-100 disabled:opacity-50"
                            >
                                {isSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                {isSaving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right: Controls & Metrics */}
                <div className="lg:col-span-3 space-y-6 lg:sticky lg:top-8">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-8">
                        <div className="space-y-6">
                            <h3 className="text-xs font-semibold text-slate-500 tracking-wide text-center">Email Quality</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="relative group/tooltip flex justify-center cursor-help">
                                    <MicroGauge
                                        value={activeCampaign?.content?.leadStrength || 0}
                                        label="Strength"
                                        icon={Target}
                                        color="blue"
                                    />
                                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover/tooltip:opacity-100 transition-all duration-300 translate-y-2 group-hover/tooltip:translate-y-0 bg-slate-900 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap z-50 shadow-xl pointer-events-none">
                                        Estimated impact
                                    </div>
                                </div>
                                <div className="relative group/tooltip flex justify-center cursor-help">
                                    <MicroGauge
                                        value={activeCampaign?.content?.spamRisk || 0}
                                        label="Risk"
                                        icon={ShieldCheck}
                                        color="red"
                                    />
                                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover/tooltip:opacity-100 transition-all duration-300 translate-y-2 group-hover/tooltip:translate-y-0 bg-slate-900 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap z-50 shadow-xl pointer-events-none">
                                        Deliverability Risk
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {isDispatching && (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-4 duration-500">
                                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                        <span>{dispatchMode === "DRAFT" ? "Draft progress" : "Sending progress"}</span>
                                        <span>{dispatchProgress}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-600 transition-all duration-300"
                                            style={{ width: `${dispatchProgress}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="p-1.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                                <button
                                    onClick={() => handleBatchDispatch("DRAFT")}
                                    disabled={isDispatching || (selectedIds.size === 0 && !campaigns[activeIndex])}
                                    className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isDispatching && dispatchMode === "DRAFT" ? (
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <FileDown className="w-3.5 h-3.5" />
                                    )}
                                    {isDispatching && dispatchMode === "DRAFT"
                                        ? "Creating Drafts..."
                                        : selectedIds.size > 1
                                            ? `Save ${selectedIds.size} Drafts`
                                            : "Save Draft"}
                                </button>
                                <button
                                    onClick={() => handleBatchDispatch("SEND")}
                                    disabled={isDispatching || (selectedIds.size === 0 && !campaigns[activeIndex])}
                                    className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-blue-600 border border-blue-700 text-white text-sm font-semibold shadow-[0_4px_12px_rgba(37,99,235,0.15)] hover:bg-blue-700 active:scale-[0.98] transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isDispatching ? (
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Send className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                    )}
                                    {isDispatching && dispatchMode === "SEND"
                                        ? "Sending..."
                                        : selectedIds.size > 1
                                            ? `Send ${selectedIds.size} Emails`
                                            : "Send Email"}
                                </button>
                            </div>
                        </div>

                        <div className="bg-slate-900 p-6 rounded-2xl space-y-4 shadow-xl relative group overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl -mr-12 -mt-12" />
                            <div className="flex items-center gap-2 relative z-10">
                                <Sparkles className="w-4 h-4 text-emerald-400" />
                                <h4 className="text-white font-semibold text-xs tracking-wide">Quick Tip</h4>
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed font-medium relative z-10">
                                This message fits the {activeCampaign?.campaignType} goal. Keep one clear value point and one clear next step.
                            </p>
                            <div className="pt-2 flex items-center gap-2 relative z-10">
                                <div className="flex -space-x-2">
                                    <div className="w-5 h-5 rounded-full bg-slate-800 border-2 border-slate-900" />
                                    <div className="w-5 h-5 rounded-full bg-slate-700 border-2 border-slate-900" />
                                </div>
                                <span className="text-[10px] font-semibold text-slate-500">Confidence: High</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function CampaignResults() {
    return (
        <Suspense fallback={<div className="w-full py-8 px-3 sm:px-4 lg:px-6"><StudioSkeleton /></div>}>
            <CampaignResultsContent />
        </Suspense>
    );
}
