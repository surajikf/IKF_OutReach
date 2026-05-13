"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import { DownloadCloud, FileText, Database, Loader2, RefreshCw, CheckCircle2, Cloud, X, Key, Shield, Mail, User, Plus, EyeOff } from "lucide-react";
import { cn } from "@/lib/shared/utils";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { SmartLoader } from "@/components/layout/SmartLoader";
import { safeImportRequest, type ImportSyncStatus } from "@/lib/import-sync";
import { apiPath, appPath } from "@/lib/app-path";

type GmailSyncFolder = "INBOX" | "SENT" | "LABEL";
type GmailHeader = "from" | "to" | "cc" | "bcc";
type GmailSyncDuration = "7d" | "30d" | "90d" | "6m" | "1y" | "all";

type GmailSyncProfile = {
    syncDuration: GmailSyncDuration;
    sourceFolders: GmailSyncFolder[];
    customLabelsText: string;
    extractHeaders: GmailHeader[];
    excludedDomainsText: string;
    excludedKeywordsText: string;
    persistBlockList: boolean;
    includeAutomatedEmails: boolean;
};
type GmailCleanupMode = "none" | "safe_cleanup";

type GmailSyncInsight = {
    skippedAutomatedTotal: number;
    skippedAutomatedByCategory: Record<string, number>;
    skippedAutomatedSamples: Array<{ email: string; category: string }>;
};

const GMAIL_DURATION_OPTIONS: { value: GmailSyncDuration; label: string; desc: string }[] = [
    { value: "7d",  label: "7 days",   desc: "Last week" },
    { value: "30d", label: "30 days",  desc: "Last month" },
    { value: "90d", label: "90 days",  desc: "Last 3 months" },
    { value: "6m",  label: "6 months", desc: "Last 6 months" },
    { value: "1y",  label: "1 year",   desc: "Last 12 months" },
    { value: "all", label: "All time", desc: "Full mailbox history" },
];

const DEFAULT_GMAIL_SYNC_PROFILE: GmailSyncProfile = {
    syncDuration: "30d",
    sourceFolders: ["INBOX", "SENT"],
    customLabelsText: "",
    extractHeaders: ["from", "to"],
    excludedDomainsText: "noreply.com",
    excludedKeywordsText: "unsubscribe, abuse, spam",
    persistBlockList: true,
    includeAutomatedEmails: false,
};

const GMAIL_PROFILE_STORAGE_KEY = "ikf.gmail.syncProfiles.v1";
const GMAIL_CLEANUP_MODE_STORAGE_KEY = "ikf.gmail.cleanupMode.v1";

