"use client";
/** Refreshed imports to resolve Search icon registration issue **/
import { useState, useEffect, Suspense, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
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
    Edit3,
    Bot,
    RefreshCw,
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
    AlignLeft,
    Search,
    X,
    Eye,
    EyeOff,
    MoreVertical,
    AlertTriangle,
    ChevronDown,
    Calendar
} from "lucide-react";
import { cn } from "@/lib/shared/utils";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { normalizeEmailBodyHtml } from "@/lib/shared/email-format";
import { sanitizeEmailHtml } from "@/lib/shared/email-sanitize";
import { apiPath, appPath } from "@/lib/app-path";
import { clearCampaignSession, readCampaignSession, writeCampaignSession } from "@/lib/campaign-session";

const isTerminalJobStatus = (status?: string) => status === "SUCCEEDED" || status === "FAILED";


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
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const jobId = searchParams.get("jobId");
    const campaignId = searchParams.get("campaignId");
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
    const [sendMode, setSendMode] = useState<"now" | "schedule">("now");
    const [scheduledAt, setScheduledAt] = useState("");
    const [batchSize, setBatchSize] = useState(50);
    const [batchDelayMinutes, setBatchDelayMinutes] = useState(5);
    const [showBatchSettings, setShowBatchSettings] = useState(false);
    const [sendPopoverOpen, setSendPopoverOpen] = useState(false);
    const [draftRestored, setDraftRestored] = useState(false);
    const [pendingDraft, setPendingDraft] = useState<{ subject?: string; bodyHtml?: string; updatedAt?: string } | null>(null);
    const [hasEditedSinceLoad, setHasEditedSinceLoad] = useState(false);
    const [jobCreatedAt, setJobCreatedAt] = useState<string | null>(null);
    const [jobTopic, setJobTopic] = useState<string | null>(null);
  const [jobType, setJobType] = useState<string | null>(null);
  const [jobGeneratedIds, setJobGeneratedIds] = useState<string[]>([]);
  useEffect(() => {
    if (!jobId) {
      setJobGeneratedIds([]);
      return;
    }

    let cancelled = false;

    const syncGeneratedIds = async () => {
      try {
        const res = await fetch(apiPath(`/jobs/${jobId}`), { cache: "no-store" });
        if (!res.ok) return;

        const json = await res.json();
        const ids = Array.isArray(json?.data?.job?.result?.generatedCampaignIds)
          ? json.data.job.result.generatedCampaignIds.map((id: unknown) => String(id))
          : [];

        if (!cancelled) {
          setJobGeneratedIds(ids);
        }
      } catch {
        // Ignore transient polling errors here; the main job poll already handles UX feedback.
      }
    };

    void syncGeneratedIds();
    const interval = window.setInterval(syncGeneratedIds, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [jobId]);
    const [jobStatusText, setJobStatusText] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState("");
    const [isMobileQueueOpen, setIsMobileQueueOpen] = useState(false);
    const [generationProgress, setGenerationProgress] = useState(0);
    const loadingWarningShownRef = useRef(false);

    // Global UI Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsMobileQueueOpen(false);
                if (selectedIds.size > 0) setSelectedIds(new Set());
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedIds.size]);

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
            loadingWarningShownRef.current = false;

            if (!jobId) {
                fetchLatestResults(null);
                return;
            }

            // Wait for the queued batch generation job to complete,
            // so the results page shows fresh campaign payloads immediately.
            const startedAt = Date.now();
            const maxWaitMs = 180000; // hard stop
            let attempts = 0;
            const poll = async () => {
                attempts += 1;
                try {
                    const res = await fetch(apiPath(`/jobs/${encodeURIComponent(jobId)}`));
                    const contentType = res.headers.get("content-type") || "";
                    if (!contentType.includes("application/json")) {
                        if (cancelled) return;
                        setLoading(false);
                        toast.error("Session expired or invalid response. Please open campaign list and continue.");
                        return;
                    }
                    const json = await res.json();
                    const job = json?.data?.job;

                    if (json?.success && job) {
                        if (job.status) setJobStatusText(String(job.status));
                        if (!jobCreatedAt && job.createdAt) {
                            setJobCreatedAt(String(job.createdAt));
                        }
                        if (!jobTopic && job.payload?.topic) {
                            setJobTopic(String(job.payload.topic));
                        }
                        if (!jobType && job.payload?.type) {
                            setJobType(String(job.payload.type));
                        }
                        
                        // Update generation progress
                        if (job.status === "RUNNING") {
                            setGenerationProgress(job.progress || 0);
                        }

                        if (job.status === "SUCCEEDED") {
                            if (cancelled) return;
                            await fetchLatestResults(
                                job.createdAt ? String(job.createdAt) : jobCreatedAt,
                                { silentEmpty: false, preserveEditor: true },
                                job.payload?.topic,
                                job.payload?.type
                            );
                            setLoading(false);
                            return;
                        }

                        if (job.status === "FAILED") {
                            if (cancelled) return;
                            toast.error(job.error || "Batch generation failed.");
                            setLoading(false);
                            return;
                        }

                        if (job.status === "RUNNING" || job.status === "QUEUED") {
                            if (cancelled) return;
                            const count = await fetchLatestResults(
                                job.createdAt ? String(job.createdAt) : jobCreatedAt,
                                { silentEmpty: true, preserveEditor: true },
                                job.payload?.topic,
                                job.payload?.type
                            );
                            if (count > 0 || attempts >= 5) {
                                setLoading(false);
                            } else if (attempts >= 30 && !loadingWarningShownRef.current) {
                                loadingWarningShownRef.current = true;
                                toast.info("Generation is in progress. Emails will appear as they are ready.");
                            }
                        }

                        if (!isTerminalJobStatus(job.status) && Date.now() - startedAt > maxWaitMs) {
                            if (cancelled) return;
                            setLoading(false);
                            toast.warning("Generation is taking longer than expected. You can reopen from Campaign List.");
                            return;
                        }
                    } else if (Date.now() - startedAt > maxWaitMs) {
                        if (cancelled) return;
                        setLoading(false);
                        toast.warning("Could not confirm job status. Please open Campaign List and continue.");
                        return;
                    }
                } catch {
                    if (Date.now() - startedAt > maxWaitMs) {
                        if (cancelled) return;
                        setLoading(false);
                        toast.error("Network issue while loading generated campaigns.");
                        return;
                    }
                }

                if (!cancelled) setTimeout(poll, 1000); // 1s polling for real-time feel
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

  const fetchLatestResults = async (
    sinceOverride?: string | null,
    opts?: { silentEmpty?: boolean; preserveEditor?: boolean },
    topicOverride?: string | null,
    typeOverride?: string | null,
    idsOverride?: string[] | null
  ) => {
    try {
      const topic = topicOverride !== undefined ? topicOverride : jobTopic;
      const type = typeOverride !== undefined ? typeOverride : jobType;
      const exactIds = idsOverride !== undefined ? idsOverride : jobGeneratedIds;
      const normalizedIds = Array.isArray(exactIds)
        ? exactIds.map((id) => String(id)).filter(Boolean)
        : [];

      let query = normalizedIds.length > 0
        ? `?ids=${encodeURIComponent(normalizedIds.join(","))}`
        : "?limit=200";
      if (normalizedIds.length === 0) {
        if (topic) query += `&search=${encodeURIComponent(topic)}`;
        if (type && type !== "All") query += `&type=${encodeURIComponent(type)}`;
      }
            
            const res = await fetch(apiPath(`/campaigns/history${query}`));
            const contentType = res.headers.get("content-type") || "";
            if (!contentType.includes("application/json")) {
                throw new Error("Invalid session response");
            }
            const result = await res.json();
            if (result.success) {
                const since = sinceOverride !== undefined ? sinceOverride : jobCreatedAt;
                const sinceTs = since ? new Date(since).getTime() : null;
                const processed = result.data
                    .map((c: any) => {
                        // Strict filter: Topic must match exactly (trimmed/case-insensitive) if provided
          if (normalizedIds.length === 0 && topic && c.campaignTopic?.trim().toLowerCase() !== topic.trim().toLowerCase()) return null;
                        if (type && type !== "All" && c.campaignType?.trim().toLowerCase() !== type.trim().toLowerCase()) return null;
                        
                        const content = safeParseGeneratedOutput(c.generatedOutput);
                        if (!content) return null;
                        const dateTs = c?.dateCreated ? new Date(c.dateCreated).getTime() : null;
                        // DB clocks are synchronized, but we add a 2s buffer for safety
                        if (sinceTs !== null && dateTs !== null && dateTs < (sinceTs - 2000)) return null;
                        return { ...c, content };
                    })
                    .filter(Boolean);
                const currentActiveId = campaigns[activeIndex]?.id as string | undefined;
      if (processed.length > 0 || !opts?.silentEmpty) {
        setCampaigns(processed);
      }
                if (processed.length > 0) {
                    const focusIndex = campaignId ? processed.findIndex((c: any) => c.id === campaignId) : -1;
                    const keepIndex = currentActiveId ? processed.findIndex((c: any) => c.id === currentActiveId) : -1;
                    const startIndex = focusIndex >= 0 ? focusIndex : keepIndex >= 0 ? keepIndex : 0;
                    
                    // Only update activeIndex if it actually changed to avoid UI jitter
                    if (startIndex !== activeIndex) {
                        setActiveIndex(startIndex);
                    }
                    if (!opts?.preserveEditor || !hasEditedSinceLoad) {
                        setEditedBody(processed[startIndex].content.body);
                        setEditedSubject(processed[startIndex].content.subject);
                    }
                    setLoading(false);
                } else if (!opts?.silentEmpty) {
                    toast.error("Campaign payloads are invalid. Please regenerate campaigns.");
                }
                return processed.length;
            }
        } catch (err) {
            console.error(err);
            toast.error("Could not load generated campaigns. Please try again from Campaign List.");
        } finally {
            if (!opts?.silentEmpty) {
                setTimeout(() => setLoading(false), 800);
            }
        }
        return 0;
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
        // Auto-save active campaign if it's part of the dispatch and has unsaved changes
        if (hasEditedSinceLoad && (selectedIds.size === 0 || selectedIds.has(campaigns[activeIndex]?.id))) {
            console.log("[DEBUG] Unsaved changes detected. Auto-saving before dispatch...");
            const saved = await handleSaveEvolution();
            if (!saved) {
                toast.error("Failed to save changes. Dispatch cancelled.");
                return;
            }
        }

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

            // id is now always set by the session callback (token.sub ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ session.user.id)
            const currentUserId = (session?.user as any)?.id || (session?.user as any)?.sub || null;

            const res = await fetch(apiPath("/campaigns/dispatch/batch"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    campaignIds: idsToDispatch,
                    dispatchMode: mode,
                    userId: currentUserId,
                    batchSize,
                    batchDelayMinutes,
                    scheduledAt: sendMode === "schedule" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
                })
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

    const filteredCampaigns = campaigns.filter(c => 
        c.client?.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.content?.subject?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isJobActive = jobId && !isTerminalJobStatus(jobStatusText);

    // Full-screen waiting state: job is active but no campaigns loaded yet
    if (campaigns.length === 0 && isJobActive) return (
        <div className="w-full min-h-[70vh] flex flex-col items-center justify-center gap-6 px-4 animate-in fade-in duration-500">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
            <div className="text-center space-y-1.5 max-w-sm">
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">Generating Your Campaigns</h3>
                <p className="text-sm text-slate-500">
                    {generationProgress > 0
                        ? `AI is personalizing emails - ${generationProgress}% done. First drafts appear as they're ready.`
                        : "AI is scanning your contacts and crafting personalized emails. This takes 30-60 seconds."}
                </p>
            </div>
            <div className="w-full max-w-xs space-y-2">
                <div className="flex justify-between text-[11px] font-semibold text-slate-400">
                    <span>Progress</span>
                    <span>{generationProgress}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-700 ease-out"
                        style={{ width: generationProgress > 0 ? `${generationProgress}%` : "8%" }}
                    />
                </div>
            </div>
            <p className="text-[11px] text-slate-400">You can stay on this page - drafts will appear automatically.</p>
        </div>
    );

    // If we are strictly loading the initial session/job data and have NO jobId or campaigns yet, show skeleton
    if (loading && campaigns.length === 0 && !jobId) return (
        <div className="w-full py-8 px-3 sm:px-4 lg:px-6">
            <div className="mb-4 text-sm text-slate-500 font-medium flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                {jobStatusText ? `Preparing... (${jobStatusText})` : "Preparing..."}
            </div>
            <StudioSkeleton />
        </div>
    );

    // If we have no campaigns AND no active job AND finished loading, show empty state
    if (!loading && campaigns.length === 0 && !isJobActive) {
        return (
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
    }
    const activeCampaign = campaigns[activeIndex];

    return (
        <div className="w-full space-y-5 pb-16 px-3 sm:px-4 lg:px-6 max-w-[1500px] mx-auto">
            <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-2 py-4">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setIsMobileQueueOpen(true)}
                        className="md:hidden p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                        aria-label="Open Company Queue"
                    >
                        <List className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-base font-semibold tracking-tight text-slate-900 flex items-center gap-2.5">
                            Campaign Editor
                            {isJobActive ? (
                                <span className="flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                                    <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                    Generating {generationProgress}%
                                </span>
                            ) : (
                                <span className="hidden xs:inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">Live</span>
                            )}
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {isJobActive ? "Drafts are being prepared in real-time" : "Refine and dispatch your outreach campaign"}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                        onClick={() => router.push(appPath("/campaigns"))}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all px-4 py-2 rounded-lg hover:bg-slate-100 border border-slate-200"
                        aria-label="Back to Configuration"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span className="hidden xs:inline">Back to Config</span>
                    </button>
                    <button
                        onClick={() => {
                            clearCampaignSession();
                            router.push(appPath("/campaigns"));
                        }}
                        className="flex-1 sm:flex-none text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all px-4 py-2 rounded-lg hover:bg-slate-100 border border-slate-200"
                    >
                        New Campaign
                    </button>

                    {/* Send popover trigger */}
                    <div className="relative">
                        <button
                            onClick={() => setSendPopoverOpen(v => !v)}
                            disabled={isDispatching || (selectedIds.size === 0 && !campaigns[activeIndex])}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-all shadow-sm disabled:opacity-50 active:scale-[0.98]"
                        >
                            {isDispatching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            {isDispatching ? (dispatchMode === "DRAFT" ? "Drafting..." : `Sending... ${dispatchProgress}%`) : "Send"}
                            {!isDispatching && <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", sendPopoverOpen && "rotate-180")} />}
                        </button>

                        <AnimatePresence>
                            {sendPopoverOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute right-0 top-full mt-2 w-[min(92vw,34rem)] sm:w-[30rem] md:w-[32rem] lg:w-[34rem] max-h-[min(82vh,44rem)] bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-y-auto overscroll-contain"
                                >
                                    {/* Header + quality summary */}
                                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-semibold text-slate-900">Review & Send</p>
                                                <p className="text-[11px] text-slate-500">Set timing, then send.</p>
                                            </div>
                                            <button onClick={() => setSendPopoverOpen(false)} aria-label="Close send panel" className="text-slate-400 hover:text-slate-600">
                                                <X className="w-4 h-4" aria-hidden="true" />
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700">
                                                {selectedIds.size || 1} emails
                                            </span>
                                            <span className="inline-flex items-center rounded-md border border-blue-100 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700">
                                                Strength {activeCampaign?.content?.leadStrength || 0}%
                                            </span>
                                            <span className="inline-flex items-center rounded-md border border-rose-100 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-600">
                                                Spam {activeCampaign?.content?.spamRisk || 0}%
                                            </span>
                                        </div>
                                    </div>

                                    <div className="p-4 space-y-3.5">
                                        <div className="space-y-2">
                                            <p className="text-[11px] font-semibold text-slate-500">Send Time</p>
                                            <div className="flex rounded-lg overflow-hidden border border-slate-200 bg-slate-50 p-1 gap-1">
                                                <button type="button" onClick={() => setSendMode("now")}
                                                    className={cn("flex-1 py-1.5 text-xs font-semibold rounded-md transition-all", sendMode === "now" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
                                                    Send Now
                                                </button>
                                                <button type="button" onClick={() => setSendMode("schedule")}
                                                    className={cn("flex-1 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1", sendMode === "schedule" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
                                                    <Calendar className="w-3 h-3" /> Schedule
                                                </button>
                                            </div>
                                            {sendMode === "schedule" && (
                                                <div className="space-y-1">
                                                    <label htmlFor="schedule-at" className="text-[11px] font-medium text-slate-500">Schedule Date & Time</label>
                                                    <input id="schedule-at" type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                                                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 bg-white" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-3">
                                            <p className="text-[11px] font-semibold text-slate-500">Sending Pace</p>
                                            <button type="button" onClick={() => setShowBatchSettings(v => !v)}
                                                className="flex items-center justify-between w-full text-xs font-medium text-slate-500 hover:text-slate-700">
                                                <span>Batch settings</span>
                                                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                                    {Math.ceil((selectedIds.size || 1) / batchSize)} batches - ~{(Math.ceil((selectedIds.size || 1) / batchSize) - 1) * batchDelayMinutes} min total pause
                                                    <ChevronDown className={cn("w-3 h-3 transition-transform", showBatchSettings && "rotate-180")} />
                                                </span>
                                            </button>
                                            {showBatchSettings && (
                                                <div className="space-y-2.5 bg-slate-50 rounded-xl p-3 border border-slate-100">
                                                    {(selectedIds.size || 1) > 500 && (
                                                        <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg p-2">
                                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                                            <p className="text-[11px] text-amber-700">Gmail ~500/day free, 2,000/day Workspace. Batching prevents blocks.</p>
                                                        </div>
                                                    )}
                                                    <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-2.5 py-2">
                                                        <p className="text-[11px] font-medium text-blue-700">
                                                            {selectedIds.size || 1} emails in {Math.ceil((selectedIds.size || 1) / batchSize)} batches with ~{(Math.ceil((selectedIds.size || 1) / batchSize) - 1) * batchDelayMinutes} min pause.
                                                        </p>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <p className="text-[11px] font-medium text-slate-500">Emails per batch</p>
                                                        <div className="flex gap-1.5">
                                                            {[25, 50, 100].map(n => (
                                                                <button key={n} type="button" onClick={() => setBatchSize(n)}
                                                                    className={cn("flex-1 py-1 text-xs font-semibold rounded-lg border transition-all", batchSize === n ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300")}>
                                                                    {n} emails
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <p className="text-[11px] font-medium text-slate-500">Delay between batches</p>
                                                        <div className="flex gap-1.5">
                                                            {[1, 5, 10].map(m => (
                                                                <button key={m} type="button" onClick={() => setBatchDelayMinutes(m)}
                                                                    className={cn("flex-1 py-1 text-[10px] font-semibold rounded-lg border transition-all", batchDelayMinutes === m ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300")}>
                                                                    {m} min
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2 pt-2 border-t border-slate-100">
                                            <button onClick={() => { setSendPopoverOpen(false); handleBatchDispatch("DRAFT"); }}
                                                disabled={isDispatching}
                                                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all disabled:opacity-50">
                                                <FileDown className="w-3.5 h-3.5" />
                                                {selectedIds.size > 1 ? `Save ${selectedIds.size} Drafts` : "Save Draft"}
                                            </button>
                                            <button onClick={() => { setSendPopoverOpen(false); handleBatchDispatch("SEND"); }}
                                                disabled={isDispatching}
                                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all disabled:opacity-50">
                                                <Send className="w-3.5 h-3.5" />
                                                {selectedIds.size > 1 ? `Send ${selectedIds.size} Emails` : "Send Email"}
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start relative">
                {/* Left: Campaign List (Desktop/Tablet) */}
                <div className="hidden md:block md:col-span-3 space-y-4 sticky top-4">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-xs font-semibold text-slate-500">Company Queue</h3>
                        {campaigns.length > 1 && (
                            <button
                                onClick={toggleSelectAll}
                                className="text-xs font-medium text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-blue-50"
                                aria-label={selectedIds.size === campaigns.length ? "Deselect all campaigns" : "Select all campaigns"}
                            >
                                <div className={cn(
                                    "w-2.5 h-2.5 rounded border transition-all flex items-center justify-center",
                                    selectedIds.size === campaigns.length && campaigns.length > 0
                                        ? "bg-blue-600 border-blue-700 text-white"
                                        : "bg-white border-slate-300"
                                )}>
                                    {selectedIds.size === campaigns.length && campaigns.length > 0 && <Check className="w-2 h-2" />}
                                </div>
                                {selectedIds.size === campaigns.length && campaigns.length > 0 ? "DESELECT" : "SELECT ALL"}
                            </button>
                        )}
                    </div>

                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Search clients..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-100/50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500/50 transition-all"
                        />
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-y-auto custom-scrollbar divide-y divide-slate-100 max-h-[calc(100vh-280px)]">
                        {filteredCampaigns.length === 0 ? (
                            <div className="p-8 text-center space-y-2">
                                <Search className="w-8 h-8 text-slate-200 mx-auto" />
                                <p className="text-xs font-medium text-slate-400">
                                    {isJobActive ? "Scanning Contacts..." : "No matches found"}
                                </p>
                            </div>
                        ) : (
                            filteredCampaigns.map((c, i) => {
                                const originalIndex = campaigns.findIndex(orig => orig.id === c.id);
                                return (
                                    <div
                                        key={c.id}
                                        onClick={() => handleSelectCampaign(originalIndex)}
                                        className={cn(
                                            "p-4 cursor-pointer transition-all duration-200 relative group flex items-start gap-3",
                                            activeIndex === originalIndex ? "bg-slate-50" : "bg-white hover:bg-slate-50/50",
                                            selectedIds.has(c.id) && "ring-1 ring-inset ring-blue-500/20 bg-blue-50/30"
                                        )}
                                    >
                                        <div
                                            onClick={(e) => toggleSelect(c.id, e)}
                                            className={cn(
                                                "mt-0.5 w-4 h-4 rounded border transition-all flex items-center justify-center shrink-0",
                                                selectedIds.has(c.id)
                                                    ? "bg-blue-600 border-blue-700 text-white"
                                                    : "bg-white border-slate-300 hover:border-slate-400"
                                            )}
                                            aria-label={`Select ${c.client?.clientName}`}
                                        >
                                            {selectedIds.has(c.id) && <Check className="w-3 h-3" />}
                                        </div>
                                        <div className="flex flex-col gap-2 flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className={cn("w-1.5 h-1.5 rounded-full", activeIndex === originalIndex ? "bg-blue-600" : "bg-slate-300")} />
                                                    <h4 className={cn("text-[11px] font-medium truncate transition-colors", activeIndex === originalIndex ? "text-slate-900" : "text-slate-500 group-hover:text-slate-700")}>
                                                        {c.client?.clientName}
                                                    </h4>
                                                </div>
                                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border border-slate-100 bg-slate-50 text-slate-400 shrink-0">
                                                    {c.campaignType}
                                                </span>
                                            </div>
                                            <p className={cn(
                                                "text-[10px] font-medium leading-relaxed line-clamp-1 transition-colors pl-3.5",
                                                activeIndex === originalIndex ? "text-slate-600" : "text-slate-400"
                                            )}>
                                                {c.content?.subject}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Mobile Drawer Overlay */}
                <AnimatePresence>
                    {isMobileQueueOpen && (
                        <>
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsMobileQueueOpen(false)}
                                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] md:hidden"
                            />
                            <motion.div 
                                initial={{ x: "-100%" }}
                                animate={{ x: 0 }}
                                exit={{ x: "-100%" }}
                                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                className="fixed inset-y-0 left-0 w-[85%] max-w-sm bg-white shadow-2xl z-[101] flex flex-col md:hidden"
                            >
                                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-slate-900">Company Queue</h3>
                                    <button onClick={() => setIsMobileQueueOpen(false)} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
                                        <X className="w-5 h-5 text-slate-400" />
                                    </button>
                                </div>
                                <div className="p-4 bg-slate-50 border-b border-slate-100">
                                    <div className="relative group">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input 
                                            type="text" 
                                            placeholder="Search clients..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500/50 transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 p-2">
                                    {filteredCampaigns.map((c, i) => {
                                        const originalIndex = campaigns.findIndex(orig => orig.id === c.id);
                                        return (
                                            <div
                                                key={c.id}
                                                onClick={() => { handleSelectCampaign(originalIndex); setIsMobileQueueOpen(false); }}
                                                className={cn(
                                                    "p-5 cursor-pointer transition-all rounded-xl relative group flex items-start gap-4 mb-1",
                                                    activeIndex === originalIndex ? "bg-slate-50" : "bg-white hover:bg-slate-50/50",
                                                    selectedIds.has(c.id) && "ring-1 ring-inset ring-blue-500/20 bg-blue-50/30"
                                                )}
                                            >
                                                <div
                                                    onClick={(e) => { e.stopPropagation(); toggleSelect(c.id, e); }}
                                                    className={cn(
                                                        "mt-0.5 w-5 h-5 rounded border transition-all flex items-center justify-center shrink-0",
                                                        selectedIds.has(c.id) ? "bg-blue-600 border-blue-700 text-white" : "bg-white border-slate-300"
                                                    )}
                                                >
                                                    {selectedIds.has(c.id) && <Check className="w-3.5 h-3.5" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <h4 className="text-[11px] font-medium text-slate-900 truncate">{c.client?.clientName}</h4>
                                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{c.campaignType}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 line-clamp-1">{c.content?.subject}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>

                <div className="col-span-1 md:col-span-9 space-y-5">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col h-[calc(100vh-220px)] min-h-[520px] max-h-[800px] transition-all relative">
                        <div className="p-4 sm:p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar bg-white">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 group">
                                    <div className="w-1 h-4 bg-blue-600 rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity" />
                                    <label className="text-xs font-medium text-slate-400">Subject</label>
                                </div>
                                <input
                                    type="text"
                                    value={editedSubject}
                                    onChange={(e) => { setEditedSubject(e.target.value); setHasEditedSinceLoad(true); }}
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition-colors placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                                    placeholder={isJobActive ? "Crafting your first draft..." : "Write your subject line..."}
                                    aria-label="Email Subject"
                                    disabled={campaigns.length === 0}
                                />
                            </div>

                            <div className="w-full h-px bg-slate-100" />

                            <div className="space-y-4">
                                <div className="flex items-center gap-2 group">
                                    <div className="w-1 h-4 bg-blue-600 rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity" />
                                    <label className="text-xs font-semibold text-slate-500 tracking-wide">Message</label>
                                </div>
                                {activeDraftContext && (
                                    <div className="hidden">
                                        {/* Silent restoration happens in useEffect */}
                                    </div>
                                )}
                                {campaigns.length === 0 && isJobActive ? (
                                    <div className="space-y-4 animate-pulse">
                                        <div className="h-4 w-[90%] bg-slate-50 rounded" />
                                        <div className="h-4 w-[85%] bg-slate-50 rounded" />
                                        <div className="h-4 w-[95%] bg-slate-50 rounded" />
                                        <div className="h-4 w-[40%] bg-slate-50 rounded" />
                                    </div>
                                ) : (
                                    <RichTextEditor
                                        content={editedBody}
                                        onChange={(v) => { setEditedBody(v); setHasEditedSinceLoad(true); }}
                                        onSave={handleSaveEvolution}
                                        onSend={() => handleBatchDispatch("SEND")}
                                        placeholder={isJobActive ? "Drafting narrative..." : "Refine the narrative..."}
                                        sampleData={activeCampaign?.client}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Footer HUD */}
                        <div className="px-4 sm:px-8 py-4 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-4 sm:gap-6">
                                <div className="flex items-center gap-2">
                                    <AlignLeft className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-[10px] font-medium text-slate-500 tabular-nums">
                                        {editedBody.replace(/<[^>]*>/g, '').length} Chars
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-[10px] font-medium text-slate-400 tabular-nums">{readingTime}m read</span>
                                </div>
                            </div>
                                <button
                                    onClick={handleSaveEvolution}
                                    disabled={isSaving}
                                    className="flex items-center gap-2 text-[10px] font-medium text-slate-400 hover:text-blue-600 transition-all px-4 py-2 rounded-full hover:bg-blue-50 border border-transparent hover:border-blue-100 disabled:opacity-50"
                                    aria-label="Save changes to campaign"
                                >
                                    {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                    {isSaving ? "SAVING" : "SAVE CHANGES"}
                                </button>
                        </div>
                    </div>
                </div>

            </div>

            {/* Floating Action HUD (Mobile/Selection) */}
            <AnimatePresence>
                {(selectedIds.size > 0 || isDispatching) && (
                    <motion.div 
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-lg"
                    >
                        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/50 shadow-2xl rounded-2xl p-4 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="bg-blue-600 text-white w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-lg shadow-blue-500/20 tabular-nums">
                                    {selectedIds.size || "1"}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-medium text-slate-400">Active Batch</span>
                                    <span className="text-white text-xs font-bold truncate max-w-[140px]">
                                        {selectedIds.size === 1 
                                            ? campaigns.find(c => selectedIds.has(c.id))?.client?.clientName 
                                            : `${selectedIds.size} Campaigns Ready`}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleBatchDispatch("DRAFT")}
                                    disabled={isDispatching}
                                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                                >
                                    {isDispatching && dispatchMode === "DRAFT" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                                    Draft
                                </button>
                                <button
                                    onClick={() => handleBatchDispatch("SEND")}
                                    disabled={isDispatching}
                                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
                                >
                                    {isDispatching && dispatchMode === "SEND" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                    Send
                                </button>
                                <button 
                                    onClick={() => setSelectedIds(new Set())}
                                    className="p-2.5 text-slate-400 hover:text-white transition-colors"
                                    aria-label="Clear selection"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        
                        {isDispatching && (
                            <div className="absolute -top-1 left-0 right-0 h-1 bg-slate-800 rounded-full overflow-hidden">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${dispatchProgress}%` }}
                                    className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                />
                            </div>
                            )}
                    </motion.div>
                )}
            </AnimatePresence>
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

