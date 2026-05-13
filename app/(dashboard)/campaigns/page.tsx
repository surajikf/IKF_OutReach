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
    Database,
    ChevronRight,
    Loader2,
    Clock,
} from "lucide-react";
import { cn } from "@/lib/shared/utils";
import { SmartLoader } from "@/components/layout/SmartLoader";
import { toast } from "sonner";
import { ClientPickerModal } from "@/components/modals/ClientPickerModal";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { wrapInEmailTemplate } from "@/lib/shared/email-template";
import { normalizeEmailBodyHtml } from "@/lib/shared/email-format";
import { sanitizeEmailHtml } from "@/lib/shared/email-sanitize";
import { apiPath } from "@/lib/app-path";
import { readCampaignSession, writeCampaignSession } from "@/lib/campaign-session";

const campaignTypes = [
    {
        id: "Broadcast", name: "Broadcast", desc: "Send one clear update to many clients.", icon: Radio, target: "Active & Warm Leads", bestFor: "News, updates, and announcements.",
        tooltip: "Like a company newsletter. You write one email and everyone gets a personalised version of it. Best when you have news, a product update, or something useful to say to your whole client base."
    },
    {
        id: "Targeted", name: "Targeted", desc: "Send a focused message to the right clients.", icon: Target, target: "Active Clients Only", bestFor: "Specific offers or milestones.",
        tooltip: "You pick a specific group — for example, clients using a particular service — and send them a message that's relevant only to them. Much higher open rates than a broadcast."
    },
    {
        id: "Cross-Sell", name: "Cross-Sell", desc: "Suggest other useful services to clients.", icon: Briefcase, target: "Active & Warm Leads", bestFor: "Add-on services and upgrades.",
        tooltip: "Reach clients who already trust you but haven't tried your other services yet. The AI suggests a natural next step based on what they're already using."
    },
    {
        id: "Reactivation", name: "Reactivate", desc: "Reconnect with old clients.", icon: RefreshCw, target: "Past Clients Only", bestFor: "Win-back and follow-up.",
        tooltip: "For clients you haven't heard from in a while. A warm, non-pushy nudge that re-opens the conversation. Often the highest ROI campaign type."
    },
];

type AudienceSource = "INVOICE_SYSTEM" | "ZOHO_BIGIN" | "GMAIL" | "GOOGLE_CONTACTS";

const SourceIcon = ({ id, className }: { id: AudienceSource; className?: string }) => {
    if (id === "INVOICE_SYSTEM") return <Database className={cn("text-indigo-500", className)} />;
    if (id === "ZOHO_BIGIN") return (
        <svg className={cn("shrink-0", className)} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
            <circle cx="128" cy="128" r="128" fill="#E42527"/>
            <path d="M60 88h88L60 168v16h136v-24h-88l88-80V72H60z" fill="#fff"/>
        </svg>
    );
    if (id === "GMAIL") return (
        <svg className={cn("shrink-0", className)} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M4.6 3H6v.9L12 8.5l6-4.6V3h1.4C20.84 3 22 4.16 22 5.6V6L12 13.5 2 6v-.4C2 4.16 3.16 3 4.6 3z" fill="#C5221F"/>
            <path d="M2 6l10 7.5L22 6v12.4C22 19.84 20.84 21 19.4 21H4.6C3.16 21 2 19.84 2 18.4V6z" fill="#EA4335"/>
        </svg>
    );
    if (id === "GOOGLE_CONTACTS") return (
        <svg className={cn("shrink-0", className)} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 24c4.97 0 9-4.03 9-9s-4.03-9-9-9-9 4.03-9 9 4.03 9 9 9zm0 4.5c-6.01 0-18 3.01-18 9V42h36v-4.5c0-5.99-11.99-9-18-9z" fill="#34A853"/>
            <path d="M36 6v6h-6v4h6v6h4v-6h6v-4h-6V6z" fill="#1A73E8"/>
        </svg>
    );
    return null;
};

const audienceSourceOptions: Array<{
    id: AudienceSource;
    name: string;
    desc: string;
    note: string;
}> = [
    {
        id: "INVOICE_SYSTEM",
        name: "Invoice",
        desc: "Use contacts from invoice records.",
        note: "Includes invoice & service history.",
    },
    {
        id: "ZOHO_BIGIN",
        name: "Zoho Bigin",
        desc: "Use contacts from Zoho Bigin.",
        note: "CRM fields & stages only.",
    },
    {
        id: "GMAIL",
        name: "Gmail",
        desc: "Use contacts synced from Gmail.",
        note: "Email contacts only, no invoice data.",
    },
    {
        id: "GOOGLE_CONTACTS",
        name: "Google Contacts",
        desc: "Use contacts from your Google directory.",
        note: "Directory contacts with email addresses.",
    },
];

const recommendedObjectiveBySource: Record<AudienceSource, string> = {
    INVOICE_SYSTEM: "Cross-Sell",
    ZOHO_BIGIN: "Targeted",
    GMAIL: "Broadcast",
    GOOGLE_CONTACTS: "Broadcast",
};