export default function ImportIntegrationsPage() {
    const { data: session } = useSession();
    const user = session?.user;
    const supabase = createClient();

    const [invoiceLastSync, setInvoiceLastSync] = useState<string | null>("Never");
    const [invoiceSyncNote, setInvoiceSyncNote] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [zohoLastSync, setZohoLastSync] = useState<string | null>("Never");
    const [zohoClientCount, setZohoClientCount] = useState<number>(0);

    // Gmail State
    const [gmailAccounts, setGmailAccounts] = useState<any[]>([]);
    const [googleContactsConnected, setGoogleContactsConnected] = useState(false);
    const [googleContactsAccountId, setGoogleContactsAccountId] = useState<string | null>(null);
    const [isGmailModalOpen, setIsGmailModalOpen] = useState(false);
    const [gmailLabel, setGmailLabel] = useState("Sales Team");
    const [gmailSyncProfile, setGmailSyncProfile] = useState<GmailSyncProfile>(DEFAULT_GMAIL_SYNC_PROFILE);
    const [gmailSyncInsights, setGmailSyncInsights] = useState<Record<string, GmailSyncInsight>>({});
    const [gmailNeedsReauth, setGmailNeedsReauth] = useState<Record<string, boolean>>({});
    const [googleContactsStatus, setGoogleContactsStatus] = useState<ImportSyncStatus>("idle");
    const [isGmailProfileModalOpen, setIsGmailProfileModalOpen] = useState(false);
    const [activeGmailAccountForProfile, setActiveGmailAccountForProfile] = useState<{ id: string; email: string; name: string } | null>(null);
    const [scopeNarrowedModal, setScopeNarrowedModal] = useState<{ open: boolean; removedFolders: string[]; onDecide: (mode: GmailCleanupMode) => void } | null>(null);
    const [deleteGmailModal, setDeleteGmailModal] = useState<{ id: string; name: string } | null>(null);

    // Zoho Config State
    const [isZohoModalOpen, setIsZohoModalOpen] = useState(false);
    const [zohoConfig, setZohoConfig] = useState<any>({ 
      hasClientId: false, 
      hasClientSecret: false, 
      hasRefreshToken: false, 
      pipelineName: "Sales Pipeline", 
      stageName: "Closed Won", 
      zohoFieldMapping: [], 
      zohoSyncAllToMetadata: false,
      zohoExcludedFields: [],
      zohoStages: []
    });
    const [zohoFormData, setZohoFormData] = useState({ clientId: "", clientSecret: "", pipelineName: "", stageName: "" });
    const [zohoStages, setZohoStages] = useState<string[]>([]);
    const [availableStages, setAvailableStages] = useState<string[]>([
        "Qualification", 
        "Needs Analysis", 
        "Value Proposition", 
        "Identify Decision Makers", 
        "Proposal/Price Quote", 
        "Negotiation/Review", 
        "Closed Won", 
        "Closed Lost"
    ]);
    const [isLoadingStages, setIsLoadingStages] = useState(false);
    const [isSavingZoho, setIsSavingZoho] = useState(false);
    const [zohoFields, setZohoFields] = useState<{ deals: any[], contacts: any[] }>({ 
        deals: [
            { api_name: "Deal_Name", field_label: "Deal Name" },
            { api_name: "Amount", field_label: "Amount" },
            { api_name: "Closing_Date", field_label: "Closing Date" },
            { api_name: "Pipeline", field_label: "Pipeline" },
            { api_name: "Stage", field_label: "Stage" }
        ], 
        contacts: [
            { api_name: "First_Name", field_label: "First Name" },
            { api_name: "Last_Name", field_label: "Last Name" },
            { api_name: "Email", field_label: "Email" },
            { api_name: "Phone", field_label: "Phone" },
            { api_name: "Mobile", field_label: "Mobile" },
            { api_name: "Mailing_Street", field_label: "Mailing Street" },
            { api_name: "Mailing_City", field_label: "Mailing City" },
            { api_name: "Mailing_State", field_label: "Mailing State" },
            { api_name: "Mailing_Zip", field_label: "Mailing Zip" },
            { api_name: "Mailing_Country", field_label: "Mailing Country" }
        ] 
    });
    const [isLoadingFields, setIsLoadingFields] = useState(false);
    const [fieldMapping, setFieldMapping] = useState<any[]>([]);
    const [zohoExclusions, setZohoExclusions] = useState<string[]>([]);
    const [zohoFieldSearch, setZohoFieldSearch] = useState("");
    const [showZohoAdvanced, setShowZohoAdvanced] = useState(false);
    const [globalSettings, setGlobalSettings] = useState<any>(null);
    const [syncStatus, setSyncStatus] = useState<{
        invoice: ImportSyncStatus;
        zoho: ImportSyncStatus;
        gmail: Record<string, ImportSyncStatus>;
    }>({ invoice: "idle", zoho: "idle", gmail: {} });
    const inFlightKeysRef = useRef<Set<string>>(new Set());
    const canInvoice = Boolean(globalSettings?.permissions?.canInvoice);
    const invoiceAccessRequested = Boolean(globalSettings?.permissions?.invoiceAccessRequested);

    const setGmailStatus = (accountId: string, status: ImportSyncStatus) => {
        setSyncStatus((prev) => ({ ...prev, gmail: { ...prev.gmail, [accountId]: status } }));
    };

    const parseCsvText = (value: string) =>
        value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);

    const buildSyncOptionsPayload = (profile: GmailSyncProfile) => {
        const sourceFolders = profile.sourceFolders.length > 0 ? profile.sourceFolders : ["INBOX", "SENT"];
        const extractHeaders = profile.extractHeaders.length > 0 ? profile.extractHeaders : ["from", "to"];
        return {
            syncDuration: profile.syncDuration || "30d",
            sourceFolders,
            customLabels: parseCsvText(profile.customLabelsText),
            extractHeaders,
            excludedDomains: parseCsvText(profile.excludedDomainsText),
            excludedKeywords: parseCsvText(profile.excludedKeywordsText),
            persistBlockList: profile.persistBlockList,
            includeAutomatedEmails: profile.includeAutomatedEmails,
        };
    };

    const sanitizeSyncProfile = (raw: any): GmailSyncProfile | null => {
        if (!raw || typeof raw !== "object") return null;
        const sourceFolders = Array.isArray(raw.sourceFolders)
            ? raw.sourceFolders.filter((v: any) => v === "INBOX" || v === "SENT")
            : ["INBOX", "SENT"];
        const extractHeaders = Array.isArray(raw.extractHeaders)
            ? raw.extractHeaders.filter((v: any) => v === "from" || v === "to" || v === "cc" || v === "bcc")
            : ["from", "to"];

        const validDurations: GmailSyncDuration[] = ["7d", "30d", "90d", "6m", "1y", "all"];
        const syncDuration: GmailSyncDuration = validDurations.includes(raw.syncDuration) ? raw.syncDuration : "30d";

        return {
            syncDuration,
            sourceFolders: sourceFolders.length > 0 ? sourceFolders : ["INBOX", "SENT"],
            customLabelsText: Array.isArray(raw.customLabels) ? raw.customLabels.join(", ") : "",
            extractHeaders: extractHeaders.length > 0 ? extractHeaders : ["from", "to"],
            excludedDomainsText: Array.isArray(raw.excludedDomains) ? raw.excludedDomains.join(", ") : "",
            excludedKeywordsText: Array.isArray(raw.excludedKeywords) ? raw.excludedKeywords.join(", ") : "",
            persistBlockList: raw.persistBlockList === true,
            includeAutomatedEmails: raw.includeAutomatedEmails === true,
        };
    };

    const loadSavedProfileForAccount = (accountKey: string) => {
        try {
            const raw = localStorage.getItem(GMAIL_PROFILE_STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as Record<string, GmailSyncProfile>;
            return parsed[accountKey] || null;
        } catch {
            return null;
        }
    };

    const saveProfileForAccount = (accountKey: string, profile: GmailSyncProfile) => {
        try {
            const raw = localStorage.getItem(GMAIL_PROFILE_STORAGE_KEY);
            const parsed = raw ? (JSON.parse(raw) as Record<string, GmailSyncProfile>) : {};
            parsed[accountKey] = profile;
            localStorage.setItem(GMAIL_PROFILE_STORAGE_KEY, JSON.stringify(parsed));
        } catch {
            // non-fatal
        }
    };

    const getCleanupModeForAccount = (accountKey: string): GmailCleanupMode => {
        try {
            const raw = localStorage.getItem(GMAIL_CLEANUP_MODE_STORAGE_KEY);
            if (!raw) return "none";
            const parsed = JSON.parse(raw) as Record<string, GmailCleanupMode>;
            return parsed[accountKey] || "none";
        } catch {
            return "none";
        }
    };

    const saveCleanupModeForAccount = (accountKey: string, mode: GmailCleanupMode) => {
        try {
            const raw = localStorage.getItem(GMAIL_CLEANUP_MODE_STORAGE_KEY);
            const parsed = raw ? (JSON.parse(raw) as Record<string, GmailCleanupMode>) : {};
            parsed[accountKey] = mode;
            localStorage.setItem(GMAIL_CLEANUP_MODE_STORAGE_KEY, JSON.stringify(parsed));
        } catch {
            // non-fatal
        }
    };

    const clearCleanupModeForAccount = (accountKey: string) => {
        try {
            const raw = localStorage.getItem(GMAIL_CLEANUP_MODE_STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw) as Record<string, GmailCleanupMode>;
            if (!(accountKey in parsed)) return;
            delete parsed[accountKey];
            localStorage.setItem(GMAIL_CLEANUP_MODE_STORAGE_KEY, JSON.stringify(parsed));
        } catch {
            // non-fatal
        }
    };

    const isProfileNarrowed = (prev: GmailSyncProfile, next: GmailSyncProfile) => {
        const prevFolders = new Set(prev.sourceFolders);
        const nextFolders = new Set(next.sourceFolders);
        const removedFolders = Array.from(prevFolders).some((f) => !nextFolders.has(f));
        const prevLabels = new Set(parseCsvText(prev.customLabelsText).map((x) => x.toLowerCase()));
        const nextLabels = new Set(parseCsvText(next.customLabelsText).map((x) => x.toLowerCase()));
        const removedLabels = Array.from(prevLabels).some((l) => !nextLabels.has(l));
        const prevDomains = new Set(parseCsvText(prev.excludedDomainsText).map((x) => x.toLowerCase()));
        const nextDomains = new Set(parseCsvText(next.excludedDomainsText).map((x) => x.toLowerCase()));
        const stricterDomains = Array.from(nextDomains).some((d) => !prevDomains.has(d));
        const prevKeywords = new Set(parseCsvText(prev.excludedKeywordsText).map((x) => x.toLowerCase()));
        const nextKeywords = new Set(parseCsvText(next.excludedKeywordsText).map((x) => x.toLowerCase()));
        const stricterKeywords = Array.from(nextKeywords).some((k) => !prevKeywords.has(k));
        const automatedNowBlocked = prev.includeAutomatedEmails && !next.includeAutomatedEmails;
        return removedFolders || removedLabels || stricterDomains || stricterKeywords || automatedNowBlocked;
    };

    const getEffectiveProfileForAccount = (accountEmail?: string) => {
        if (!accountEmail) return DEFAULT_GMAIL_SYNC_PROFILE;
        return loadSavedProfileForAccount(accountEmail.toLowerCase()) || DEFAULT_GMAIL_SYNC_PROFILE;
    };

    const profileSummary = (profile: GmailSyncProfile) => {
        const activeFolders = profile.sourceFolders.filter(f => f !== "LABEL");
        const folderLabel = activeFolders.includes("INBOX") && activeFolders.includes("SENT")
            ? "INBOX + SENT"
            : activeFolders.includes("INBOX") ? "INBOX" : activeFolders.includes("SENT") ? "SENT" : "INBOX + SENT";
        const headers = profile.extractHeaders.map((h) => h.toUpperCase()).join(", ");
        const domains = parseCsvText(profile.excludedDomainsText).length;
        const keywords = parseCsvText(profile.excludedKeywordsText).length;
        const durationLabel = GMAIL_DURATION_OPTIONS.find(d => d.value === profile.syncDuration)?.label ?? profile.syncDuration;
        return `${durationLabel} | ${folderLabel} | ${headers} | blocks: ${domains} domains, ${keywords} keywords`;
    };

    const fetchGlobalSettings = async () => {
        try {
            const res = await fetch(apiPath("/settings"));
            const result = await res.json();
            if (result.success) {
                const data = result.data;
                setGlobalSettings(data);
                if (data.invoiceStats) {
                    if (data.invoiceStats.lastSyncAt) {
                        setInvoiceLastSync(new Date(data.invoiceStats.lastSyncAt).toLocaleString());
                    }
                    // We can store count in a new state or just use globalSettings
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await fetch(apiPath("/settings/zoho"));
            const result = await res.json();
            if (result.success) {
                const data = result.data;
                setZohoConfig(data);
                setZohoClientCount(data.clientCount || 0);
                if (data.lastSyncAt) {
                    setZohoLastSync(new Date(data.lastSyncAt).toLocaleString());
                } else {
                    setZohoLastSync("Never");
                }
                setZohoFormData(prev => ({
                    ...prev,
                    pipelineName: data.pipelineName,
                    stageName: data.stageName
                }));
                setFieldMapping(data.zohoFieldMapping || []);
                setZohoExclusions(data.zohoExcludedFields || []);
                setZohoStages(data.zohoStages || []);
            }
        } catch (err) {
            console.error(err);
        }
    };
    
    const refreshAvailableStages = async () => {
        setIsLoadingStages(true);
        try {
            const res = await fetch(apiPath("/settings/zoho/stages"));
            const result = await res.json();
            if (result.success) {
                setAvailableStages(result.data.stages || []);
                if (result.data.pipelineName && !zohoFormData.pipelineName) {
                    setZohoFormData(prev => ({ ...prev, pipelineName: result.data.pipelineName }));
                }
            } else {
                const details = result.error?.details?.grantedScopes ? ` [Granted: ${result.error.details.grantedScopes.substring(0, 50)}...]` : "";
                toast.error(`${result.error?.message || "Failed to fetch stages."}${details}`);
            }
        } catch (err) {
            console.error("Failed to fetch stages:", err);
        } finally {
            setIsLoadingStages(false);
        }
    };

    useEffect(() => {
        if (isZohoModalOpen) {
            refreshAvailableStages();
        }
    }, [isZohoModalOpen]);

    const fetchZohoFields = async () => {
        if (!zohoConfig.hasRefreshToken) return;
        setIsLoadingFields(true);
        try {
            const res = await fetch(apiPath("/settings/zoho/fields"));
            const result = await res.json();
            if (result.success) {
                setZohoFields(result.data);
            } else {
                const errorMessage = result.error?.message || "Failed to load Zoho fields.";
                const errorCode = result.error?.code || "";
                const isCredentialDecryptIssue =
                    errorCode === "INTERNAL_ERROR" &&
                    typeof errorMessage === "string" &&
                    errorMessage.toLowerCase().includes("decrypt zoho credentials");

                if (!isCredentialDecryptIssue) {
                    toast.error(errorMessage);
                }
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to load Zoho fields.");
        } finally {
            setIsLoadingFields(false);
        }
    };

    useEffect(() => {
        if (isZohoModalOpen && zohoConfig.hasRefreshToken) {
            fetchZohoFields();
        }
    }, [isZohoModalOpen, zohoConfig.hasRefreshToken]);

    const fetchGmailAccounts = async () => {
        try {
            const res = await fetch(apiPath("/settings/gmail"));
            const result = await res.json();
            if (result.success) {
                const accounts = Array.isArray(result.data)
                    ? result.data
                    : Array.isArray(result.data?.accounts)
                        ? result.data.accounts
                        : [];
                setGmailAccounts(accounts);
                const contactsAccount = accounts.find((a: any) => String(a.lastStatus || "").includes("CONTACTS"));
                setGoogleContactsConnected(!!contactsAccount);
                setGoogleContactsAccountId(contactsAccount?.id || null);
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        setLoading(true);
        Promise.all([fetchSettings(), fetchGmailAccounts(), fetchGlobalSettings()]).finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const params = new URLSearchParams(window.location.search);
        const gmailEmail = params.get("gmail_email");
        const encodedProfile = params.get("gmail_sync_profile");
        if (!gmailEmail || !encodedProfile) return;
        try {
            const parsed = JSON.parse(decodeURIComponent(encodedProfile));
            const profile = sanitizeSyncProfile(parsed);
            if (profile) {
                saveProfileForAccount(gmailEmail.toLowerCase(), profile);
                setGmailSyncProfile(profile);
                toast.success(`Saved sync filters for ${gmailEmail}.`);
            }
        } catch (err) {
            console.error("Failed to restore Gmail sync profile from callback:", err);
        } finally {
            params.delete("gmail_email");
            params.delete("gmail_sync_profile");
            const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
            window.history.replaceState({}, "", nextUrl);
        }
    }, []);

    const handleGmailSync = async (accountId: string, accountName: string, accountEmail?: string) => {
        const lockKey = `gmail:${accountId}`;
        if (inFlightKeysRef.current.has(lockKey)) return;
        inFlightKeysRef.current.add(lockKey);
        setGmailStatus(accountId, "syncing");
        try {
            const savedProfile = accountEmail ? loadSavedProfileForAccount(accountEmail.toLowerCase()) : null;
            const syncOptions = buildSyncOptionsPayload(savedProfile || gmailSyncProfile);
            toast.info(`Syncing ${accountName} with: ${profileSummary(savedProfile || gmailSyncProfile)}`);
            const cleanupMode = accountEmail ? getCleanupModeForAccount(accountEmail.toLowerCase()) : "none";

            // Run sync immediately inline — no job worker required.
            // Timeout scales with duration: longer history = more messages to fetch.
            const durationTimeouts: Record<string, number> = {
                "7d": 30000, "30d": 45000, "90d": 60000,
                "6m": 75000, "1y": 90000, "all": 120000,
            };
            const syncTimeoutMs = durationTimeouts[syncOptions.syncDuration ?? "30d"] ?? 60000;

            const result = await safeImportRequest<{ count: number; conflicts: number; skippedAutomatedTotal?: number; skippedAutomatedByCategory?: Record<string, number>; skippedAutomatedSamples?: string[]; immediate?: boolean }>(
                "/api/import/gmail?immediate=true",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ accountId, options: syncOptions, cleanupMode }),
                },
                { timeoutMs: syncTimeoutMs, retryOnce: false },
            );

            if (accountEmail) {
                clearCleanupModeForAccount(accountEmail.toLowerCase());
            }

            if (!result.ok) {
                const msg = result.message || "";
                const isScopeError = msg.includes("403") || msg.toLowerCase().includes("insufficient") || msg.toLowerCase().includes("scope");
                if (isScopeError) {
                    setGmailNeedsReauth((prev) => ({ ...prev, [accountId]: true }));
                    toast.error("This account needs re-authentication — permissions have changed. Click Re-auth on the account card.");
                } else {
                    toast.error(msg || `Failed to sync from ${accountName}`);
                }
                setGmailStatus(accountId, "error");
                return;
            }

            const data = result.data || {} as any;
            const count = Number(data.count || 0);
            const conflicts = Number(data.conflicts || 0);
            const skippedAutomatedTotal = Number(data.skippedAutomatedTotal || 0);
            const skippedCategories = data.skippedAutomatedByCategory || {};
            const skippedSamples = Array.isArray(data.skippedAutomatedSamples) ? data.skippedAutomatedSamples : [];
            const roleBasedSynced = Number(data.roleBasedCount || 0);
            const genericSynced = count - roleBasedSynced;
            const breakdownNote = ` (${genericSynced} generic · ${roleBasedSynced} role-based)`;

            const message = `Successfully imported ${count} clients from ${accountName} Gmail.${breakdownNote}${conflicts > 0 ? ` Detected ${conflicts} existing record conflicts.` : ""}${skippedAutomatedTotal > 0 ? ` Skipped ${skippedAutomatedTotal} automated/system emails.` : ""}`;
            toast.success(message);
            if (skippedAutomatedTotal > 0) {
                const details = Object.entries(skippedCategories)
                    .map(([key, val]) => `${key}: ${val}`)
                    .join(", ");
                if (details) {
                    toast.info(`Skipped by type -> ${details}`);
                }
            }
            setGmailSyncInsights((prev) => ({
                ...prev,
                [accountId]: {
                    skippedAutomatedTotal,
                    skippedAutomatedByCategory: skippedCategories,
                    skippedAutomatedSamples: skippedSamples,
                },
            }));
            setGmailStatus(accountId, conflicts > 0 ? "warning" : "success");
            if (accountEmail) {
                saveProfileForAccount(accountEmail.toLowerCase(), gmailSyncProfile);
            }
            await fetchGmailAccounts();
        } catch (error: any) {
            const msg = error?.message && !error.message.includes("NetworkError") && !error.message.includes("Failed to fetch")
                ? error.message
                : `Network error during ${accountName} sync. Please check your connection and try again.`;
            toast.error(msg);
            setGmailStatus(accountId, "error");
        } finally {
            inFlightKeysRef.current.delete(lockKey);
        }
    };

    const openProfileModal = (acc: any) => {
        const effective = getEffectiveProfileForAccount(acc.email);
        setActiveGmailAccountForProfile({ id: acc.id, email: acc.email, name: acc.accountName || acc.email });
        setGmailSyncProfile(effective);
        setIsGmailProfileModalOpen(true);
    };

    const saveActiveProfile = () => {
        if (!activeGmailAccountForProfile?.email) {
            setIsGmailProfileModalOpen(false);
            return;
        }
        const accountKey = activeGmailAccountForProfile.email.toLowerCase();
        const previousProfile = getEffectiveProfileForAccount(accountKey);

        if (isProfileNarrowed(previousProfile, gmailSyncProfile)) {
            const prevFolders = previousProfile.sourceFolders.filter(f => f !== "LABEL");
            const nextFolders = gmailSyncProfile.sourceFolders.filter(f => f !== "LABEL");
            const removedFolders = prevFolders.filter(f => !nextFolders.includes(f));

            setScopeNarrowedModal({
                open: true,
                removedFolders,
                onDecide: (mode) => {
                    saveCleanupModeForAccount(accountKey, mode);
                    saveProfileForAccount(accountKey, gmailSyncProfile);
                    toast.success(`Sync filters saved for ${activeGmailAccountForProfile.name}.`);
                    setIsGmailProfileModalOpen(false);
                    setScopeNarrowedModal(null);
                },
            });
        } else {
            clearCleanupModeForAccount(accountKey);
            saveProfileForAccount(accountKey, gmailSyncProfile);
            toast.success(`Sync filters saved for ${activeGmailAccountForProfile.name}.`);
            setIsGmailProfileModalOpen(false);
        }
    };

    const handleAddGmailAccount = () => {
        const label = gmailLabel.trim();
        if (!label) {
            toast.error("Please enter an account label.");
            return;
        }
        const syncProfile = buildSyncOptionsPayload(gmailSyncProfile);
        const url = `${appPath("/api/gmail/connect")}?label=${encodeURIComponent(label)}&intent=both&returnTo=${encodeURIComponent("/import")}&syncProfile=${encodeURIComponent(JSON.stringify(syncProfile))}`;
        window.location.href = url;
    };

    const handleConnectGoogleContacts = () => {
        const url = `${appPath("/api/auth/google-contacts")}?label=${encodeURIComponent("Google Contacts")}&returnTo=${encodeURIComponent("/import")}`;
        window.location.href = url;
    };

    const handleGoogleContactsSync = async () => {
        if (!googleContactsAccountId) {
            toast.error("Connect Google Contacts first.");
            return;
        }
        const lockKey = `gcontacts:${googleContactsAccountId}`;
        if (inFlightKeysRef.current.has(lockKey)) return;
        inFlightKeysRef.current.add(lockKey);
        setGoogleContactsStatus("syncing");
        try {
            const res = await safeImportRequest<{ count: number; conflicts: number }>(apiPath("/import/google-contacts"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ accountId: googleContactsAccountId }),
            });
            if (res.ok && res.data) {
                toast.success(`Synced ${res.data.count} Google Contacts.${res.data.conflicts > 0 ? ` Conflicts: ${res.data.conflicts}.` : ""}`);
                setGoogleContactsStatus(res.data.conflicts > 0 ? "warning" : "success");
                await fetchGmailAccounts();
            } else {
                toast.error(res.message || "Failed to sync Google Contacts.");
                setGoogleContactsStatus("error");
            }
        } catch {
            toast.error("Network error during Google Contacts sync.");
            setGoogleContactsStatus("error");
        } finally {
            inFlightKeysRef.current.delete(lockKey);
        }
    };

    const handleInvoiceSync = async () => {
        if (!canInvoice) {
            if (invoiceAccessRequested) {
                toast.info("Invoice access request already submitted. Waiting for admin approval.");
                return;
            }
            try {
                const res = await fetch(apiPath("/invoice-access/request"), { method: "POST" });
                const result = await res.json();
                if (!res.ok || !result?.success) {
                    throw new Error(result?.error?.message || "Failed to submit request.");
                }
                if (result?.data?.unsupported) {
                    toast.error("Invoice access request tracking is unavailable on this deployment. Contact admin.");
                    return;
                }
                toast.success("Invoice access request submitted to admin.");
                await fetchGlobalSettings();
            } catch (err: any) {
                toast.error(err?.message || "Could not submit invoice access request.");
            }
            return;
        }
        const lockKey = "invoice";
        if (inFlightKeysRef.current.has(lockKey)) return;
        inFlightKeysRef.current.add(lockKey);
        setSyncStatus((prev) => ({ ...prev, invoice: "syncing" }));
        setInvoiceSyncNote(null);
        try {
            const result = await safeImportRequest<any>(
                apiPath("/import/invoice?mode=fast"),
                { method: "POST" },
                // Invoice sync can legitimately take longer due to upstream ERP latency.
                { timeoutMs: 120000, retryOnce: false }
            );
            if (result.ok && result.data) {
                const data = result.data;
                const bg = data?.partial?.backgroundNotActiveScheduled;
                if (bg) {
                    toast.success("Client synchronization started in background.");
                    setInvoiceSyncNote("Active clients updated. Not Active clients are syncing in the background (page is usable).");
                } else {
                    toast.success(`Successfully imported ${data.count || 0} clients from internal invoice system.`);
                }
                setInvoiceLastSync(new Date().toLocaleString());
                setSyncStatus((prev) => ({ ...prev, invoice: bg ? "warning" : "success" }));
            } else {
                toast.error(result.message || "Failed to sync from Invoice System");
                setSyncStatus((prev) => ({ ...prev, invoice: "error" }));
            }
        } catch (error) {
            toast.error("Network error during Invoice Sync.");
            setSyncStatus((prev) => ({ ...prev, invoice: "error" }));
        } finally {
            inFlightKeysRef.current.delete(lockKey);
        }
    };

    const handleZohoAuth = () => {
        const url = appPath("/api/zoho/connect");
        window.location.href = url;
    };

    const handleZohoSync = async () => {
        const lockKey = "zoho";
        if (inFlightKeysRef.current.has(lockKey)) return;
        inFlightKeysRef.current.add(lockKey);
        setSyncStatus((prev) => ({ ...prev, zoho: "syncing" }));
        try {
            const result = await safeImportRequest<{ count: number; fetched: number; conflicts: number; purged?: number }>(apiPath("/import/zoho"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pipelineStage: zohoConfig.stageName })
            });
            if (result.ok && result.data) {
                const data = result.data;
                const message = `Sync complete: Fetched ${data.fetched || 0} deals, imported ${data.count || 0} new clients.${data.conflicts > 0 ? ` (${data.conflicts} conflicts)` : ""}`;
                toast.success(message);
                setZohoLastSync(new Date().toLocaleString());
                setSyncStatus((prev) => ({ ...prev, zoho: data.conflicts > 0 ? "warning" : "success" }));
                await fetchSettings();
            } else {
                toast.error(result.message || "Failed to sync from Zoho Bigin");
                setSyncStatus((prev) => ({ ...prev, zoho: "error" }));
            }
        } catch (error) {
            toast.error("Network error during Zoho Bigin Sync.");
            setSyncStatus((prev) => ({ ...prev, zoho: "error" }));
        } finally {
            inFlightKeysRef.current.delete(lockKey);
        }
    };

    const handleSaveAllZoho = async () => {
        setIsSavingZoho(true);
        try {
            const res = await fetch(apiPath("/settings/zoho"), {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientId: zohoFormData.clientId,
                    clientSecret: zohoFormData.clientSecret,
                    pipelineName: zohoFormData.pipelineName,
                    stageName: zohoFormData.stageName,
                    zohoFieldMapping: fieldMapping,
                    zohoSyncAllToMetadata: zohoConfig.zohoSyncAllToMetadata,
                    zohoExcludedFields: zohoExclusions,
                    zohoStages: zohoStages
                })
            });
            if (res.ok) {
                toast.success("Zoho settings synchronized successfully.");
                setZohoFormData(prev => ({ ...prev, clientId: "", clientSecret: "" }));
                await fetchSettings();
            } else {
                const data = await res.json();
                const errorMessage = data.error?.message || data.message || "Failed to save settings.";
                toast.error(errorMessage);
            }
        } catch (e) {
            toast.error("Network error saving settings.");
        } finally {
            setIsSavingZoho(false);
        }
    };

    if (loading) return <SmartLoader label="Initializing Studio" description="Connecting to data nodes..." />;

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-14 w-full px-3 sm:px-4 lg:px-6">
            <header className="px-2">
                <div className="flex items-center gap-3 text-blue-600 mb-2">
                    <DownloadCloud className="w-5 h-5" />
                    <span className="text-xs font-medium text-slate-500">Data Import</span>
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">Integrations</h2>
                <p className="text-sm text-slate-500 mt-1">Connect external data channels and synchronize your client base.</p>
            </header>

            <div data-onboarding="import-section" className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Invoice System Card */}
                <div className={cn(
                    "group relative bg-white rounded-3xl border border-slate-200 p-6 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-1 overflow-hidden",
                    syncStatus.invoice === "syncing" && "ring-2 ring-blue-500 ring-offset-2"
                )}>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                    
                    <div className="relative">
                        <div className="flex items-start justify-between mb-6">
                            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-6">
                                <FileText className="w-6 h-6 text-blue-600" />
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-medium text-slate-400">Main Source</span>
                                <div className={cn(
                                    "mt-1 px-2 py-0.5 rounded-full text-[9px] font-medium",
                                    !canInvoice ? "bg-slate-100 text-slate-500" :
                                    syncStatus.invoice === "success" ? "bg-emerald-100 text-emerald-600" :
                                    syncStatus.invoice === "error" ? "bg-red-100 text-red-600" :
                                    syncStatus.invoice === "warning" ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-500"
                                )}>
                                    {!canInvoice ? (invoiceAccessRequested ? "Requested" : "Locked") : syncStatus.invoice === "syncing" ? "Syncing..." : syncStatus.invoice === "idle" ? "Ready" : syncStatus.invoice}
                                </div>
                            </div>
                        </div>

                        <div className="mb-8">
                            <h3 className="text-lg font-bold text-slate-900 mb-1">Internal Invoice System</h3>
                            <p className="text-sm text-slate-500 font-medium">
                                {canInvoice
                                    ? "Secondary source for client financial profiles."
                                    : "Restricted. Ask an admin to enable invoice access for your account."}
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="flex items-center gap-2">
                                    <RefreshCw className={cn("w-3.5 h-3.5 text-slate-400", syncStatus.invoice === "syncing" && "animate-spin")} />
                                    <div className="flex flex-col">
                                <span className="text-[10px] font-medium text-slate-500">Last Pulse</span>
                                        <span className="text-[9px] text-blue-600 font-medium mt-0.5">
                                            {canInvoice ? `${globalSettings?.invoiceStats?.count || 0} Clients Synced` : invoiceAccessRequested ? "Request pending admin approval" : "Access required"}
                                        </span>
                                    </div>
                                </div>
                                <span className="text-xs font-semibold text-slate-700">{canInvoice ? invoiceLastSync : "—"}</span>
                            </div>

                            {invoiceSyncNote && (
                                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1 shrink-0 animate-pulse" />
                                    <p className="text-[10px] text-amber-700 font-medium leading-relaxed">{invoiceSyncNote}</p>
                                </div>
                            )}

                            <button 
                                onClick={handleInvoiceSync}
                                disabled={syncStatus.invoice === "syncing"}
                                className={cn(
                                    "w-full h-12 rounded-2xl text-[10px] font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50",
                                    canInvoice
                                        ? "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20"
                                        : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                                )}
                            >
                                {syncStatus.invoice === "syncing" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                {canInvoice ? "Sync Now" : invoiceAccessRequested ? "Requested" : "Request Access"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Zoho Bigin Card */}
                <div data-onboarding="bigin-section" className={cn(
                    "group relative bg-white rounded-3xl border border-slate-200 p-6 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/5 hover:-translate-y-1 overflow-hidden",
                    syncStatus.zoho === "syncing" && "ring-2 ring-orange-500 ring-offset-2"
                )}>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                    
                    <div className="relative">
                        <div className="flex items-start justify-between mb-6">
                            <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-6">
                                <Cloud className="w-6 h-6 text-orange-600" />
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-medium text-slate-400">Pipeline</span>
                                <div className={cn(
                                    "mt-1 px-2 py-0.5 rounded-full text-[9px] font-medium",
                                    syncStatus.zoho === "success" ? "bg-emerald-100 text-emerald-600" : 
                                    syncStatus.zoho === "error" ? "bg-red-100 text-red-600" :
                                    syncStatus.zoho === "warning" ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-500"
                                )}>
                                    {syncStatus.zoho === "syncing" ? "Syncing..." : syncStatus.zoho === "idle" ? "Ready" : syncStatus.zoho}
                                </div>
                            </div>
                        </div>

                        <div className="mb-8">
                            <h3 className="text-lg font-bold text-slate-900 mb-1">Zoho Bigin CRM</h3>
                            <p className="text-sm text-slate-500 font-medium">Primary source for deals and contact pipelines.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="flex items-center gap-2">
                                    <RefreshCw className={cn("w-3.5 h-3.5 text-slate-400", syncStatus.zoho === "syncing" && "animate-spin")} />
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-medium text-slate-500">Last Pulse</span>
                                        <span className="text-[9px] text-orange-600 font-medium mt-0.5">
                                            {zohoClientCount} Clients Synced
                                        </span>
                                    </div>
                                </div>
                                <span className="text-xs font-semibold text-slate-700">{zohoLastSync}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => setIsZohoModalOpen(true)}
                                    className="h-12 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-semibold hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                                >
                                    <Database className="w-4 h-4" />
                                    Config
                                </button>
                                <button 
                                    onClick={handleZohoSync}
                                    disabled={syncStatus.zoho === "syncing" || !zohoConfig.hasRefreshToken}
                                    className="h-12 bg-orange-600 text-white rounded-2xl text-[10px] font-semibold hover:bg-orange-700 transition-all active:scale-[0.98] shadow-lg shadow-orange-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {syncStatus.zoho === "syncing" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                    Sync
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Gmail Connector Card */}
                <div className="group relative bg-white rounded-3xl border border-slate-200 p-6 transition-all duration-300 hover:shadow-xl hover:shadow-red-500/5 hover:-translate-y-1 overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                    
                    <div className="relative">
                        <div className="flex items-start justify-between mb-6">
                            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-6">
                                <Mail className="w-6 h-6 text-red-600" />
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-medium text-slate-400">Email Channel</span>
                                <div className="mt-1 px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[9px] font-medium">
                                    {gmailAccounts.length} Connected
                                </div>
                            </div>
                        </div>

                        <div className="mb-8">
                            <h3 className="text-lg font-bold text-slate-900 mb-1">Gmail Multi-Account</h3>
                            <p className="text-sm text-slate-500 font-medium">Extracting client intent from email channels.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="flex items-center gap-2">
                                    <RefreshCw className={cn("w-3.5 h-3.5 text-slate-400", Object.values(syncStatus.gmail).some(s => s === "syncing") && "animate-spin")} />
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-medium text-slate-500">Last Pulse</span>
                                        <span
                                            className="text-[9px] text-red-600 font-medium mt-0.5"
                                            title={`${globalSettings?.gmailStats?.generic ?? 0} Generic · ${globalSettings?.gmailStats?.roleBased ?? 0} Role-Based`}
                                        >
                                            {`${globalSettings?.gmailStats?.generic ?? globalSettings?.gmailStats?.count ?? 0}/${globalSettings?.gmailStats?.roleBased ?? 0} Clients Synced`}
                                        </span>
                                    </div>
                                </div>
                                <span className="text-xs font-semibold text-slate-700">
                                    {globalSettings?.gmailStats?.lastSyncAt ? new Date(globalSettings.gmailStats.lastSyncAt).toLocaleString() : "Never"}
                                </span>
                            </div>
                            <div className="max-h-[160px] overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                                {gmailAccounts.map((acc: any) => {
                                    const insight = gmailSyncInsights[acc.id];
                                    return (
                                    <div key={acc.id} className="space-y-2">
                                    <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100 group/item hover:bg-white hover:border-red-100/50 transition-all hover:shadow-sm">
                                        {(() => {
                                            const effective = getEffectiveProfileForAccount(acc.email);
                                            return (
                                        <div className="flex flex-col min-w-0 pr-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center border border-red-100">
                                                    <Mail className="w-2.5 h-2.5 text-red-600" />
                                                </div>
                                                <span className="text-[11px] font-bold text-slate-800 truncate">{acc.accountName || 'Unnamed Node'}</span>
                                                <div className={cn(
                                                    "w-1.5 h-1.5 rounded-full shrink-0",
                                                    syncStatus.gmail[acc.id] === "success" ? "bg-emerald-500" :
                                                    syncStatus.gmail[acc.id] === "error" ? "bg-red-500" :
                                                    syncStatus.gmail[acc.id] === "syncing" ? "bg-blue-500 animate-pulse" : "bg-slate-300"
                                                )} />
                                            </div>
                                            <div className="flex flex-col gap-1 ml-7">
                                                <span className="text-[10px] text-slate-900 font-medium lowercase truncate">{acc.email}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] text-slate-400 font-medium">Connected Node</span>
                                                    <div className="w-1 h-1 rounded-full bg-slate-200" />
                                                    <span
                                                        className="text-[9px] text-blue-600 font-medium"
                                                        title={
                                                            acc.generic != null && acc.roleBased != null && (acc.generic > 0 || acc.roleBased > 0)
                                                                ? acc.roleBased > 0
                                                                    ? `${acc.generic} Generic contacts · ${acc.roleBased} Role-Based contacts\n${acc.count || 0} total`
                                                                    : `${acc.generic} contacts (all generic)`
                                                                : undefined
                                                        }
                                                    >
                                                        {`${acc.generic ?? acc.count ?? 0}/${acc.roleBased ?? 0} Clients Synced`}
                                                    </span>
                                                </div>
                                                <span className="text-[9px] text-slate-500 font-medium truncate" title={profileSummary(effective)}>
                                                    {profileSummary(effective)}
                                                </span>
                                            </div>
                                        </div>
                                            );
                                        })()}
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                onClick={() => openProfileModal(acc)}
                                                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[10px] font-semibold text-slate-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all"
                                            >
                                                Edit Filters
                                            </button>
                                            {gmailNeedsReauth[acc.id] ? (
                                                <a
                                                    href={appPath(`/api/auth/google?intent=both&returnTo=/import&label=${encodeURIComponent(acc.accountName || acc.email)}`)}
                                                    className="px-3 py-1.5 rounded-lg border border-orange-300 bg-orange-50 text-[10px] font-semibold text-orange-700 hover:bg-orange-100 transition-all flex items-center gap-1.5"
                                                >
                                                    <RefreshCw className="w-3 h-3" />
                                                    Re-auth
                                                </a>
                                            ) : (
                                            <button
                                                onClick={() => handleGmailSync(acc.id, acc.accountName || acc.email, acc.email)}
                                                disabled={syncStatus.gmail[acc.id] === "syncing"}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-lg border text-[10px] font-semibold transition-all flex items-center gap-1.5",
                                                    syncStatus.gmail[acc.id] === "syncing"
                                                        ? "border-blue-200 bg-blue-50 text-blue-600 cursor-not-allowed"
                                                        : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50"
                                                )}
                                            >
                                                {syncStatus.gmail[acc.id] === "syncing"
                                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                                    : <RefreshCw className="w-3 h-3" />}
                                                {syncStatus.gmail[acc.id] === "syncing" ? "Syncing..." : "Sync Again"}
                                            </button>
                                            )}
                                            <button
                                                onClick={() => setDeleteGmailModal({ id: acc.id, name: acc.accountName || acc.email })}
                                                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition-all"
                                                title="Remove account"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    {insight && insight.skippedAutomatedTotal > 0 && (
                                        <div className="p-3 rounded-xl border border-amber-200 bg-amber-50">
                                            <p className="text-[10px] font-medium text-amber-700">
                                                Skipped Emails ({insight.skippedAutomatedTotal}) for {acc.accountName || acc.email}
                                            </p>
                                            <p className="text-[10px] text-amber-700 mt-1">
                                                {Object.entries(insight.skippedAutomatedByCategory).map(([k, v]) => `${k}: ${v}`).join(", ")}
                                            </p>
                                            <div className="mt-2 max-h-24 overflow-y-auto space-y-1">
                                                {insight.skippedAutomatedSamples.slice(0, 12).map((row, idx) => (
                                                    <div key={`${row.email}-${idx}`} className="text-[10px] text-amber-800 flex items-center justify-between gap-2">
                                                        <span className="truncate">{row.email}</span>
                                                        <span className="uppercase font-bold text-[9px]">{row.category}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    </div>
                                    );
                                })}
                                {gmailAccounts.length === 0 && (
                                    <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                        <p className="text-[10px] text-slate-400 font-medium italic">No accounts linked</p>
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={() => setIsGmailModalOpen(true)}
                                className="w-full h-12 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl text-[10px] font-semibold hover:bg-slate-50 hover:border-red-100 hover:text-red-600 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                            >
                                <Plus className="w-4 h-4" />
                                Connect Account
                            </button>
                        </div>
                    </div>
                </div>

                {/* Google Contacts Card */}
                <div data-onboarding="google-contacts-section" className="group relative bg-white rounded-3xl border border-slate-200 p-6 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/5 hover:-translate-y-1 overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                    <div className="relative">
                        <div className="flex items-start justify-between mb-6">
                            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-6">
                                <User className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-medium text-slate-400">Directory Channel</span>
                                <div className={cn(
                                    "mt-1 px-2 py-0.5 rounded-full text-[9px] font-medium",
                                    googleContactsConnected ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                                )}>
                                    {googleContactsConnected ? "Connected" : "Not Linked"}
                                </div>
                            </div>
                        </div>

                        <div className="mb-8">
                            <h3 className="text-lg font-bold text-slate-900 mb-1">Google Contacts</h3>
                            <p className="text-sm text-slate-500 font-medium">Separate from Gmail. Syncs your Google Contacts list only.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="flex items-center gap-2">
                                    <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-medium text-slate-500">Last Pulse</span>
                                        <span className="text-[9px] text-emerald-600 font-medium mt-0.5">
                                            {googleContactsConnected ? (globalSettings?.googleContactsStats?.count || 0) : 0} Contacts Synced
                                        </span>
                                    </div>
                                </div>
                                <span className="text-xs font-semibold text-slate-700">
                                    {googleContactsConnected && globalSettings?.googleContactsStats?.lastSyncAt
                                        ? new Date(globalSettings.googleContactsStats.lastSyncAt).toLocaleString()
                                        : "Never"}
                                </span>
                            </div>

                            <button
                                onClick={handleConnectGoogleContacts}
                                className="w-full h-12 bg-emerald-600 text-white rounded-2xl text-[10px] font-semibold hover:bg-emerald-700 transition-all active:scale-[0.98] shadow-lg shadow-emerald-600/10 flex items-center justify-center gap-3"
                            >
                                <Plus className="w-4 h-4" />
                                {googleContactsConnected ? "Re-auth Directory" : "Connect Contacts"}
                            </button>
                            
                            {googleContactsConnected && (
                                <button
                                    onClick={handleGoogleContactsSync}
                                    disabled={!googleContactsAccountId || googleContactsStatus === "syncing"}
                                    className="w-full h-10 bg-white border border-emerald-200 text-emerald-700 rounded-xl text-[10px] font-semibold hover:bg-emerald-50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <RefreshCw className={cn("w-3.5 h-3.5", googleContactsStatus === "syncing" && "animate-spin")} />
                                    {googleContactsStatus === "syncing" ? "Syncing..." : "Run Directory Sync"}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Zoho Modal Refactor */}
            {isZohoModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-all" onClick={() => setIsZohoModalOpen(false)} />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="zoho-settings-title"
                        className="bg-white w-full max-w-5xl rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[calc(100vh-1rem)] sm:max-h-[90vh]"
                    >
                        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-start justify-between bg-white shrink-0 gap-3">
                            <div className="flex items-start gap-2.5 min-w-0">
                                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                                    <Cloud className="w-4 h-4 text-orange-600" aria-hidden="true" />
                                </div>
                                <div className="min-w-0">
                                    <h3 id="zoho-settings-title" className="font-semibold text-slate-900 text-lg leading-tight">Zoho Settings</h3>
                                    <p className="text-xs text-slate-500 mt-1">Set up connection, choose stages, and control what gets synced.</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                aria-label="Close Zoho settings dialog"
                                onClick={() => setIsZohoModalOpen(false)}
                                className="text-slate-400 hover:text-slate-900 bg-slate-50 rounded-full p-1.5 transition-colors shrink-0"
                            >
                                <X className="w-4 h-4" aria-hidden="true" />
                            </button>
                        </div>

                        <div className="px-4 sm:px-6 py-4 sm:py-5 overflow-y-auto overscroll-contain space-y-5 flex-1 custom-scrollbar">
                            {/* Section 1: Authorization */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <Shield className="w-3.5 h-3.5 text-slate-400" />
                                    <h4 className="text-sm font-semibold text-slate-700">1. Connect Account</h4>
                                </div>
                                <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 flex flex-col gap-3">
                                    <div className="space-y-1">
                                        <p className="text-sm font-semibold text-orange-900">
                                            {zohoConfig.hasRefreshToken ? "Zoho is connected" : "Zoho authorization required"}
                                        </p>
                                        <p className="text-xs text-orange-800/90 leading-relaxed">
                                            {zohoConfig.hasRefreshToken 
                                                ? "Your account is linked with Zoho Bigin. Re-authorize only if permissions need to be refreshed." 
                                                : "Authorize this app to sync deals and contacts from Zoho Bigin CRM."}
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleZohoAuth}
                                        className="w-full h-11 bg-orange-600 text-white rounded-xl text-sm font-semibold hover:bg-orange-700 transition-all active:scale-[0.98] shadow-md shadow-orange-600/10 flex items-center justify-center gap-2"
                                    >
                                        <Cloud className="w-3.5 h-3.5" />
                                        {zohoConfig.hasRefreshToken ? "Re-Authorize Zoho" : "Connect Zoho"}
                                    </button>
                                </div>
                            </div>

                            {/* Section 2: Targeting */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                                    <h4 className="text-sm font-semibold text-slate-700">2. Choose Pipeline &amp; Stages</h4>
                                </div>
                                <div className="space-y-3">
                                    <label htmlFor="zoho-pipeline-name" className="text-xs font-semibold text-slate-700 block">Pipeline name</label>
                                    <input
                                        id="zoho-pipeline-name"
                                        name="zoho_pipeline_name"
                                        autoComplete="off"
                                        type="text"
                                        value={zohoFormData.pipelineName}
                                        onChange={(e) => setZohoFormData(prev => ({ ...prev, pipelineName: e.target.value }))}
                                        placeholder="Ex: Sales Pipeline"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:bg-white focus:border-orange-500 focus-visible:ring-2 focus-visible:ring-orange-100 transition-all"
                                    />
                                    
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-xs text-slate-600 font-medium">Select stages to sync</p>
                                            <button 
                                                onClick={refreshAvailableStages}
                                                disabled={isLoadingStages}
                                                className="text-xs font-semibold text-orange-600 hover:text-orange-700 disabled:opacity-50 flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-orange-50"
                                            >
                                                <RefreshCw className={`w-3 h-3 ${isLoadingStages ? 'animate-spin' : ''}`} />
                                                Refresh
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 gap-1.5 max-h-[32vh] min-h-[140px] overflow-y-auto p-3 bg-slate-50 rounded-xl border border-slate-200 custom-scrollbar">
                                            {isLoadingStages ? (
                                                <div className="py-8 flex flex-col items-center justify-center gap-2">
                                                    <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                                                    <span className="text-[10px] text-slate-400 animate-pulse">Fetching stages from Zoho...</span>
                                                </div>
                                            ) : (
                                                <div className="space-y-1">
                                                    {availableStages.map(stage => {
                                                        const isChecked = zohoStages.includes(stage);
                                                        return (
                                                            <label key={stage} className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${isChecked ? 'bg-white border-orange-200 shadow-sm' : 'bg-transparent border-transparent hover:bg-slate-100'}`}>
                                                                <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${isChecked ? 'bg-orange-500 border-orange-500' : 'bg-white border-slate-300'}`}>
                                                                    {isChecked && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                                                </div>
                                                                <input 
                                                                    type="checkbox" 
                                                                    className="hidden" 
                                                                    checked={isChecked}
                                                                    onChange={() => {
                                                                        if (isChecked) {
                                                                            setZohoStages(zohoStages.filter(s => s !== stage));
                                                                        } else {
                                                                            setZohoStages([...zohoStages, stage]);
                                                                        }
                                                                    }}
                                                                />
                                                                <span className={`text-xs font-medium ${isChecked ? 'text-slate-900' : 'text-slate-500'}`}>{stage}</span>
                                                            </label>
                                                        );
                                                    })}
                                                    {availableStages.length === 0 && (
                                                        <div className="py-8 text-center">
                                                            <p className="text-xs text-slate-500 italic">No stages found. Check your API credentials.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                                            <span>{zohoStages.length} stages selected</span>
                                            {zohoStages.length === 0 && <span>All stages sync when none are selected</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                                <button
                                    type="button"
                                    onClick={() => setShowZohoAdvanced((prev) => !prev)}
                                    className="w-full flex items-center justify-between text-left rounded-lg px-1 py-1 focus-visible:ring-2 focus-visible:ring-orange-100"
                                >
                                    <span className="text-sm font-semibold text-slate-700">Advanced Settings</span>
                                    <span className="text-xs font-medium text-slate-500">
                                        {showZohoAdvanced ? "Hide" : "Show"}
                                    </span>
                                </button>
                                <p className="mt-1 text-xs text-slate-500">
                                    Field mapping, metadata sync, and excluded fields.
                                </p>
                            </div>

                            {showZohoAdvanced && (
                                <>
                            {/* Section 3: 3. Column mapping & Smart Sync */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <Database className="w-3.5 h-3.5 text-slate-400" />
                                        <h4 className="text-sm font-semibold text-slate-700">3. Column mapping</h4>
                                    </div>
                                            <button 
                                                onClick={() => setFieldMapping([...fieldMapping, { zohoField: "", appField: "metadata" }])}
                                                className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-orange-50"
                                            >
                                                <Plus className="w-3 h-3" /> Add mapping
                                            </button>
                                </div>

                                <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                                    {fieldMapping.length === 0 && (
                                        <p className="text-xs text-slate-500 italic py-2">No custom mapping added. Default fields will be used.</p>
                                    )}
                                    {fieldMapping.map((mapping, idx) => (
                                        <div key={idx} className="flex gap-1.5 items-center">
                                            <select
                                                value={mapping.zohoField}
                                                onChange={(e) => {
                                                    const newMapping = [...fieldMapping];
                                                    newMapping[idx].zohoField = e.target.value;
                                                    setFieldMapping(newMapping);
                                                }}
                                                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-orange-500"
                                            >
                                                <option value="">Select Field</option>
                                                <optgroup label="Deal">
                                                    {zohoFields.deals.map(f => <option key={f.api_name} value={`deal.${f.api_name}`}>{f.field_label}</option>)}
                                                </optgroup>
                                                <optgroup label="Contact">
                                                    {zohoFields.contacts.map(f => <option key={f.api_name} value={`contact.${f.api_name}`}>{f.field_label}</option>)}
                                                </optgroup>
                                            </select>
                                            <X className="w-2.5 h-2.5 text-slate-300 pointer-events-none" />
                                            <select
                                                value={mapping.appField}
                                                onChange={(e) => {
                                                    const newMapping = [...fieldMapping];
                                                    newMapping[idx].appField = e.target.value;
                                                    setFieldMapping(newMapping);
                                                }}
                                                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-orange-500"
                                            >
                                                <option value="metadata">Metadata</option>
                                                <option value="industry">Industry</option>
                                                <option value="address">Address</option>
                                                <option value="phone">Phone</option>
                                                <option value="mobile">Mobile</option>
                                                <option value="gstin">GSTIN</option>
                                            </select>
                                            <button onClick={() => setFieldMapping(fieldMapping.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                                        </div>
                                    ))}
                                </div>

                                {/* Smart Sync Toggle */}
                                {zohoConfig.hasRefreshToken && (
                                    <div className="pt-2">
                                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                            <div className="space-y-0.5">
                                                <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                                                    <DownloadCloud className="w-3.5 h-3.5 text-orange-600" /> Advanced sync
                                                </p>
                                                <p className="text-xs text-slate-500 leading-tight">Store extra Zoho fields into metadata automatically.</p>
                                            </div>
                                            <button 
                                                onClick={() => setZohoConfig({ ...zohoConfig, zohoSyncAllToMetadata: !zohoConfig.zohoSyncAllToMetadata })}
                                                className={cn(
                                                    "w-9 h-5 rounded-full transition-all duration-300 relative border",
                                                    zohoConfig.zohoSyncAllToMetadata ? "bg-orange-600 border-orange-700" : "bg-slate-200 border-slate-300"
                                                )}
                                            >
                                                <div className={cn(
                                                    "absolute top-1 w-2.5 h-2.5 bg-white rounded-full transition-all duration-300",
                                                    zohoConfig.zohoSyncAllToMetadata ? "right-1" : "left-1"
                                                )} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Section 4: Desync Control */}
                            {zohoConfig.zohoSyncAllToMetadata && (
                                <div className="space-y-4 pt-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Shield className="w-3.5 h-3.5 text-slate-400" />
                                            <h4 className="text-sm font-semibold text-slate-700">4. Excluded fields</h4>
                                        </div>
                                        <input 
                                            type="text" 
                                            placeholder="Filter fields…"
                                            value={zohoFieldSearch}
                                            onChange={(e) => setZohoFieldSearch(e.target.value)}
                                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs w-32 outline-none focus:border-orange-500 focus-visible:ring-2 focus-visible:ring-orange-100 transition-all"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 gap-1.5 max-h-[180px] overflow-y-auto pr-1 mt-2 custom-scrollbar">
                                        {(() => {
                                            const allFields = [
                                                ...zohoFields.deals.map(f => ({ ...f, module: 'deal', id: `deal.${f.api_name}` })),
                                                ...zohoFields.contacts.map(f => ({ ...f, module: 'contact', id: `contact.${f.api_name}` }))
                                            ].filter(f => 
                                                !fieldMapping.some((m: any) => m.zohoField === f.id) &&
                                                (f.field_label.toLowerCase().includes(zohoFieldSearch.toLowerCase()) || f.api_name.toLowerCase().includes(zohoFieldSearch.toLowerCase()))
                                            );

                                            if (allFields.length === 0) return <p className="text-xs text-slate-500 italic text-center py-4">No fields available for filtering.</p>;

                                            return allFields.map(field => {
                                                const isExcluded = zohoExclusions.includes(field.id);
                                                return (
                                                    <div key={field.id} className={cn(
                                                        "flex items-center justify-between px-3 py-2 rounded-xl border transition-all duration-200 group",
                                                        isExcluded ? "bg-slate-50 border-slate-100 opacity-60 grayscale-[0.5]" : "bg-white border-slate-100 shadow-sm hover:border-orange-200"
                                                    )}>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-semibold text-slate-700">{field.field_label}</span>
                                                            <span className="text-[9px] text-slate-400 font-medium opacity-70 group-hover:text-orange-500 transition-colors">{field.module}.{field.api_name}</span>
                                                        </div>
                                                        <button 
                                                            onClick={() => {
                                                                const newExclusions = isExcluded 
                                                                    ? zohoExclusions.filter(id => id !== field.id)
                                                                    : [...zohoExclusions, field.id];
                                                                setZohoExclusions(newExclusions);
                                                            }}
                                                            className={cn(
                                                                "h-6 px-2.5 rounded-lg text-[9px] font-semibold transition-all duration-300 border flex items-center justify-center min-w-[64px]",
                                                                isExcluded ? "bg-slate-100 text-slate-500 border-slate-200" : "bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-600 hover:text-white hover:border-orange-600"
                                                            )}
                                                        >
                                                            {isExcluded ? "Desynced" : "Keep"}
                                                        </button>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            )}
                                </>
                            )}
                        </div>

                        {/* Unified Action Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50/80 backdrop-blur-sm shrink-0 flex flex-col gap-2">
                            <button
                                onClick={handleSaveAllZoho}
                                disabled={isSavingZoho || ((user as any)?.role !== "ADMIN")}
                                className="w-full h-11 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-all active:scale-[0.98] shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isSavingZoho ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                                Save Settings
                            </button>

                            {(zohoConfig.hasClientId || zohoFormData.clientId) && (
                                <button
                                    onClick={() => { window.location.href = appPath("/api/auth/zoho"); }}
                                    className="w-full h-10 bg-white border border-slate-200 hover:border-orange-300 hover:bg-orange-50 text-slate-700 hover:text-orange-700 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
                                >
                                    <Key className="w-3.5 h-3.5" />
                                    {zohoConfig.hasRefreshToken ? "Reconnect Zoho" : "Connect Zoho account"}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Gmail Connection Modal */}
            {isGmailModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsGmailModalOpen(false)} />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="gmail-connect-title"
                        className="bg-white w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh] rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col"
                    >
                        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
                            <div className="flex items-start gap-2.5 min-w-0">
                                <Mail className="w-5 h-5 text-red-600 mt-0.5 shrink-0" aria-hidden="true" />
                                <div className="min-w-0">
                                    <h3 id="gmail-connect-title" className="font-bold text-slate-900 text-lg leading-tight">Connect Gmail</h3>
                                    <p className="text-xs text-slate-500 mt-1">Choose what to sync now. You can edit these filters later.</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                aria-label="Close Gmail connect dialog"
                                onClick={() => setIsGmailModalOpen(false)}
                                className="text-slate-400 hover:text-slate-900 bg-slate-50 rounded-full p-1.5 transition-colors shrink-0"
                            >
                                <X className="w-4 h-4" aria-hidden="true" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 sm:py-5 space-y-4">
                            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                                <label htmlFor="gmail-label-input" className="text-xs font-semibold text-slate-700 block mb-2">Account Label</label>
                                <input
                                    id="gmail-label-input"
                                    name="gmail_label"
                                    autoComplete="off"
                                    type="text"
                                    value={gmailLabel}
                                    onChange={(e) => setGmailLabel(e.target.value)}
                                    placeholder="Ex: Sales Team, Support"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:bg-white focus:border-red-500 focus-visible:ring-2 focus-visible:ring-red-100 transition-all font-medium"
                                />
                                <p className="mt-2 text-xs text-slate-500">This name helps you identify the connected mailbox later.</p>
                            </div>

                            <div className="space-y-4 border border-slate-100 rounded-2xl p-4 sm:p-5 bg-slate-50/50">
                                    <p className="text-sm font-bold text-slate-800">Contact Sync Options</p>

                                    <div>
                                        <p className="text-xs font-semibold text-slate-700 mb-2">1. How far back to sync</p>
                                        <div className="flex flex-wrap gap-2">
                                            {GMAIL_DURATION_OPTIONS.map((opt) => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    title={opt.desc}
                                                    onClick={() => setGmailSyncProfile((prev) => ({ ...prev, syncDuration: opt.value }))}
                                                    className={cn(
                                                        "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all focus-visible:ring-2 focus-visible:ring-blue-100",
                                                        gmailSyncProfile.syncDuration === opt.value
                                                            ? "bg-slate-900 text-white border-slate-900"
                                                            : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                                                    )}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="mt-1.5 text-xs text-slate-500">
                                            {GMAIL_DURATION_OPTIONS.find(d => d.value === gmailSyncProfile.syncDuration)?.desc} · contacts from emails in this window will be imported
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs font-semibold text-slate-700 mb-2">2. Sync from</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                            {([
                                                { id: "inbox", label: "Inbox", folders: ["INBOX"] as GmailSyncFolder[], desc: "Sync emails received" },
                                                { id: "sent", label: "Sent", folders: ["SENT"] as GmailSyncFolder[], desc: "Sync emails you sent" },
                                                { id: "both", label: "Both", folders: ["INBOX", "SENT"] as GmailSyncFolder[], desc: "Sync inbox & sent" },
                                            ]).map((opt) => {
                                                const isActive = opt.folders.length === gmailSyncProfile.sourceFolders.filter(f => f !== "LABEL").length &&
                                                    opt.folders.every(f => gmailSyncProfile.sourceFolders.includes(f));
                                                return (
                                                    <button
                                                        key={opt.id}
                                                        type="button"
                                                        onClick={() => setGmailSyncProfile((prev) => ({ ...prev, sourceFolders: opt.folders }))}
                                                        className={cn(
                                                            "text-left p-3 rounded-xl border transition-all focus-visible:ring-2 focus-visible:ring-blue-100",
                                                            isActive ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-200"
                                                        )}
                                                    >
                                                        <p className="text-sm font-semibold text-slate-900">{opt.label}</p>
                                                        <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <p className="mt-2 text-xs text-slate-500">Spam &amp; junk are excluded automatically.</p>
                                    </div>

                                    <div>
                                        <p className="text-xs font-semibold text-slate-700 mb-2">3. Extract from</p>
                                        <div className="flex flex-wrap gap-2">
                                            {(["from", "to", "cc", "bcc"] as GmailHeader[]).map((header) => (
                                                <button
                                                    key={header}
                                                    type="button"
                                                    onClick={() =>
                                                        setGmailSyncProfile((prev) => ({
                                                            ...prev,
                                                            extractHeaders: prev.extractHeaders.includes(header)
                                                                ? prev.extractHeaders.filter((h) => h !== header)
                                                                : [...prev.extractHeaders, header],
                                                        }))
                                                    }
                                                    className={cn(
                                                        "px-3 py-1.5 rounded-lg text-xs font-semibold border uppercase focus-visible:ring-2 focus-visible:ring-blue-100",
                                                        gmailSyncProfile.extractHeaders.includes(header)
                                                            ? "bg-blue-50 text-blue-700 border-blue-200"
                                                            : "bg-white text-slate-500 border-slate-200"
                                                    )}
                                                >
                                                    {header}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label htmlFor="gmail-block-domains" className="text-xs font-semibold text-slate-700 block mb-2">Block domains</label>
                                            <input
                                                id="gmail-block-domains"
                                                name="gmail_block_domains"
                                                autoComplete="off"
                                                type="text"
                                                value={gmailSyncProfile.excludedDomainsText}
                                                onChange={(e) => setGmailSyncProfile((prev) => ({ ...prev, excludedDomainsText: e.target.value }))}
                                                placeholder="Ex: noreply.com, spam.com"
                                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100"
                                            />
                                            <p className="mt-1 text-xs text-slate-500">Skip contacts when the email domain matches.</p>
                                        </div>
                                        <div>
                                            <label htmlFor="gmail-block-keywords" className="text-xs font-semibold text-slate-700 block mb-2">Block keywords</label>
                                            <input
                                                id="gmail-block-keywords"
                                                name="gmail_block_keywords"
                                                autoComplete="off"
                                                type="text"
                                                value={gmailSyncProfile.excludedKeywordsText}
                                                onChange={(e) => setGmailSyncProfile((prev) => ({ ...prev, excludedKeywordsText: e.target.value }))}
                                                placeholder="Ex: unsubscribe, alert, invoice"
                                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100"
                                            />
                                            <p className="mt-1 text-xs text-slate-500">Skip contacts when these words appear in sender, subject, or snippet.</p>
                                        </div>
                                    </div>

                                    <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={gmailSyncProfile.persistBlockList}
                                            onChange={(e) => setGmailSyncProfile((prev) => ({ ...prev, persistBlockList: e.target.checked }))}
                                            className="rounded border-slate-300"
                                        />
                                        Keep blocked domains active after future syncs
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={gmailSyncProfile.includeAutomatedEmails}
                                            onChange={(e) => setGmailSyncProfile((prev) => ({ ...prev, includeAutomatedEmails: e.target.checked }))}
                                            className="rounded border-slate-300"
                                        />
                                        Include newsletter/alert/transaction emails in normal sync
                                    </label>
                                </div>
                        </div>

                        <div className="border-t border-slate-100 px-4 sm:px-6 py-4 space-y-3 bg-white">
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                                <p className="text-[10px] text-blue-700 font-medium">
                                    Both send &amp; read permissions will be requested to enable outreach and contact sync.
                                </p>
                            </div>
                            <button 
                                onClick={handleAddGmailAccount}
                                className="w-full h-11 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-all active:scale-[0.98] shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <User className="w-4 h-4" />
                                Continue with Google
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {isGmailProfileModalOpen && activeGmailAccountForProfile && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsGmailProfileModalOpen(false)} />
                    <div className="bg-white w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh] rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xl relative overflow-hidden flex flex-col">
                        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-bold text-slate-900">Edit Sync Filters</h3>
                            <button
                                type="button"
                                aria-label="Close sync filters dialog"
                                onClick={() => setIsGmailProfileModalOpen(false)}
                                className="text-slate-400 hover:text-slate-900 bg-slate-50 rounded-full p-1.5 transition-colors"
                            >
                                <X className="w-4 h-4" aria-hidden="true" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 sm:py-5 space-y-4">
                            <p className="text-[11px] text-slate-600 font-medium">{activeGmailAccountForProfile.name} ({activeGmailAccountForProfile.email})</p>
                            <div className="space-y-3 border border-slate-100 rounded-2xl p-4 sm:p-5 bg-slate-50/50">
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-2">How far back to sync</label>
                                    <div className="flex flex-wrap gap-2">
                                        {GMAIL_DURATION_OPTIONS.map((opt) => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                title={opt.desc}
                                                onClick={() => setGmailSyncProfile((prev) => ({ ...prev, syncDuration: opt.value }))}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all focus-visible:ring-2 focus-visible:ring-blue-100",
                                                    gmailSyncProfile.syncDuration === opt.value
                                                        ? "bg-slate-900 text-white border-slate-900"
                                                        : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                                                )}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="mt-1.5 text-[10px] text-slate-400">
                                        {GMAIL_DURATION_OPTIONS.find(d => d.value === gmailSyncProfile.syncDuration)?.desc} · contacts are extracted from emails in this window
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-2">Sync from</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        {([
                                            { id: "inbox", label: "Inbox", folders: ["INBOX"] as GmailSyncFolder[], desc: "Received emails" },
                                            { id: "sent", label: "Sent", folders: ["SENT"] as GmailSyncFolder[], desc: "Sent emails" },
                                            { id: "both", label: "Both", folders: ["INBOX", "SENT"] as GmailSyncFolder[], desc: "Inbox & sent" },
                                        ]).map((opt) => {
                                            const isActive = opt.folders.length === gmailSyncProfile.sourceFolders.filter(f => f !== "LABEL").length &&
                                                opt.folders.every(f => gmailSyncProfile.sourceFolders.includes(f));
                                            return (
                                                <button
                                                    key={opt.id}
                                                type="button"
                                                onClick={() => setGmailSyncProfile((prev) => ({ ...prev, sourceFolders: opt.folders }))}
                                                className={cn(
                                                    "text-left p-3 rounded-xl border transition-all focus-visible:ring-2 focus-visible:ring-blue-100",
                                                    isActive ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-200"
                                                )}
                                            >
                                                    <p className="text-[11px] font-bold text-slate-900">{opt.label}</p>
                                                    <p className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="mt-2 text-[10px] text-slate-400">Spam &amp; junk are always excluded automatically.</p>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-2">Extract from</label>
                                    <div className="flex flex-wrap gap-2">
                                        {(["from", "to", "cc", "bcc"] as GmailHeader[]).map((header) => (
                                            <button
                                                key={header}
                                                type="button"
                                                onClick={() =>
                                                    setGmailSyncProfile((prev) => ({
                                                        ...prev,
                                                        extractHeaders: prev.extractHeaders.includes(header)
                                                            ? prev.extractHeaders.filter((h) => h !== header)
                                                            : [...prev.extractHeaders, header],
                                                    }))
                                                }
                                                className={cn(
                                                    "px-3 py-1.5 rounded-lg text-xs font-semibold border uppercase focus-visible:ring-2 focus-visible:ring-blue-100",
                                                    gmailSyncProfile.extractHeaders.includes(header)
                                                        ? "bg-blue-50 text-blue-700 border-blue-200"
                                                        : "bg-white text-slate-500 border-slate-200"
                                                )}
                                            >
                                                {header}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-2">Block domains</label>
                                        <input
                                            type="text"
                                            value={gmailSyncProfile.excludedDomainsText}
                                            onChange={(e) => setGmailSyncProfile((prev) => ({ ...prev, excludedDomainsText: e.target.value }))}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100"
                                        />
                                        <p className="mt-1 text-[10px] text-slate-500">Skips contacts whose email domain matches these entries.</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-2">Block keywords</label>
                                        <input
                                            type="text"
                                            value={gmailSyncProfile.excludedKeywordsText}
                                            onChange={(e) => setGmailSyncProfile((prev) => ({ ...prev, excludedKeywordsText: e.target.value }))}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100"
                                        />
                                        <p className="mt-1 text-[10px] text-slate-500">Skips contacts when keywords appear in sender details, subject, or snippet.</p>
                                    </div>
                                </div>
                                <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={gmailSyncProfile.persistBlockList}
                                        onChange={(e) => setGmailSyncProfile((prev) => ({ ...prev, persistBlockList: e.target.checked }))}
                                        className="rounded border-slate-300"
                                    />
                                    Keep blocked domains active after future syncs
                                </label>
                                <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={gmailSyncProfile.includeAutomatedEmails}
                                        onChange={(e) => setGmailSyncProfile((prev) => ({ ...prev, includeAutomatedEmails: e.target.checked }))}
                                        className="rounded border-slate-300"
                                    />
                                    Include newsletter/alert/transaction emails in normal sync
                                </label>
                            </div>
                            <button onClick={saveActiveProfile} className="w-full h-11 bg-slate-900 text-white rounded-2xl text-sm font-semibold hover:bg-slate-800 transition-colors">
                                Save Filters
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Gmail Account Modal */}
            {deleteGmailModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setDeleteGmailModal(null)} />
                    <div className="bg-white w-full max-w-sm rounded-3xl border border-slate-200 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 space-y-5">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-red-50 border border-red-200 flex items-center justify-center shrink-0 mt-0.5">
                                    <Mail className="w-5 h-5 text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900">Remove Gmail Account?</h3>
                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                        <span className="font-semibold text-slate-700">{deleteGmailModal.name}</span> will be disconnected. Previously synced contacts are not deleted.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setDeleteGmailModal(null)}
                                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const { id, name } = deleteGmailModal;
                                        setDeleteGmailModal(null);
                                        const res = await fetch(apiPath(`/settings/gmail?id=${id}`), { method: "DELETE" });
                                        if ((await res.json()).success) {
                                            toast.success(`"${name}" removed.`);
                                            fetchGmailAccounts();
                                        } else {
                                            toast.error("Failed to remove account.");
                                        }
                                    }}
                                    className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-all shadow-sm"
                                >
                                    Remove Account
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Scope Narrowed Confirmation Modal */}
            {scopeNarrowedModal?.open && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
                    <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 space-y-5">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 mt-0.5">
                                    <Shield className="w-5 h-5 text-amber-500" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900">Sync Scope Narrowed</h3>
                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                        You removed{" "}
                                        <span className="font-semibold text-slate-700">
                                            {scopeNarrowedModal.removedFolders.map(f => f.charAt(0) + f.slice(1).toLowerCase()).join(" & ")}
                                        </span>{" "}
                                        from the sync scope. What should happen to contacts that were synced from{" "}
                                        {scopeNarrowedModal.removedFolders.length > 1 ? "those folders" : "that folder"}?
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <button
                                    type="button"
                                    onClick={() => scopeNarrowedModal.onDecide("none")}
                                    className="w-full text-left p-4 rounded-2xl border border-slate-200 hover:border-slate-300 bg-white transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 group-hover:bg-slate-100 transition-all">
                                            <Database className="w-4 h-4 text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-900">Keep all existing contacts</p>
                                            <p className="text-[10px] text-slate-500 mt-0.5">Nothing changes. Previously synced contacts stay as-is.</p>
                                        </div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => scopeNarrowedModal.onDecide("safe_cleanup")}
                                    className="w-full text-left p-4 rounded-2xl border border-amber-200 hover:border-amber-300 bg-amber-50/50 transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-all">
                                            <EyeOff className="w-4 h-4 text-amber-500" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-900">Hide out-of-scope contacts</p>
                                            <p className="text-[10px] text-slate-500 mt-0.5">Contacts from removed folders will be marked inactive on the next sync. Reversible.</p>
                                        </div>
                                    </div>
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={() => setScopeNarrowedModal(null)}
                                className="w-full py-2.5 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                Cancel — go back to editing
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
