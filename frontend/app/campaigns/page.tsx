"use client";

import { useState, useEffect } from "react";
import {
    Send,
    Target,
    RefreshCcw,
    Zap,
    Users,
    Briefcase,
    Radio,
    RefreshCw,
    Network,
    TerminalSquare,
    CheckCircle2,
    Eye,
    PenLine,
    Sparkles,
    ArrowRight,
    ChevronLeft,
    User,
    CheckSquare,
    EyeOff,
    AlertCircle,
    X,
    Building2,
    ChevronRight,
    Loader2,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { SmartLoader } from "@/frontend/components/SmartLoader";
import { toast } from "sonner";
import { ClientPickerModal } from "@/frontend/components/ClientPickerModal";
import { RichTextEditor } from "@/frontend/components/RichTextEditor";
import { wrapInEmailTemplate } from "@/shared/lib/email-template";
import { normalizeEmailBodyHtml } from "@/shared/lib/email-format";
import { sanitizeEmailHtml } from "@/shared/lib/email-sanitize";
import { apiPath } from "@/frontend/lib/app-path";

const campaignTypes = [
    { id: "Broadcast", name: "Broadcast", desc: "Wide-angle communication for large-scale synchronization.", icon: Radio, target: "Active & Warm Leads", bestFor: "Strategic pivots or major infrastructure news." },
    { id: "Targeted", name: "Targeted", desc: "High-precision value propositions for key stakeholders.", icon: Target, target: "Active Clients Only", bestFor: "Exclusive resource sharing or project milestones." },
    { id: "Cross-Sell", name: "Cross-Sell", desc: "Identifying friction and proposing integrated solutions.", icon: Briefcase, target: "Active & Warm Leads", bestFor: "Bridging capability gaps with proven services." },
    { id: "Reactivation", name: "Reactivate", desc: "Re-establishing dialogue with previous partners.", icon: RefreshCw, target: "Past Clients Only", bestFor: "Opening new chapters based on previous success." },
];

// Resonance tuning removed; tone is now inferred from the master draft.

export default function CampaignGenerator() {
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [topic, setTopic] = useState("");
    const [coreMessage, setCoreMessage] = useState("");
    const [cta, setCta] = useState("Let's discuss how this aligns with your goals.");

    const [isGenerating, setIsGenerating] = useState(false);
    const [audienceData, setAudienceData] = useState({ count: 0, industries: [] as string[] });
    const [loadingAudience, setLoadingAudience] = useState(false);
    const [terminalStep, setTerminalStep] = useState(0);

    const [services, setServices] = useState<any[]>([]);
    const [selectedServices, setSelectedServices] = useState<string[]>([]);
    const [serviceLogic, setServiceLogic] = useState<'AND' | 'OR'>('OR');

    // Phased State
    const [isReviewing, setIsReviewing] = useState(false);
    const [sampleData, setSampleData] = useState<any>(null);
    const [editedSubject, setEditedSubject] = useState("");
    const [editedBody, setEditedBody] = useState("");
    const [reviewTab, setReviewTab] = useState<"edit" | "preview">("edit");
    // Email templates were removed; emails are always wrapped in the default "standard" format.
    
    // Client Selection State
    const [targetClients, setTargetClients] = useState<any[]>([]);
    const [loadingTargetClients, setLoadingTargetClients] = useState(false);
    const [showClientPicker, setShowClientPicker] = useState(false);
    
    // Audience Oversight State
    const [excludedClientIds, setExcludedClientIds] = useState<string[]>([]);
    const [showOversightModal, setShowOversightModal] = useState(false);

    // Phase 2: Ultra-Smart states
    const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
    const [subjectSuggestions, setSubjectSuggestions] = useState<string[]>([]);
    const [showSubjectSuggestions, setShowSubjectSuggestions] = useState(false);
    const [sampleQuality, setSampleQuality] = useState<number>(0);
    const [sampleQualityFixes, setSampleQualityFixes] = useState<string[]>([]);
    const [isAutoRefining, setIsAutoRefining] = useState(false);
    const [styleMemory, setStyleMemory] = useState<{
        preferredCtaStyle?: string;
        avgSentenceLength?: number;
        prefersConcise?: boolean;
        learnedPatterns?: string[];
    }>({});

    const toggleExclusion = (id: string) => {
        setExcludedClientIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    // Test Email State
    const [testEmail, setTestEmail] = useState("");
    const [isSendingTest, setIsSendingTest] = useState(false);

    // Draft persistence
    const [draftRestored, setDraftRestored] = useState(false);
    const [pendingDraft, setPendingDraft] = useState<{ subject?: string; bodyHtml?: string; updatedAt?: string } | null>(null);
    const [hasEditedSinceLoad, setHasEditedSinceLoad] = useState(false);
    const draftContext = isReviewing && sampleData
        ? `campaigns__sample__${sampleData.clientId || sampleData.id || "auto"}`
        : null;

    // Restore draft when entering review for this sample
    useEffect(() => {
        if (!draftContext) return;
        let cancelled = false;
        setDraftRestored(false);
        setPendingDraft(null);
        setHasEditedSinceLoad(false);
        (async () => {
            try {
            const res = await fetch(apiPath(`/drafts/${encodeURIComponent(draftContext)}`));
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
    }, [draftContext]);

    // Debounced autosave
    useEffect(() => {
        if (!draftContext) return;
        // If there is a pending draft and the user hasn't edited, don't overwrite anything.
        if (pendingDraft && !hasEditedSinceLoad) return;
        const t = setTimeout(() => {
            fetch(apiPath(`/drafts/${encodeURIComponent(draftContext)}`), {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    subject: editedSubject || "",
                    bodyHtml: normalizeEmailBodyHtml(editedBody || ""),
                    metadata: {
                        type: selectedType,
                        topic,
                        cta,
                        clientId: sampleData?.clientId || sampleData?.id,
                    },
                }),
            }).catch(() => {});
        }, 700);
        return () => clearTimeout(t);
    }, [draftContext, editedSubject, editedBody, selectedType, topic, cta, sampleData, pendingDraft, hasEditedSinceLoad]);

    useEffect(() => {
        fetch(apiPath("/services"))
            .then(res => res.json())
            .then(data => {
                if (data.success) setServices(data.data);
            })
            .catch(console.error);
    }, []);

    useEffect(() => {
        try {
            const raw = localStorage.getItem("campaignStyleMemory");
            if (raw) setStyleMemory(JSON.parse(raw));
        } catch {
            // ignore malformed cache
        }
    }, []);

    useEffect(() => {
        if (!selectedType) return;
        setLoadingAudience(true);

            fetch(apiPath("/campaigns/estimate"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                type: selectedType,
                serviceFilters: selectedServices,
                serviceLogic,
                excludedClientIds
            })
        })
            .then(async res => {
                const contentType = res.headers.get("content-type");
                if (!res.ok || !contentType?.includes("application/json")) {
                    const text = await res.text();
                    console.error("Non-OK Response:", text.slice(0, 200));
                    throw new Error("Neural link unstable. Calibration failed.");
                }
                return res.json();
            })
            .then(data => {
                if (data.success) {
                    setAudienceData({ count: data.data.count, industries: data.data.industries });
                } else {
                    toast.error(data.error?.message || "Neural analytics failed.");
                    setAudienceData({ count: 0, industries: [] });
                }
            })
            .catch(err => {
                console.error("Audience estimation error:", err);
                toast.error(err.message || "Network synchronization lost.");
                setAudienceData({ count: 0, industries: [] });
            })
            .finally(() => setLoadingAudience(false));
    }, [selectedType, selectedServices, serviceLogic, excludedClientIds]);

    const handleGenerateSample = async (clientId?: string) => {
        if (!selectedType || !topic || !coreMessage) {
            toast.error("Please select an objective and provide a topic/message core.");
            return;
        }

        if (audienceData.count === 0) {
            toast.error("The selected objective has no target audience in your client database.");
            return;
        }

        setIsGenerating(true);
        if (clientId) {
            setShowClientPicker(false);
            // Ultra-Smart Logic: If the user picks an excluded client for a sample, 
            // we remove them from the exclusion list because they are clearly being targeted now.
            if (excludedClientIds.includes(clientId)) {
                setExcludedClientIds(prev => prev.filter(id => id !== clientId));
            }
        }
        
        try {
            setTerminalStep(1);
            await new Promise(r => setTimeout(r, 800));
            setTerminalStep(3);

            const res = await fetch(apiPath("/campaigns/generate"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    type: selectedType, 
                    topic, 
                    coreMessage, 
                    cta, 
                    serviceFilters: selectedServices,
                    serviceLogic: serviceLogic,
                    sampleOnly: true,
                    clientId, // Optional specific client
                    excludedClientIds,
                    styleMemory
                }),
            });

            const data = await res.json();
            
            if (res.ok && data.success && data.data.sample) {
                const sample = data.data.sample;
                const output = JSON.parse(sample.generatedOutput);
                setSampleData(sample);
                setEditedSubject(output.subject);
                setEditedBody(sanitizeEmailHtml(normalizeEmailBodyHtml(output.body || "")));
                setSampleQuality(output.personalizationQuality || 0);
                setSampleQualityFixes(Array.isArray(output.qualityFixes) ? output.qualityFixes : []);
                setIsReviewing(true);
            } else {
                toast.error(data.error?.message || "Failed to generate preview sample.");
            }
        } catch (err) {
            console.error(err);
            toast.error("Neural synthesis failed.");
        } finally {
            setIsGenerating(false);
            setTerminalStep(0);
        }
    };

    const fetchTargetClients = async () => {
        setLoadingTargetClients(true);
        try {
            const res = await fetch(apiPath("/campaigns/target-clients"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: selectedType || "",
                    serviceFilters: selectedServices,
                    serviceLogic,
                    includeExclusions: true
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setTargetClients(data.data);
                setShowClientPicker(true);
            } else {
                toast.error("Failed to fetch target clients.");
            }
        } catch (err) {
            console.error(err);
            toast.error("Audience retrieval failed.");
        } finally {
            setLoadingTargetClients(false);
        }
    };

    const handleSuggestSubjects = async () => {
        if (!topic || !coreMessage || !sampleData) {
            toast.error("Need topic and core message to optimize subjects.");
            return;
        }

        setIsGeneratingSuggestions(true);
        try {
            const res = await fetch(apiPath("/campaigns/suggest-subjects"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    topic, 
                    coreMessage, 
                    clientName: sampleData.clientName,
                    industry: sampleData.industry
                })
            });
            const data = await res.json();
            if (data.success) {
                const ranked = Array.isArray(data.data?.ranked) ? data.data.ranked : [];
                setSubjectSuggestions(
                    ranked.length > 0
                        ? ranked.map((r: any) => `${r.subject}`)
                        : (data.data?.suggestions || [])
                );
                setShowSubjectSuggestions(true);
                if (Array.isArray(data.data?.warnings) && data.data.warnings.length > 0) {
                    toast.warning(data.data.warnings[0]);
                }
            } else {
                toast.error("Subject optimization failed.");
            }
        } catch (err) {
            toast.error("Neural link timeout.");
        } finally {
            setIsGeneratingSuggestions(false);
        }
    };

    const handleGenerateAll = async () => {
        const plain = editedBody.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        const sentences = plain.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
        const avgSentenceLength = sentences.length
            ? Math.round(sentences.reduce((acc, s) => acc + s.split(/\s+/).filter(Boolean).length, 0) / sentences.length)
            : undefined;
        const nextStyleMemory = {
            preferredCtaStyle: cta.length > 80 ? "detailed" : "direct",
            avgSentenceLength,
            prefersConcise: plain.split(/\s+/).filter(Boolean).length < 180,
            learnedPatterns: [
                editedSubject.slice(0, 120),
                plain.slice(0, 220),
            ].filter(Boolean),
        };
        setStyleMemory(nextStyleMemory);
        try {
            localStorage.setItem("campaignStyleMemory", JSON.stringify(nextStyleMemory));
        } catch {
            // ignore storage failure
        }

        if ((editedSubject || "").trim().length < 8) {
            toast.error("Subject is too short. Add a clearer value-led subject before batch generation.");
            return;
        }
        if ((editedBody || "").replace(/<[^>]*>/g, "").trim().length < 80) {
            toast.error("Email body is too short for quality outreach. Please add more context.");
            return;
        }

        setIsGenerating(true);
        try {
            setTerminalStep(3);
            await new Promise(r => setTimeout(r, 1000));
            setTerminalStep(4);

            const res = await fetch(apiPath("/campaigns/generate"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    type: selectedType, 
                    topic, 
                    coreMessage, 
                    cta, 
                    styleGuide: { subject: editedSubject, body: editedBody },
                    styleMemory: nextStyleMemory,
                    serviceFilters: selectedServices,
                    serviceLogic: serviceLogic,
                    excludedClientIds: [...excludedClientIds, sampleData?.clientId].filter(Boolean),
                }),
            });

            const data = await res.json().catch(() => null);
            if (res.ok && data?.success) {
                const jobId = data?.data?.jobId as string | undefined;
                window.location.href = jobId
                    ? `/campaigns/results?jobId=${encodeURIComponent(jobId)}`
                    : "/campaigns/results";
            } else {
                toast.error(data?.error?.message || "Batch generation failed.");
            }
        } catch (err) {
            console.error(err);
            setIsGenerating(false);
            setTerminalStep(0);
        }
    };

    const handleSendTestEmail = async () => {
        if (!testEmail || !testEmail.includes("@")) {
            toast.error("Please enter a valid email address.");
            return;
        }

        setIsSendingTest(true);
        try {
            const res = await fetch(apiPath("/campaigns/test-send"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: testEmail,
                    subject: editedSubject,
                    body: editedBody
                }),
            });

            const data = await res.json();
            if (data.success) {
                toast.success("Strategic test dispatch successful!");
                setTestEmail(""); // Clear after success
            } else {
                toast.error(data.error?.message || data.error || "Tactical bypass failed. Check credentials.");
            }
        } catch (err) {
            console.error(err);
            toast.error("Network disruption during dispatch.");
        } finally {
            setIsSendingTest(false);
        }
    };

    const handleSmartRefine = async (command: string) => {
        if (!editedBody?.trim()) return;
        setIsAutoRefining(true);
        try {
            const res = await fetch(apiPath("/campaigns/refine"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: editedBody,
                    command,
                }),
            });
            const data = await res.json();
            if (data.success && data.data?.refinedText) {
                setEditedBody(sanitizeEmailHtml(normalizeEmailBodyHtml(data.data.refinedText)));
                setHasEditedSinceLoad(true);
                toast.success("Smart refinement applied.");
            } else {
                toast.error(data.error?.message || "Smart refinement failed.");
            }
        } catch {
            toast.error("Unable to run refinement right now.");
        } finally {
            setIsAutoRefining(false);
        }
    };

    if (isGenerating) {
        const labels: Record<number, string> = {
            1: "Connecting to Database",
            2: "Selecting Target Clients",
            3: `Generating Intelligence`,
            4: "Finalising Campaign"
        };
        const descs: Record<number, string> = {
            1: "Establishing AI communication link...",
            2: `Filtering ${audienceData.count} ${selectedType} clients...`,
            3: `Applying style guide and brand identity...`,
            4: "Campaign ready for review..."
        };

        return (
            <div className="w-full pb-20 px-3 sm:px-4 lg:px-6 min-h-[60vh] flex items-center">
                <SmartLoader label={labels[terminalStep] || "Processing"} description={descs[terminalStep] || "Initializing logic..."} />
            </div>
        );
    }

    if (isReviewing && sampleData) {
        return (
            <div className="w-full pb-20 px-3 sm:px-4 lg:px-6">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <button 
                            onClick={() => setIsReviewing(false)}
                            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors uppercase tracking-widest mb-2"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            Back to Config
                        </button>
                        <h2 className="text-3xl font-semibold tracking-tight text-slate-900 flex items-center gap-3">
                            Refine Your Message
                            <Sparkles className="w-6 h-6 text-amber-500 animate-pulse" />
                        </h2>
                        <p className="text-sm font-medium text-slate-500 mt-1">
                            Review the AI-generated sample for <span className="text-blue-600 font-bold">{sampleData.clientName}</span>. Any changes you make here will guide the style for the entire batch.
                        </p>
                    </div>
                    <div className="hidden md:block">
                        <div className="px-4 py-2 bg-blue-50 border border-blue-100 rounded-lg">
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-0.5">Audience Size</p>
                            <p className="text-lg font-black text-blue-900">{audienceData.count} Clients Combined</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-xl border-2 border-slate-200 shadow-xl overflow-hidden ring-4 ring-slate-50">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                    <button 
                                        onClick={() => setReviewTab("edit")}
                                        className={cn(
                                            "flex items-center gap-2 pb-4 -mb-4 transition-all relative",
                                            reviewTab === "edit" ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
                                        )}
                                    >
                                        <PenLine className="w-4 h-4" />
                                        <span className="text-sm font-bold uppercase tracking-wider">Strategic Edit</span>
                                        {reviewTab === "edit" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-full" />}
                                    </button>
                                    <button 
                                        onClick={() => setReviewTab("preview")}
                                        className={cn(
                                            "flex items-center gap-2 pb-4 -mb-4 transition-all relative",
                                            reviewTab === "preview" ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
                                        )}
                                    >
                                        <Eye className="w-4 h-4" />
                                        <span className="text-sm font-bold uppercase tracking-wider">Live Preview</span>
                                        {reviewTab === "preview" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-full" />}
                                    </button>
                                </div>
                                <span className="text-[10px] font-black text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200 uppercase tracking-tighter">
                                    {reviewTab === "edit" ? "Logic Source" : "Final Render"}
                                </span>
                            </div>
                            <div className="p-8">
                                {reviewTab === "edit" ? (
                                    <div className="space-y-6">
                                        <div className="space-y-1.5 relative">
                                            <div className="flex items-center justify-between pl-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Email Subject Line</label>
                                                <button 
                                                    onClick={handleSuggestSubjects}
                                                    disabled={isGeneratingSuggestions}
                                                    className="flex items-center gap-1.5 text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded transition-all"
                                                >
                                                    {isGeneratingSuggestions ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-amber-500" />}
                                                    Smart Suggestions
                                                </button>
                                            </div>
                                            <input
                                                type="text"
                                                value={editedSubject}
                                        onChange={(e) => { setEditedSubject(e.target.value); setHasEditedSinceLoad(true); }}
                                                className="w-full bg-slate-50/50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition-all font-bold shadow-inner"
                                            />
                                            
                                            {showSubjectSuggestions && subjectSuggestions.length > 0 && (
                                                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 p-3 space-y-2 animate-in fade-in slide-in-from-top-2">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">AI Optimized Alternatives</p>
                                                        <button onClick={() => setShowSubjectSuggestions(false)} className="text-[9px] font-bold text-slate-400 hover:text-rose-500 uppercase tracking-widest">Close</button>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        {subjectSuggestions.map((s, idx) => (
                                                            <button 
                                                                key={idx}
                                                                onClick={() => {
                                                                    setEditedSubject(s);
                                                                    setShowSubjectSuggestions(false);
                                                                }}
                                                                className="w-full text-left p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all text-sm font-semibold text-slate-700 hover:text-blue-700"
                                                            >
                                                                {s}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {pendingDraft && (
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[10px] font-bold text-amber-900 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg uppercase tracking-widest">
                                                <span>Draft found for this sample. Restore it?</span>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditedSubject(pendingDraft.subject || "");
                                                        setEditedBody(sanitizeEmailHtml(pendingDraft.bodyHtml || ""));
                                                            setDraftRestored(true);
                                                            setPendingDraft(null);
                                                            toast.info("Draft restored.");
                                                        }}
                                                        className="px-3 py-1.5 rounded-md bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                                                    >
                                                        Restore
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            try {
                await fetch(apiPath(`/drafts/${encodeURIComponent(draftContext!)}`), { method: "DELETE" });
                                                            } catch {}
                                                            setPendingDraft(null);
                                                            toast.info("Draft discarded.");
                                                        }}
                                                        className="px-3 py-1.5 rounded-md bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 transition-colors"
                                                    >
                                                        Discard
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {draftRestored && !pendingDraft && (
                                            <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg uppercase tracking-widest">
                                                Draft restored and autosaving
                                            </div>
                                        )}
                                        <div className="space-y-1.5 min-h-[600px]">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Email Body (Rich Text control)</label>
                                            <RichTextEditor 
                                                content={editedBody} 
                                                onChange={(v) => { setEditedBody(v); setHasEditedSinceLoad(true); }}
                                                placeholder="Begin your strategized draft..."
                                                sampleData={sampleData}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="pb-4 border-b border-slate-100">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subject</p>
                                                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600">
                                                    Standard
                                                </span>
                                            </div>
                                            <h4 className="text-lg font-bold text-slate-900">{editedSubject}</h4>
                                        </div>
                                        <div className="rounded-xl overflow-hidden border border-slate-100 shadow-inner bg-slate-50 h-[600px]">
                                            <iframe 
                                                srcDoc={wrapInEmailTemplate("standard", editedBody, sampleData.clientName, { isPreview: true })}
                                                className="w-full h-full border-none"
                                                title="Email Preview"
                                            />
                                        </div>
                                        <div className="pt-8 border-t border-slate-50">
                                            <div className="flex items-center gap-3 text-slate-400">
                                                <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center">
                                                    <User className="w-4 h-4" />
                                                </div>
                                                <div className="text-[10px] font-bold uppercase tracking-widest leading-tight">
                                                    Professional Display Rendered<br/>
                                                    <span className="text-blue-500/60 lowercase italic">Ready for deployment</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0">
                                    {sampleData.clientName[0]}
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-tighter">Current Sample</p>
                                    <p className="text-sm font-bold text-slate-900 truncate max-w-[180px]">{sampleData.clientName}</p>
                                </div>
                                <button
                                    onClick={fetchTargetClients}
                                    className="ml-auto text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded border border-blue-100 transition-colors"
                                >
                                    {loadingTargetClients ? "Loading..." : "Change"}
                                </button>
                            </div>

                            <ClientPickerModal
                                isOpen={showClientPicker}
                                onClose={() => setShowClientPicker(false)}
                                clients={targetClients}
                                selectedClientId={sampleData.clientId}
                                onSelect={handleGenerateSample}
                                loading={loadingTargetClients}
                                excludedIds={excludedClientIds}
                            />

                            
                            <div className="pt-6 border-t border-slate-100 space-y-4">
                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Test Dispatch</h4>
                                <div className="space-y-2">
                                    <input
                                        type="email"
                                        placeholder="Enter test email..."
                                        value={testEmail}
                                        onChange={(e) => setTestEmail(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-500 transition-all font-medium"
                                    />
                                    <button
                                        onClick={handleSendTestEmail}
                                        disabled={isSendingTest || !testEmail}
                                        className="w-full py-2.5 bg-white border-2 border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-blue-500 hover:text-blue-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isSendingTest ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                        Run Test Dispatch
                                    </button>
                                </div>
                            </div>

                            <div className="pt-6">
                                <button
                                    onClick={handleGenerateAll}
                                    className="w-full bg-slate-900 text-white py-4 px-4 rounded-xl text-sm font-black hover:bg-black active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg group"
                                >
                                    Proceed & Generate All
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>
                                <p className="text-[10px] text-center text-slate-400 mt-4 font-bold uppercase tracking-widest">
                                    This will generate emails for {audienceData.count - 1} other clients.
                                </p>
                            </div>
                        </div>

                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-5 flex gap-4">
                            <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
                            <p className="text-xs font-medium text-amber-900 leading-relaxed">
                                <strong>Pro-tip:</strong> AI will analyze your edits above to calibrate the tone and structure of all other emails in this campaign.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const isReady = selectedType && topic && coreMessage && cta;

    const toggleService = (serviceName: string) => {
        setSelectedServices(prev => 
            prev.includes(serviceName) 
                ? prev.filter(s => s !== serviceName) 
                : [...prev, serviceName]
        );
    };

    return (
        <div className="w-full pb-20 px-3 sm:px-4 lg:px-6">
            <div className="mb-8 px-2 md:px-0">
                <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Campaign Builder</h2>
                <p className="text-sm font-medium text-slate-500 mt-1">Configure and deploy intelligent multi-node communications.</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 items-start">
                <div className="flex-1 space-y-8 min-w-0 w-full">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="text-base font-semibold text-slate-900">1. Select Objective</h3>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {campaignTypes.map((type) => (
                                <div
                                    key={type.id}
                                    onClick={() => setSelectedType(type.id)}
                                    className={cn(
                                        "p-5 rounded-lg border cursor-pointer transition-all",
                                        selectedType === type.id
                                            ? "bg-blue-50/50 border-blue-500 ring-1 ring-blue-500"
                                            : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                    )}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <type.icon className={cn("w-5 h-5", selectedType === type.id ? "text-blue-600" : "text-slate-400")} />
                                            <h4 className="text-sm font-semibold text-slate-900">{type.name}</h4>
                                        </div>
                                        {selectedType === type.id && <CheckCircle2 className="w-5 h-5 text-blue-600" />}
                                    </div>
                                    <p className="text-xs text-slate-500 mb-3 leading-relaxed">{type.desc}</p>
                                    <div className="flex flex-col gap-2 pt-3 border-t border-slate-100">
                                        <div className="flex items-center gap-1.5">
                                            <Users className="w-3.5 h-3.5 text-slate-400" />
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{type.target}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Zap className="w-3.5 h-3.5 text-blue-400" />
                                            <span className="text-[10px] font-bold text-blue-600/80 uppercase tracking-widest leading-none">Best For: {type.bestFor}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Ultra-Smart Segmentation */}
                        {selectedType === "Cross-Sell" && (
                            <div className="px-6 pb-6 pt-2 border-t border-slate-100">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                                                <Sparkles className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Audience Segmentation</h4>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                    Target specific service users for this {campaignTypes.find(t => t.id === selectedType)?.name || selectedType} mission
                                                </p>
                                            </div>
                                        </div>
                                        
                                        {/* Logic Toggle */}
                                        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                                            <button 
                                                onClick={() => setServiceLogic('OR')}
                                                className={cn(
                                                    "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all",
                                                    serviceLogic === 'OR' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                                )}
                                            >
                                                Match Any
                                            </button>
                                            <button 
                                                onClick={() => setServiceLogic('AND')}
                                                className={cn(
                                                    "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all",
                                                    serviceLogic === 'AND' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                                )}
                                            >
                                                Match All
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                        {services.map(s => (
                                            <div 
                                                key={s.id}
                                                onClick={() => toggleService(s.serviceName)}
                                                className={cn(
                                                    "px-3 py-2 rounded-lg border-2 cursor-pointer transition-all flex items-center gap-2",
                                                    selectedServices.includes(s.serviceName)
                                                        ? "bg-blue-50 border-blue-500/30 text-blue-700 shadow-sm"
                                                        : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-all",
                                                    selectedServices.includes(s.serviceName)
                                                        ? "bg-blue-600 border-blue-600"
                                                        : "border-slate-200"
                                                )}>
                                                    {selectedServices.includes(s.serviceName) && <CheckSquare className="w-2.5 h-2.5 text-white" />}
                                                </div>
                                                <span className="text-[10px] font-bold uppercase truncate">{s.serviceName}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100/50">
                                        <p className="text-[10px] text-blue-700 font-medium leading-relaxed">
                                            <strong>Ultra-Smart Logic:</strong> Targeting clients who currently have 
                                            <span className="font-bold underline mx-1">{serviceLogic === "AND" ? "ALL" : "ANY"}</span> 
                                            of the {selectedServices.length} selected services. 
                                            {selectedServices.length === 0 && " currently targeting everyone in this segment."}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="text-base font-semibold text-slate-900">2. Master Emailer (Sample)</h3>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-700">Master Subject Line</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Strategic Perspective for {{companyName}} | Re: Q4 Resilience"
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-md px-4 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-end">
                                    <label className="text-sm font-medium text-slate-700">Master Email Body (Your Sample)</label>
                                    <div className="flex gap-2">
                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">{"{{clientName}}"}</span>
                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">{"{{industry}}"}</span>
                                    </div>
                                </div>
                                <RichTextEditor
                                    content={coreMessage}
                                    onChange={setCoreMessage}
                                    placeholder="Paste your sample emailer here. Use variables like {{greeting}}, {{firstName}}, or {{companyName}} for personalization..."
                                    sampleData={{
                                        clientName: "Example Corp",
                                        contactPerson: "John Smith",
                                        industry: "Technology",
                                        clientAddedOn: new Date().toISOString()
                                    }}
                                />
                            </div>
                            <div className="p-4 bg-amber-50 rounded-lg border border-amber-100 flex gap-3">
                                <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
                                <p className="text-xs text-amber-900 leading-relaxed">
                                    <strong>Advanced Personalization:</strong> AI will analyze your sample draft above and generate a bespoke version for every client, adapting the tone while strictly maintaining your core message.
                                </p>
                            </div>
                        </div>
                    </div>



                </div>

                {/* Right Pane: Sticky Summary */}
                <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 lg:sticky lg:top-8 space-y-6">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                            <Network className="w-4 h-4 text-blue-600" />
                            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Pre-Flight Check</h3>
                        </div>
                        <div className="p-6 space-y-6">

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Target Audience</p>
                                    <div className="flex items-end gap-3">
                                        <span className="text-4xl font-semibold tracking-tight text-slate-900">
                                            {!selectedType ? "-" : loadingAudience ? <RefreshCw className="w-6 h-6 animate-spin text-slate-300 mb-1" /> : audienceData.count}
                                        </span>
                                        {selectedType && !loadingAudience && (
                                            <span className="text-sm font-medium text-slate-500 mb-1.5">{selectedType} Campaign</span>
                                        )}
                                    </div>
                                </div>
                                {selectedType && audienceData.count > 0 && (
                                    <button 
                                        onClick={async () => {
                                            setLoadingTargetClients(true);
                                            setShowOversightModal(true);
                                            try {
            const res = await fetch(apiPath("/campaigns/target-clients"), {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({
                                                        type: selectedType || "",
                                                        serviceFilters: selectedServices,
                                                        serviceLogic,
                                                        includeExclusions: true
                                                    })
                                                });
                                                const data = await res.json();
                                                if (res.ok && data.success) setTargetClients(data.data);
                                            } catch (err) {
                                                toast.error("Failed to fetch audience list");
                                                setShowOversightModal(false);
                                            } finally {
                                                setLoadingTargetClients(false);
                                            }
                                        }}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all"
                                    >
                                        <Users className="w-3.5 h-3.5" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Review</span>
                                    </button>
                                )}
                            </div>

                            {selectedType && audienceData.industries.length > 0 && (
                                <div className="pt-4 border-t border-slate-100">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Distributions</p>
                                    <div className="flex flex-wrap gap-2">
                                        {audienceData.industries.map(ind => (
                                            <span key={ind} className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-semibold text-slate-600">{ind}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 border-t border-slate-100">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Configuration</p>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-start">
                                        <span className="text-sm text-slate-500">Subject</span>
                                        <span className="text-sm font-medium text-slate-900 text-right max-w-[150px] truncate">{topic || "-"}</span>
                                    </div>
                                    <div className="flex justify-between items-start">
                                        <span className="text-sm text-slate-500">Logic Core</span>
                                        <span className="text-sm font-medium text-slate-900">{coreMessage.length > 0 ? "Configured" : "-"}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50/50 border-t border-slate-100">
                            <button
                                onClick={() => handleGenerateSample()}
                                disabled={!isReady || isGenerating || audienceData.count === 0}
                                className="w-full bg-blue-600 text-white py-4 px-4 rounded-xl text-sm font-black hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-500/10 disabled:grayscale disabled:opacity-40 disabled:cursor-not-allowed group"
                            >
                                {isGenerating ? <RefreshCcw className="w-5 h-5 animate-spin" /> : (
                                    <>
                                        Generate Strategized Draft
                                        <Zap className="w-4 h-4 text-blue-300 group-hover:text-amber-400 group-hover:rotate-12 transition-all" />
                                    </>
                                )}
                            </button>
                            {!isReady ? (
                                <p className="text-[10px] font-bold uppercase tracking-widest text-center text-slate-400 mt-4 leading-relaxed">
                                    Complete mission parameters to initiate synthesis.
                                </p>
                            ) : audienceData.count === 0 ? (
                                <p className="text-[10px] font-bold uppercase tracking-widest text-center text-rose-500 mt-4 leading-relaxed">
                                    Zero audience detected for this objective.
                                </p>
                            ) : (
                                <p className="text-[10px] font-bold uppercase tracking-widest text-center text-blue-500 mt-4 leading-relaxed tracking-[0.2em]">
                                    Systems Ready for Neural Synthesis
                                </p>
                            )}
                        </div>
                    </div>
                </div>

            </div>
            {/* Audience Oversight Modal */}
            <ClientPickerModal
                isOpen={showOversightModal}
                onClose={() => setShowOversightModal(false)}
                clients={targetClients}
                loading={loadingTargetClients}
                mode="oversight"
                excludedIds={excludedClientIds}
                onToggleExclusion={toggleExclusion}
                onSetExcludedIds={setExcludedClientIds}
                onSelect={() => {}}
            />
        </div>
    );
}