const smartContentGuide: Record<AudienceSource, Record<string, { subject: string; body: string; tip: string }>> = {
    INVOICE_SYSTEM: {
        Broadcast: {
            subject: "Service update for {{companyName}}",
            body: "Share one short update with value and a clear next step.",
            tip: "Use service history to make the message specific.",
        },
        Targeted: {
            subject: "Next step for {{companyName}}",
            body: "Write a focused message based on current service usage.",
            tip: "Mention one concrete problem and one direct solution.",
        },
        "Cross-Sell": {
            subject: "Suggested add-on service for {{companyName}}",
            body: "Recommend related services based on existing services.",
            tip: "Keep it consultative, not sales-heavy.",
        },
        Reactivation: {
            subject: "Can we reconnect, {{companyName}}?",
            body: "Reconnect with a warm, respectful check-in and clear value.",
            tip: "Reference past work briefly and suggest one next action.",
        },
    },
    ZOHO_BIGIN: {
        Broadcast: {
            subject: "Quick business update for {{companyName}}",
            body: "Send a broad CRM-friendly update.",
            tip: "Keep it short and clear for mixed-stage contacts.",
        },
        Targeted: {
            subject: "Proposal update for {{companyName}}",
            body: "Write a stage-aware message tied to current CRM context.",
            tip: "Add one reason to reply now.",
        },
        "Cross-Sell": {
            subject: "Useful support for {{companyName}}",
            body: "Suggest complementary services without invoice-level detail.",
            tip: "Use simple benefit language.",
        },
        Reactivation: {
            subject: "Checking in with {{companyName}}",
            body: "Re-open conversation with helpful context.",
            tip: "Keep tone friendly and low pressure.",
        },
    },
    GMAIL: {
        Broadcast: {
            subject: "Quick note for {{companyName}}",
            body: "Share a clear update with a single call to action.",
            tip: "Avoid long blocks; 3-5 short paragraphs works best.",
        },
        Targeted: {
            subject: "A focused idea for {{companyName}}",
            body: "Write one personalized message based on contact context.",
            tip: "Use a practical, conversational tone.",
        },
        "Cross-Sell": {
            subject: "Support options for {{companyName}}",
            body: "Suggest relevant options from known contact intent.",
            tip: "Keep offers limited to 1-2 items.",
        },
        Reactivation: {
            subject: "Reconnecting with {{companyName}}",
            body: "Start with a short reconnection note.",
            tip: "Ask an easy yes/no follow-up question.",
        },
    },
    GOOGLE_CONTACTS: {
        Broadcast: {
            subject: "A quick update for {{companyName}}",
            body: "Share a concise, friendly update with a clear call to action.",
            tip: "Keep it short — directory contacts may have limited prior context.",
        },
        Targeted: {
            subject: "Reaching out to {{companyName}}",
            body: "Write a warm, personalised introduction or follow-up.",
            tip: "Focus on one topic; make it easy to reply.",
        },
        "Cross-Sell": {
            subject: "Something that might help {{companyName}}",
            body: "Suggest one relevant service or offering with brief context.",
            tip: "Lead with a benefit, not a feature.",
        },
        Reactivation: {
            subject: "Checking in with {{companyName}}",
            body: "Reconnect with a light, low-pressure message.",
            tip: "Reference any shared context if available.",
        },
    },
};

function notifyAiRoutingStatus(aiRouting: any) {
    if (!aiRouting) return;
    if (aiRouting.providerUsed === "openrouter" && aiRouting.fallbackActive) {
        const retryAt = aiRouting.groqRetryAt
            ? new Date(aiRouting.groqRetryAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : null;
        toast.info(
            retryAt
                ? `Using backup AI engine. Groq auto-retry after ${retryAt}.`
                : "Using backup AI engine. Groq will auto-retry shortly."
        );
    } else if (aiRouting.providerUsed === "groq" && !aiRouting.fallbackActive) {
        toast.success("Primary AI engine active.");
    }
}

export default function CampaignGenerator() {
    const [audienceSources, setAudienceSources] = useState<AudienceSource[]>(["INVOICE_SYSTEM"]);
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

    // Schedule & batch state
    const [sendMode, setSendMode] = useState<"now" | "scheduled">("now");
    const [scheduledAt, setScheduledAt] = useState("");
    const [batchSize, setBatchSize] = useState(50);
    const [batchDelayMinutes, setBatchDelayMinutes] = useState(5);
    const [showBatchSettings, setShowBatchSettings] = useState(false);
    
    // Client Selection State
    const [targetClients, setTargetClients] = useState<any[]>([]);
    const [loadingTargetClients, setLoadingTargetClients] = useState(false);
    const [showClientPicker, setShowClientPicker] = useState(false);
    const [currentAudienceClientIds, setCurrentAudienceClientIds] = useState<string[]>([]);
    
    // Audience Oversight State
    const [excludedClientIds, setExcludedClientIds] = useState<string[]>([]);
    const [showOversightModal, setShowOversightModal] = useState(false);
    const [googleContactsCount, setGoogleContactsCount] = useState<number | null>(null);

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

    const hasInvoiceSelected = audienceSources.includes("INVOICE_SYSTEM");
    const primarySource = audienceSources[0] || "INVOICE_SYSTEM";

    // Test Email State
    const [testEmail, setTestEmail] = useState("");
    const [isSendingTest, setIsSendingTest] = useState(false);
    const [sessionHydrated, setSessionHydrated] = useState(false);

    // Draft persistence
    const [draftRestored, setDraftRestored] = useState(false);
    const [pendingDraft, setPendingDraft] = useState<{ subject?: string; bodyHtml?: string; updatedAt?: string } | null>(null);
    const [hasEditedSinceLoad, setHasEditedSinceLoad] = useState(false);
    const draftContext = isReviewing && sampleData
        ? `campaigns__sample__${sampleData.clientId || sampleData.id || "auto"}`
        : null;

    // Computed Properties for UI
    const sourceLabel = audienceSources
        .map((id) => audienceSourceOptions.find((s) => s.id === id)?.name)
        .filter(Boolean)
        .join(" + ") || null;

    const activeGuide =
        audienceSources.length > 0 && selectedType
            ? smartContentGuide[primarySource]?.[selectedType]
            : null;

    const isReady = !!(audienceSources.length > 0 && selectedType && topic.trim() && coreMessage.trim() && cta.trim());

    const readinessChecks = [
        { label: "Audience source", done: audienceSources.length > 0 },
        { label: "Objective", done: !!selectedType },
        { label: "Master subject", done: topic.trim().length > 0 },
        { label: "Master body", done: coreMessage.trim().length > 0 },
        { label: "CTA", done: cta.trim().length > 0 },
    ];

    const missingLabels = readinessChecks.filter((item) => !item.done).map((item) => item.label);
    const excludedCurrentAudienceCount = currentAudienceClientIds.filter((id) => excludedClientIds.includes(id)).length;
    const selectedRecipientsCount = Math.max(0, currentAudienceClientIds.length - excludedCurrentAudienceCount);

    const stepStatus = [
        { label: "Source", done: audienceSources.length > 0 },
        { label: "Goal", done: !!selectedType },
        { label: "Audience", done: audienceData.count > 0 },
        { label: "Message", done: topic.trim().length > 0 && coreMessage.trim().length > 0 },
        { label: "Draft", done: isReviewing },
    ];

    const currentStep = Math.min(stepStatus.filter((s) => s.done).length + 1, stepStatus.length);

    const toggleExclusion = (id: string) => {
        setExcludedClientIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

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
                if (!cancelled && draft) {
                    // Auto-restore draft silently for a smarter experience
                    setEditedSubject(draft.subject || "");
                    setEditedBody(sanitizeEmailHtml(draft.bodyHtml || ""));
                    setDraftRestored(true);
                }
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
        const saved = readCampaignSession();
        if (saved) {
            const restoredSources = Array.isArray(saved.audienceSources)
                ? saved.audienceSources.filter((s): s is AudienceSource => ["INVOICE_SYSTEM", "ZOHO_BIGIN", "GMAIL", "GOOGLE_CONTACTS"].includes(s))
                : [];
            if (restoredSources.length > 0) setAudienceSources(restoredSources);
            if (typeof saved.selectedType === "string") setSelectedType(saved.selectedType);
            if (typeof saved.topic === "string") setTopic(saved.topic);
            if (typeof saved.coreMessage === "string") setCoreMessage(saved.coreMessage);
            if (typeof saved.cta === "string") setCta(saved.cta);
            if (Array.isArray(saved.selectedServices)) setSelectedServices(saved.selectedServices);
            if (saved.serviceLogic === "AND" || saved.serviceLogic === "OR") setServiceLogic(saved.serviceLogic);
            if (Array.isArray(saved.excludedClientIds)) setExcludedClientIds(saved.excludedClientIds);
        }
        setSessionHydrated(true);
    }, []);

    useEffect(() => {
        if (!sessionHydrated) return;
        writeCampaignSession({
            audienceSources,
            selectedType,
            topic,
            coreMessage,
            cta,
            selectedServices,
            serviceLogic,
            excludedClientIds,
        });
    }, [sessionHydrated, audienceSources, selectedType, topic, coreMessage, cta, selectedServices, serviceLogic, excludedClientIds]);

    useEffect(() => {
        fetch(apiPath("/clients?source=GOOGLE_CONTACTS&pageSize=1"))
            .then((r) => r.json())
            .then((data) => {
                if (data.success) setGoogleContactsCount(data.data?.sourceStats?.GOOGLE_CONTACTS?.total ?? data.data?.total ?? null);
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        fetch(apiPath("/services"))
            .then(async (res) => {
                const contentType = res.headers.get("content-type") || "";
                if (!res.ok || !contentType.includes("application/json")) {
                    const text = await res.text().catch(() => "");
                    throw new Error(text || `Services request failed (${res.status})`);
                }
                return res.json();
            })
            .then(data => {
                if (data.success) setServices(data.data);
            })
            .catch(console.error);
    }, []);

    useEffect(() => {
        try {
            const raw = localStorage.getItem("campaignStyleMemory");
            if (raw) setStyleMemory(JSON.parse(raw));
        } catch { }
    }, []);

    useEffect(() => {
        if (audienceSources.length === 0 || !selectedType) {
            setAudienceData({ count: 0, industries: [] });
            setCurrentAudienceClientIds([]);
            return;
        }
        setLoadingAudience(true);

        fetch(apiPath("/campaigns/estimate"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                audienceSources,
                type: selectedType,
                serviceFilters: selectedServices,
                serviceLogic,
                excludedClientIds
            })
        })
            .then(async res => {
                const contentType = res.headers.get("content-type");
                if (!res.ok || !contentType?.includes("application/json")) {
                    setAudienceData({ count: 0, industries: [] });
                    return null;
                }
                return res.json();
            })
            .then(data => {
                if (!data) return;
                if (data.success) {
                    setAudienceData({ count: data.data.count, industries: data.data.industries });
                } else {
                    setAudienceData({ count: 0, industries: [] });
                }
            })
            .catch(() => {
                setAudienceData({ count: 0, industries: [] });
            })
            .finally(() => setLoadingAudience(false));
    }, [audienceSources, selectedType, selectedServices, serviceLogic, excludedClientIds]);

    useEffect(() => {
        if (audienceSources.length === 0 || !selectedType) {
            setCurrentAudienceClientIds([]);
            return;
        }

        let cancelled = false;
        fetch(apiPath("/campaigns/target-clients"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                audienceSources,
                type: selectedType,
                serviceFilters: selectedServices,
                serviceLogic,
                includeExclusions: true,
            }),
        })
            .then((res) => res.json())
            .then((data) => {
                if (cancelled) return;
                if (data?.success && Array.isArray(data.data)) {
                    setCurrentAudienceClientIds(data.data.map((c: any) => c.id).filter(Boolean));
                } else {
                    setCurrentAudienceClientIds([]);
                }
            })
            .catch(() => {
                if (!cancelled) setCurrentAudienceClientIds([]);
            });

        return () => {
            cancelled = true;
        };
    }, [audienceSources, selectedType, selectedServices, serviceLogic]);

    useEffect(() => {
        if (selectedType !== "Cross-Sell") {
            setSelectedServices([]);
            setServiceLogic("OR");
        }
    }, [selectedType]);

    useEffect(() => {
        if (!sessionHydrated) return;
        if (audienceSources.length === 0) return;
        setSelectedType((prev) => {
            if (!prev) return recommendedObjectiveBySource[primarySource];
            if (prev === "Cross-Sell" && !hasInvoiceSelected) {
                toast.info("Cross-Sell needs Invoice source. Switched objective.");
                return recommendedObjectiveBySource[primarySource];
            }
            if (prev === "Reactivation" && !hasInvoiceSelected) {
                toast.info("Reactivation is available only with Invoice source. Switched objective.");
                return recommendedObjectiveBySource[primarySource];
            }
            return prev;
        });
        if (!hasInvoiceSelected) {
            setSelectedServices([]);
            setServiceLogic("OR");
        }
        setExcludedClientIds([]);
        setAudienceData({ count: 0, industries: [] });
        setIsReviewing(false);
        setSampleData(null);
        setEditedSubject("");
        setEditedBody("");
    }, [audienceSources, hasInvoiceSelected, primarySource, sessionHydrated]);

    const handleGenerateSample = async (clientId?: string) => {
        if (audienceSources.length === 0 || !selectedType || !topic || !coreMessage) {
            toast.error("Pick a source, objective, subject, and body.");
            return;
        }

        if (audienceData.count === 0) {
            toast.error("No matching clients found for this objective.");
            return;
        }

        setIsGenerating(true);
        if (clientId) {
            setShowClientPicker(false);
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
                    audienceSources,
                    type: selectedType,
                    topic,
                    coreMessage,
                    cta,
                    serviceFilters: selectedServices,
                    serviceLogic: serviceLogic,
                    sampleOnly: true,
                    clientId,
                    excludedClientIds,
                    styleMemory
                }),
            });

            const data = await res.json();

            if (res.ok && data.success && data.data.sample) {
                notifyAiRoutingStatus(data.data?.aiRouting);
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
            toast.error("Could not generate sample draft.");
        } finally {
            setIsGenerating(false);
            setTerminalStep(0);
        }
    };

    const fetchTargetClients = async () => {
        if (audienceSources.length === 0 || !selectedType) {
            toast.error("Select audience source and objective first.");
            return;
        }
        setLoadingTargetClients(true);
        try {
            const res = await fetch(apiPath("/campaigns/target-clients"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    audienceSources,
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
                notifyAiRoutingStatus(data.data?.aiRouting);
                const ranked = Array.isArray(data.data?.ranked) ? data.data.ranked : [];
                setSubjectSuggestions(
                    ranked.length > 0
                        ? ranked.map((r: any) => `${r.subject}`)
                        : (data.data?.suggestions || [])
                );
                setShowSubjectSuggestions(true);
            } else {
                toast.error("Subject optimization failed.");
            }
        } catch (err) {
            toast.error("Request timed out.");
        } finally {
            setIsGeneratingSuggestions(false);
        }
    };

    const [isSavingSingle, setIsSavingSingle] = useState(false);

    const handleGenerateSingleClient = async () => {
        if (!sampleData?.clientId) {
            toast.error("No sample client selected.");
            return;
        }
        if ((editedSubject || "").trim().length < 4) {
            toast.error("Subject is too short.");
            return;
        }
        if ((editedBody || "").replace(/<[^>]*>/g, "").trim().length < 30) {
            toast.error("Email body is too short.");
            return;
        }
        setIsSavingSingle(true);
        try {
            const res = await fetch(apiPath("/campaigns/generate"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    audienceSources,
                    type: selectedType,
                    topic,
                    coreMessage,
                    cta,
                    styleGuide: { subject: editedSubject, body: editedBody },
                    serviceFilters: selectedServices,
                    serviceLogic,
                    excludedClientIds: [],
                    singleClientId: sampleData.clientId,
                }),
            });
            const data = await res.json().catch(() => null);
            if (res.ok && data?.success) {
                notifyAiRoutingStatus(data.data?.aiRouting);
                const jobId = data?.data?.jobId;
                writeCampaignSession({ activeJobId: jobId || null });
                window.location.href = jobId
                    ? `/campaigns/results?jobId=${encodeURIComponent(jobId)}`
                    : "/campaigns/results";
            } else {
                toast.error(data?.error?.message || "Failed to save campaign.");
                setIsSavingSingle(false);
            }
        } catch {
            toast.error("Request failed.");
            setIsSavingSingle(false);
        }
    };

    const handleGenerateAll = async () => {
        const plain = editedBody.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        if (audienceSources.length === 0) {
            toast.error("Select audience source first.");
            return;
        }
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
        } catch { }

        if ((editedSubject || "").trim().length < 8) {
            toast.error("Subject is too short.");
            return;
        }
        if ((editedBody || "").replace(/<[^>]*>/g, "").trim().length < 80) {
            toast.error("Email body is too short.");
            return;
        }

        const finalExcludedIds = Array.from(new Set(excludedClientIds.filter(id => id.length > 0)));

        setIsGenerating(true);
        try {
            setTerminalStep(3);
            await new Promise(r => setTimeout(r, 1000));
            setTerminalStep(4);

            const res = await fetch(apiPath("/campaigns/generate"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    audienceSources,
                    type: selectedType,
                    topic,
                    coreMessage,
                    cta,
                    styleGuide: { subject: editedSubject, body: editedBody },
                    styleMemory: nextStyleMemory,
                    serviceFilters: selectedServices,
                    serviceLogic: serviceLogic,
                    excludedClientIds: finalExcludedIds,
                    sampleClientId: sampleData?.clientId,
                    batchSize,
                    batchDelayMinutes,
                    scheduledAt: sendMode === "scheduled" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
                }),
            });

            const data = await res.json().catch(() => null);
            if (res.ok && data?.success) {
                notifyAiRoutingStatus(data.data?.aiRouting);
                const jobId = data?.data?.jobId;
                writeCampaignSession({ activeJobId: jobId || null });
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
                toast.success("Test email sent.");
                setTestEmail("");
            } else {
                toast.error(data.error?.message || "Test send failed.");
            }
        } catch (err) {
            console.error(err);
            toast.error("Network error.");
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
                notifyAiRoutingStatus(data.data?.aiRouting);
                setEditedBody(sanitizeEmailHtml(normalizeEmailBodyHtml(data.data.refinedText)));
                setHasEditedSinceLoad(true);
                toast.success("Refinement applied.");
            } else {
                toast.error(data.error?.message || "Refinement failed.");
            }
        } catch {
            toast.error("Refinement unavailable.");
        } finally {
            setIsAutoRefining(false);
        }
    };

    if (isGenerating) {
        const labels: Record<number, string> = { 1: "Connecting to Database", 2: "Selecting Target Clients", 3: `Generating Intelligence`, 4: "Finalising Campaign" };
        const descs: Record<number, string> = { 1: "Connecting...", 2: `Filtering ${audienceData.count} ${selectedType} clients...`, 3: `Applying style guide...`, 4: "Campaign ready..." };

        return (
            <div className="w-full pb-20 px-3 sm:px-4 lg:px-6 min-h-[60vh] flex items-center">
                <SmartLoader label={labels[terminalStep] || "Processing"} description={descs[terminalStep] || "Initializing..."} />
            </div>
        );
    }

    if (isReviewing && sampleData) {
        return (
            <div className="w-full pb-20 px-3 sm:px-4 lg:px-6">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <button onClick={() => setIsReviewing(false)} className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors mb-2">
                            <ChevronLeft className="w-3.5 h-3.5" />
                            Back to Config
                        </button>
                        <h2 className="text-xl font-semibold tracking-tight text-slate-900 flex items-center gap-2.5">
                            Refine Your Message
                            <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
                        </h2>
                        <p className="text-sm font-medium text-slate-500 mt-1">
                            Review the AI-generated sample for <span className="text-blue-600 font-bold">{sampleData.clientName || sampleData.email || "Selected Client"}</span>.
                        </p>
                    </div>
                    <div className="hidden md:block">
                        <div className="px-4 py-2 bg-blue-50 border border-blue-100 rounded-lg">
                            <p className="text-xs font-medium text-blue-500 mb-0.5">Audience Size</p>
                            <p className="text-lg font-semibold text-blue-900">{audienceData.count} Total Clients</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-xl border-2 border-slate-200 shadow-xl overflow-hidden ring-4 ring-slate-50">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                    <button onClick={() => setReviewTab("edit")} className={cn("flex items-center gap-2 pb-4 -mb-4 transition-all relative", reviewTab === "edit" ? "text-blue-600" : "text-slate-400 hover:text-slate-600")}>
                                        <PenLine className="w-4 h-4" />
                                        <span className="text-sm font-medium">Edit Draft</span>
                                        {reviewTab === "edit" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-full" />}
                                    </button>
                                    <button onClick={() => setReviewTab("preview")} className={cn("flex items-center gap-2 pb-4 -mb-4 transition-all relative", reviewTab === "preview" ? "text-blue-600" : "text-slate-400 hover:text-slate-600")}>
                                        <Eye className="w-4 h-4" />
                                        <span className="text-sm font-medium">Live Preview</span>
                                        {reviewTab === "preview" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-full" />}
                                    </button>
                                </div>
                            </div>
                            <div className="p-8">
                                {reviewTab === "edit" ? (
                                    <div className="space-y-6">
                                        <div className="space-y-1.5 relative">
                                            <div className="flex items-center justify-between pl-1">
                                                <label className="text-xs font-medium text-slate-500 pl-1">Email Subject Line</label>
                                                <button onClick={handleSuggestSubjects} disabled={isGeneratingSuggestions} className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded transition-all">
                                                    {isGeneratingSuggestions ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-amber-500" />}
                                                    Suggestions
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
                                                        <p className="text-xs font-medium text-slate-400">AI-suggested subjects</p>
                                                        <button onClick={() => setShowSubjectSuggestions(false)} className="text-xs font-medium text-slate-400 hover:text-rose-500">Close</button>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        {subjectSuggestions.map((s, idx) => (
                                                            <button key={idx} onClick={() => { setEditedSubject(s); setShowSubjectSuggestions(false); }} className="w-full text-left p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all text-sm font-semibold text-slate-700 hover:text-blue-700">
                                                                {s}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-1.5 min-h-[600px]">
                                            <label className="text-xs font-medium text-slate-500 pl-1">Email Body</label>
                                            <RichTextEditor content={editedBody} onChange={(v) => { setEditedBody(v); setHasEditedSinceLoad(true); }} placeholder="Begin your draft..." sampleData={sampleData} />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="pb-4 border-b border-slate-100">
                                            <h4 className="text-lg font-bold text-slate-900">{editedSubject}</h4>
                                        </div>
                                        <div className="rounded-xl overflow-hidden border border-slate-100 shadow-inner bg-slate-50 h-[600px]">
                                            <iframe srcDoc={wrapInEmailTemplate("standard", editedBody, sampleData.clientName, { isPreview: true })} className="w-full h-full border-none" title="Email Preview" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0">{(sampleData.clientName || sampleData.email || "C")[0]}</div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-slate-500 tracking-wide">Current Sample</p>
                                    <p className="text-sm font-bold text-slate-900 truncate">{sampleData.clientName || sampleData.email || "Selected Client"}</p>
                                </div>
                                <button onClick={fetchTargetClients} className="ml-auto text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-100 transition-colors">Change</button>
                            </div>

                            <ClientPickerModal isOpen={showClientPicker} onClose={() => setShowClientPicker(false)} clients={targetClients} selectedClientId={sampleData.clientId} onSelect={handleGenerateSample} loading={loadingTargetClients} excludedIds={excludedClientIds} />

                            <div className="pt-6 border-t border-slate-100 space-y-4">
                                <h4 className="text-xs font-semibold text-slate-500 tracking-wide">Send Test Email</h4>
                                <div className="space-y-2">
                                    <input type="email" placeholder="Enter test email..." value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-500 transition-all font-medium" />
                                    <button onClick={handleSendTestEmail} disabled={isSendingTest || !testEmail} className="w-full py-2.5 bg-white border-2 border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:border-blue-500 hover:text-blue-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                        {isSendingTest ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                        Send Test Email
                                    </button>
                                </div>
                            </div>

                            {/* Schedule & Batch Settings */}
                            <div className="pt-4 border-t border-slate-100 space-y-3">
                                <p className="text-xs font-medium text-slate-500">Send Settings</p>

                                {/* Send Now / Schedule toggle */}
                                <div className="flex bg-slate-100 rounded-lg p-1">
                                    <button onClick={() => setSendMode("now")} className={cn("flex-1 py-1.5 text-xs font-medium rounded-md transition-all", sendMode === "now" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>
                                        Send Now
                                    </button>
                                    <button onClick={() => setSendMode("scheduled")} className={cn("flex-1 py-1.5 text-xs font-medium rounded-md transition-all", sendMode === "scheduled" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>
                                        Schedule
                                    </button>
                                </div>

                                {sendMode === "scheduled" && (
                                    <input
                                        type="datetime-local"
                                        value={scheduledAt}
                                        min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                                        onChange={(e) => setScheduledAt(e.target.value)}
                                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-blue-500 transition-all bg-white"
                                    />
                                )}

                                {/* Batch settings toggle */}
                                <button onClick={() => setShowBatchSettings(v => !v)} className="w-full flex items-center justify-between text-xs text-slate-500 hover:text-slate-700 transition-colors py-1">
                                    <span className="font-medium">Batch Settings</span>
                                    <span className="text-slate-400">{showBatchSettings ? "▲" : "▼"} {batchSize}/batch · {batchDelayMinutes}min gap</span>
                                </button>

                                {showBatchSettings && (
                                    <div className="bg-slate-50 rounded-lg p-3 space-y-3 border border-slate-100">
                                        {/* Gmail limit warning */}
                                        <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
                                            <span className="text-amber-500 text-xs mt-0.5">⚠</span>
                                            <p className="text-[10px] text-amber-700 leading-relaxed">Gmail allows ~500 emails/day (free) or 2,000/day (Workspace). Batching prevents blocks.</p>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-medium text-slate-500">Emails per batch</label>
                                            <div className="flex gap-1.5 flex-wrap">
                                                {[10, 25, 50, 100].map(n => (
                                                    <button key={n} onClick={() => setBatchSize(n)} className={cn("px-2.5 py-1 rounded-md text-xs font-medium transition-all", batchSize === n ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-blue-300")}>
                                                        {n}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-medium text-slate-500">Delay between batches</label>
                                            <div className="flex gap-1.5 flex-wrap">
                                                {[1, 5, 10, 15, 30].map(m => (
                                                    <button key={m} onClick={() => setBatchDelayMinutes(m)} className={cn("px-2.5 py-1 rounded-md text-xs font-medium transition-all", batchDelayMinutes === m ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-blue-300")}>
                                                        {m}m
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Estimated time */}
                                        {selectedRecipientsCount > 0 && (
                                            <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                                                {Math.ceil(selectedRecipientsCount / batchSize)} batch{Math.ceil(selectedRecipientsCount / batchSize) !== 1 ? "es" : ""} ·{" "}
                                                ~{Math.ceil((Math.ceil(selectedRecipientsCount / batchSize) - 1) * batchDelayMinutes)} min total
                                                {selectedRecipientsCount > 500 && <span className="text-amber-500 ml-1">· Exceeds 500/day limit</span>}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2.5">
                                <button
                                    onClick={handleGenerateSingleClient}
                                    disabled={isSavingSingle || isGenerating}
                                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-xl text-sm font-semibold hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                                >
                                    {isSavingSingle ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    {isSavingSingle ? "Saving…" : `Send to ${sampleData?.clientName?.split(" ")[0] || "This Client"} Only`}
                                </button>
                                <button
                                    onClick={handleGenerateAll}
                                    disabled={isSavingSingle || isGenerating}
                                    className="w-full bg-slate-900 text-white py-3 px-4 rounded-xl text-sm font-semibold hover:bg-black active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg group disabled:opacity-50"
                                >
                                    {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                                    {sendMode === "scheduled" && !isGenerating ? <Clock className="w-4 h-4" /> : null}
                                    {isGenerating ? "Generating…" : sendMode === "scheduled" ? "Schedule All" : "Generate All"}
                                    {!isGenerating && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                                </button>
                                <p className="text-[11px] text-center text-slate-400">
                                    {sendMode === "scheduled" && scheduledAt
                                        ? `Scheduled for ${new Date(scheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`
                                        : `${selectedRecipientsCount} clients · ${Math.ceil(selectedRecipientsCount / batchSize)} batch${Math.ceil(selectedRecipientsCount / batchSize) !== 1 ? "es" : ""}`
                                    }
                                </p>
                            </div>
                        </div>
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-5 flex gap-4">
                            <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
                            <p className="text-xs font-medium text-amber-900 leading-relaxed"><strong>Pro-tip:</strong> AI will analyze your edits above to calibrate the tone and structure of all other emails.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const toggleService = (serviceName: string) => {
        setSelectedServices(prev => prev.includes(serviceName) ? prev.filter(s => s !== serviceName) : [...prev, serviceName]);
    };

    const toggleAudienceSource = (source: AudienceSource) => {
        setAudienceSources((prev) => {
            if (source === "INVOICE_SYSTEM") {
                if (!prev.includes("INVOICE_SYSTEM")) return ["INVOICE_SYSTEM", ...prev];
                const next = prev.filter((item) => item !== "INVOICE_SYSTEM");
                return next.length > 0 ? next : ["INVOICE_SYSTEM"];
            }
            const hasSource = prev.includes(source);
            if (hasSource) {
                const next = prev.filter((item) => item !== source);
                return next.length > 0 ? next : ["INVOICE_SYSTEM"];
            }
            return [...prev, source];
        });
    };

    return (
        <div className="w-full pb-12 px-3 sm:px-4 lg:px-6">
            <div data-onboarding="new-campaign-btn" className="mb-6 md:mb-8">
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">Campaign Builder</h2>
                <p className="text-sm text-slate-500 mt-1">Choose options and generate your campaign.</p>
                <div className="mt-4 bg-white border border-slate-200 rounded-lg px-4 py-3">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-600">Step {currentStep} of {stepStatus.length}</p>
                        <p className="text-xs text-slate-500">{missingLabels.length > 0 ? `Pending: ${missingLabels.join(", ")}` : "All set"}</p>
                    </div>
                    <div className="mt-2 grid grid-cols-5 gap-2">
                        {stepStatus.map((step) => (
                            <div key={step.label} className={cn("h-1.5 rounded-full", step.done ? "bg-blue-600" : "bg-slate-200")} title={step.label} />
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-stretch lg:items-start">
                <div className="flex-1 space-y-5 md:space-y-6 lg:space-y-8 min-w-0 w-full">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-4 sm:px-5 md:px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="text-sm font-semibold text-slate-900">0. Select Audience Source</h3>
                        </div>
                        <div className="p-4 sm:p-5 md:p-6 flex gap-3">
                            {audienceSourceOptions.map((source) => {
                                const isSelected = audienceSources.includes(source.id);
                                const noteText = source.id === "GOOGLE_CONTACTS"
                                    ? googleContactsCount === null
                                        ? "Contacts with email addresses."
                                        : `${googleContactsCount.toLocaleString()} contact${googleContactsCount !== 1 ? "s" : ""} with emails synced.`
                                    : source.note;
                                return (
                                    <button key={source.id} type="button" onClick={() => toggleAudienceSource(source.id)} className={cn("flex-1 text-left p-3.5 rounded-lg border transition-all", isSelected ? "bg-blue-50/60 border-blue-500 ring-1 ring-blue-500" : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50")}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <SourceIcon id={source.id} className="w-4 h-4 shrink-0" />
                                            <h4 className="text-xs font-semibold text-slate-900 leading-tight flex-1">{source.name}</h4>
                                            {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                                        </div>
                                        <p className="text-[10px] text-slate-500 leading-relaxed">{source.desc}</p>
                                        <p className="text-[10px] font-medium text-blue-500 mt-1.5 leading-snug">{noteText}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-4 sm:px-5 md:px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="text-sm font-semibold text-slate-900">1. Select Goal</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Source = where contacts come from. Goal = how you want to message them.</p>
                        </div>
                        <div className={cn("p-4 sm:p-5 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4", audienceSources.length === 0 && "opacity-50 pointer-events-none select-none")}>
                            {campaignTypes.filter((type) => !(type.id === "Reactivation" && !hasInvoiceSelected)).filter((type) => !(type.id === "Cross-Sell" && !hasInvoiceSelected)).map((type) => (
                                <div key={type.id} onClick={() => setSelectedType(type.id)} className={cn("relative group/card p-5 rounded-lg border cursor-pointer transition-all", selectedType === type.id ? "bg-blue-50/50 border-blue-500 ring-1 ring-blue-500" : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50")}>
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <type.icon className={cn("w-5 h-5", selectedType === type.id ? "text-blue-600" : "text-slate-400")} />
                                            <h4 className="text-sm font-semibold text-slate-900">{type.name}</h4>
                                        </div>
                                        {selectedType === type.id && <CheckCircle2 className="w-5 h-5 text-blue-600" />}
                                    </div>
                                    <p className="text-[11px] text-slate-500 mb-3 leading-relaxed font-medium">{type.desc}</p>
                                    <div className="flex flex-col gap-2 pt-3 border-t border-slate-100">
                                        <div className="flex items-center gap-1.5"><Users className="w-3 h-3 text-slate-400" /><span className="text-[10px] font-medium text-slate-400">{type.target}</span></div>
                                        <div className="flex items-center gap-1.5"><Zap className="w-3 h-3 text-blue-400" /><span className="text-[10px] font-medium text-blue-500">{type.bestFor}</span></div>
                                    </div>
                                    {/* Hover tooltip */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-900 text-white text-[11px] leading-relaxed rounded-xl px-3.5 py-2.5 shadow-xl opacity-0 group-hover/card:opacity-100 pointer-events-none transition-all duration-150 z-50">
                                        {type.tooltip}
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {selectedType === "Cross-Sell" && hasInvoiceSelected && (
                            <div className="px-4 sm:px-5 md:px-6 pb-4 sm:pb-5 md:pb-6 pt-2 border-t border-slate-100">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center"><Sparkles className="w-4 h-4" /></div>
                                            <div><h4 className="text-xs font-semibold text-slate-700">Audience Segmentation</h4><p className="text-[11px] text-slate-400">Pick service users for this campaign</p></div>
                                        </div>
                                        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                                            <button onClick={() => setServiceLogic('OR')} className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-all", serviceLogic === 'OR' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}>Match Any</button>
                                            <button onClick={() => setServiceLogic('AND')} className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-all", serviceLogic === 'AND' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}>Match All</button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                        {services.map(s => (
                                            <div key={s.id} onClick={() => toggleService(s.serviceName)} className={cn("px-3 py-2 rounded-lg border-2 cursor-pointer transition-all flex items-center gap-2", selectedServices.includes(s.serviceName) ? "bg-blue-50 border-blue-500/30 text-blue-700 shadow-sm" : "bg-white border-slate-100 text-slate-500 hover:border-slate-200")}>
                                                <div className={cn("w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-all", selectedServices.includes(s.serviceName) ? "bg-blue-600 border-blue-600" : "border-slate-200")}>
                                                    {selectedServices.includes(s.serviceName) && <CheckSquare className="w-2.5 h-2.5 text-white" />}
                                                </div>
                                                <span className="text-[11px] font-medium truncate">{s.serviceName}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-4 sm:px-5 md:px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="text-sm font-semibold text-slate-900">2. Sample Email</h3>
                        </div>
                        <div className={cn("p-4 sm:p-5 md:p-6 space-y-5 md:space-y-6", audienceSources.length === 0 && "opacity-50 pointer-events-none select-none")}>
                             <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-500 pl-1">Subject Line</label>
                                <input type="text" placeholder={activeGuide?.subject || "e.g. Quick update for {{companyName}}"} value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full bg-white border border-slate-300 rounded-md px-4 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-500 pl-1">Email Body (your sample — AI will adapt this for each client)</label>
                                <RichTextEditor content={coreMessage} onChange={setCoreMessage} placeholder={activeGuide?.body || "Write your sample email here."} sampleData={{ clientName: "Example Corp", contactPerson: "John Smith", industry: "Technology", clientAddedOn: new Date().toISOString() }} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="w-full lg:w-72 xl:w-80 2xl:w-[22rem] flex-shrink-0 self-start lg:sticky lg:top-4 space-y-4">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-4 sm:px-5 md:px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                            <Network className="w-4 h-4 text-blue-600" />
                            <h3 className="text-sm font-semibold text-slate-900">Pre-Flight Check</h3>
                            {isReady && audienceData.count > 0 && (
                                <span className="ml-auto text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">All set</span>
                            )}
                        </div>
                        <div className="p-4 sm:p-5 md:p-6 space-y-4">

                            {/* Step checklist */}
                            <div className="space-y-2">
                                {[
                                    { label: "Audience source selected", done: audienceSources.length > 0, hint: "Pick Invoice, Zoho, or Gmail" },
                                    { label: "Campaign goal chosen", done: !!selectedType, hint: "Select Broadcast, Targeted, etc." },
                                    { label: "Audience loaded", done: audienceData.count > 0, hint: "At least 1 matching client needed" },
                                    { label: "Subject line written", done: topic.trim().length > 3, hint: "Keep it short and specific" },
                                    { label: "Email body written", done: coreMessage.replace(/<[^>]*>/g, "").trim().length > 30, hint: "Write at least a few sentences" },
                                ].map((check) => (
                                    <div key={check.label} className="flex items-start gap-2.5">
                                        <div className={cn(
                                            "mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-all",
                                            check.done ? "bg-emerald-500" : "border-2 border-slate-200"
                                        )}>
                                            {check.done && (
                                                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className={cn("text-xs leading-tight transition-colors", check.done ? "text-slate-700 font-medium" : "text-slate-400")}>
                                                {check.label}
                                            </p>
                                            {!check.done && (
                                                <p className="text-[10px] text-slate-300 mt-0.5">{check.hint}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Divider */}
                            <div className="border-t border-slate-100" />

                            {/* Audience count */}
                            <div>
                                <p className="text-xs font-medium text-slate-500 mb-1">Audience Size</p>
                                <div className="flex items-center justify-between">
                                    <span className="text-2xl font-semibold tracking-tight text-slate-900">
                                        {audienceSources.length === 0 || !selectedType ? "—" : loadingAudience ? <RefreshCw className="w-5 h-5 animate-spin text-slate-300" /> : audienceData.count}
                                    </span>
                                    {audienceSources.length > 0 && selectedType && !loadingAudience && audienceData.count > 0 && (
                                        <button onClick={() => { fetchTargetClients(); setShowOversightModal(true); }} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                                            View/Edit List
                                        </button>
                                    )}
                                </div>
                                {audienceSources.length > 0 && selectedType && !loadingAudience && audienceData.count > 0 && (
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        {selectedRecipientsCount} selected
                                        {excludedClientIds.length > 0 && <span className="text-amber-500"> · {excludedClientIds.length} excluded</span>}
                                    </p>
                                )}
                            </div>

                            {/* Generate button */}
                            <button
                                onClick={() => handleGenerateSample()}
                                disabled={!isReady || isGenerating || audienceData.count === 0}
                                className={cn(
                                    "w-full py-3.5 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2.5 shadow-sm",
                                    isReady && audienceData.count > 0
                                        ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                                        : "bg-slate-100 text-slate-400 cursor-not-allowed"
                                )}
                            >
                                {isGenerating ? (
                                    <><RefreshCcw className="w-4 h-4 animate-spin" /> Generating…</>
                                ) : (
                                    <><Zap className="w-4 h-4" /> Generate Draft</>
                                )}
                            </button>

                            {/* Explain what's missing */}
                            {!isReady && !isGenerating && (
                                <p className="text-[11px] text-slate-400 text-center -mt-1">
                                    Complete {missingLabels.length === 1 ? `"${missingLabels[0]}"` : `${missingLabels.length} steps`} above to unlock
                                </p>
                            )}
                            {isReady && audienceData.count === 0 && !loadingAudience && !isGenerating && (
                                <p className="text-[11px] text-amber-500 text-center -mt-1">
                                    No matching clients found for this selection
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <ClientPickerModal isOpen={showOversightModal} onClose={() => setShowOversightModal(false)} clients={targetClients} loading={loadingTargetClients} mode="oversight" showActivityFilters={hasInvoiceSelected} excludedIds={excludedClientIds} onToggleExclusion={toggleExclusion} onSetExcludedIds={setExcludedClientIds} onSelect={() => {}} />
        </div>
    );
}

