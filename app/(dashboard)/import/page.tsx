"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import { DownloadCloud, FileText, Database, Loader2, RefreshCw, CheckCircle2, Cloud, X, Key, Shield, Mail, User, Plus } from "lucide-react";
import { cn } from "@/lib/shared/utils";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { SmartLoader } from "@/components/layout/SmartLoader";
import { safeImportRequest, type ImportSyncStatus } from "@/lib/import-sync";
import { apiPath, appPath } from "@/lib/app-path";

type GmailConnectIntent = "send" | "sync" | "both";
type GmailSyncFolder = "INBOX" | "SENT" | "LABEL";
type GmailHeader = "from" | "to" | "cc" | "bcc";
type GmailSyncProfile = {
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

const DEFAULT_GMAIL_SYNC_PROFILE: GmailSyncProfile = {
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
    const [gmailIntent, setGmailIntent] = useState<GmailConnectIntent>("both");
    const [gmailSyncProfile, setGmailSyncProfile] = useState<GmailSyncProfile>(DEFAULT_GMAIL_SYNC_PROFILE);
    const [gmailSyncInsights, setGmailSyncInsights] = useState<Record<string, GmailSyncInsight>>({});
    const [isGmailProfileModalOpen, setIsGmailProfileModalOpen] = useState(false);
    const [activeGmailAccountForProfile, setActiveGmailAccountForProfile] = useState<{ id: string; email: string; name: string } | null>(null);

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
            ? raw.sourceFolders.filter((v: any) => v === "INBOX" || v === "SENT" || v === "LABEL")
            : ["INBOX", "SENT"];
        const extractHeaders = Array.isArray(raw.extractHeaders)
            ? raw.extractHeaders.filter((v: any) => v === "from" || v === "to" || v === "cc" || v === "bcc")
            : ["from", "to"];

        return {
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
        const folders = profile.sourceFolders.join(" + ");
        const headers = profile.extractHeaders.map((h) => h.toUpperCase()).join(", ");
        const domains = parseCsvText(profile.excludedDomainsText).length;
        const keywords = parseCsvText(profile.excludedKeywordsText).length;
        return `${folders} | ${headers} | blocks: ${domains} domains, ${keywords} keywords`;
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
            const result = await safeImportRequest<{ jobId: string }>("/api/import/gmail", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ accountId, options: syncOptions, cleanupMode })
            });
            if (accountEmail) {
                clearCleanupModeForAccount(accountEmail.toLowerCase());
            }

            const jobId = result.data?.jobId;
            if (!result.ok || !jobId) {
                toast.error(result.message || `Failed to sync from ${accountName}`);
                setGmailStatus(accountId, "error");
                return;
            }

            const pollJob = async () => {
                const maxAttempts = 900; // ~30 minutes @ 2s
                for (let attempt = 0; attempt < maxAttempts; attempt++) {
                    const res = await fetch(apiPath(`/jobs/${encodeURIComponent(jobId)}`));
                    const json = await res.json().catch(() => null);
                    const job = json?.data?.job;

                    if (json?.success && job) {
                        if (job.status === "SUCCEEDED") return job;
                        if (job.status === "FAILED") throw new Error(job.error || "Gmail import failed.");
                    }

                    await new Promise(r => setTimeout(r, 2000));
                }

                throw new Error("Gmail import timed out.");
            };

            const finalJob: any = await pollJob();
            const data = finalJob?.result || {};
            const count = Number(data.count || 0);
            const conflicts = Number(data.conflicts || 0);
            const skippedAutomatedTotal = Number(data.skippedAutomatedTotal || 0);
            const skippedCategories = data.skippedAutomatedByCategory || {};
            const skippedSamples = Array.isArray(data.skippedAutomatedSamples) ? data.skippedAutomatedSamples : [];

            const message = `Successfully imported ${count} clients from ${accountName} Gmail.${conflicts > 0 ? ` Detected ${conflicts} existing record conflicts.` : ""}${skippedAutomatedTotal > 0 ? ` Skipped ${skippedAutomatedTotal} automated/system emails.` : ""}`;
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
        } catch (error) {
            toast.error(`Network error during ${accountName} sync.`);
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
        let cleanupMode: GmailCleanupMode = "none";
        if (isProfileNarrowed(previousProfile, gmailSyncProfile)) {
            const shouldApplySafeCleanup = window.confirm(
                "Your sync scope is tighter than before. Existing contacts remain by default.\n\n" +
                "Click OK to apply Safe Cleanup (mark out-of-scope contacts as blocked where detectable).\n" +
                "Click Cancel to keep all existing contacts unchanged."
            );
            cleanupMode = shouldApplySafeCleanup ? "safe_cleanup" : "none";
            saveCleanupModeForAccount(accountKey, cleanupMode);
        } else {
            clearCleanupModeForAccount(accountKey);
        }
        saveProfileForAccount(accountKey, gmailSyncProfile);
        toast.success(`Saved sync filters for ${activeGmailAccountForProfile.name}.`);
        setIsGmailProfileModalOpen(false);
    };

    const handleAddGmailAccount = () => {
        const label = gmailLabel.trim();
        if (!label) {
            toast.error("Please enter an account label.");
            return;
        }
        if ((gmailIntent === "sync" || gmailIntent === "both") && gmailSyncProfile.sourceFolders.length === 0) {
            toast.error("Please select at least one sync source.");
            return;
        }
        const syncProfile = buildSyncOptionsPayload(gmailSyncProfile);
        const url = `${appPath("/api/gmail/connect")}?label=${encodeURIComponent(label)}&intent=${encodeURIComponent(gmailIntent)}&returnTo=${encodeURIComponent("/import")}&syncProfile=${encodeURIComponent(JSON.stringify(syncProfile))}`;
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
        setGmailStatus(googleContactsAccountId, "syncing");
        try {
            const res = await safeImportRequest<{ count: number; conflicts: number }>(apiPath("/import/google-contacts"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ accountId: googleContactsAccountId }),
            });
            if (res.ok && res.data) {
                toast.success(`Synced ${res.data.count} Google Contacts.${res.data.conflicts > 0 ? ` Conflicts: ${res.data.conflicts}.` : ""}`);
                setGmailStatus(googleContactsAccountId, res.data.conflicts > 0 ? "warning" : "success");
                await fetchGmailAccounts();
            } else {
                toast.error(res.message || "Failed to sync Google Contacts.");
                setGmailStatus(googleContactsAccountId, "error");
            }
        } catch {
            toast.error("Network error during Google Contacts sync.");
            setGmailStatus(googleContactsAccountId, "error");
        } finally {
            inFlightKeysRef.current.delete(lockKey);
        }
    };

    const handleInvoiceSync = async () => {
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
        <div className="space-y-8 animate-in fade-in duration-500 pb-20 w-full px-3 sm:px-4 lg:px-6">
            <header className="px-2">
                <div className="flex items-center gap-3 text-blue-600 mb-2">
                    <DownloadCloud className="w-5 h-5" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Data Import</span>
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">Integrations</h2>
                <p className="text-slate-500 font-medium text-sm mt-1">Connect external data channels and synchronize your client base.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Main Source</span>
                                <div className={cn(
                                    "mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter",
                                    syncStatus.invoice === "success" ? "bg-emerald-100 text-emerald-600" : 
                                    syncStatus.invoice === "error" ? "bg-red-100 text-red-600" :
                                    syncStatus.invoice === "warning" ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-500"
                                )}>
                                    {syncStatus.invoice === "syncing" ? "Syncing..." : syncStatus.invoice === "idle" ? "Ready" : syncStatus.invoice}
                                </div>
                            </div>
                        </div>

                        <div className="mb-8">
                            <h3 className="text-lg font-bold text-slate-900 mb-1">Internal Invoice System</h3>
                            <p className="text-sm text-slate-500 font-medium">Secondary source for client financial profiles.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="flex items-center gap-2">
                                    <RefreshCw className={cn("w-3.5 h-3.5 text-slate-400", syncStatus.invoice === "syncing" && "animate-spin")} />
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Last Pulse</span>
                                        <span className="text-[9px] text-blue-600 font-black uppercase tracking-widest mt-0.5">
                                            {globalSettings?.invoiceStats?.count || 0} Clients Synced
                                        </span>
                                    </div>
                                </div>
                                <span className="text-xs font-semibold text-slate-700">{invoiceLastSync}</span>
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
                                className="w-full h-12 bg-blue-600 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-all active:scale-[0.98] shadow-lg shadow-blue-600/20 flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                {syncStatus.invoice === "syncing" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                Sync Now
                            </button>
                        </div>
                    </div>
                </div>

                {/* Zoho Bigin Card */}
                <div className={cn(
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
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pipeline</span>
                                <div className={cn(
                                    "mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter",
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
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Last Pulse</span>
                                        <span className="text-[9px] text-orange-600 font-black uppercase tracking-widest mt-0.5">
                                            {zohoClientCount} Clients Synced
                                        </span>
                                    </div>
                                </div>
                                <span className="text-xs font-semibold text-slate-700">{zohoLastSync}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => setIsZohoModalOpen(true)}
                                    className="h-12 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                                >
                                    <Database className="w-4 h-4" />
                                    Config
                                </button>
                                <button 
                                    onClick={handleZohoSync}
                                    disabled={syncStatus.zoho === "syncing" || !zohoConfig.hasRefreshToken}
                                    className="h-12 bg-orange-600 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-orange-700 transition-all active:scale-[0.98] shadow-lg shadow-orange-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
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
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email Channel</span>
                                <div className="mt-1 px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[9px] font-bold uppercase tracking-tighter">
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
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Last Pulse</span>
                                        <span className="text-[9px] text-red-600 font-black uppercase tracking-widest mt-0.5">
                                            {globalSettings?.gmailStats?.count || 0} Clients Synced
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
                                                <span className="text-[10px] text-slate-900 font-black lowercase truncate tracking-tight">{acc.email}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Connected Node</span>
                                                    <div className="w-1 h-1 rounded-full bg-slate-200" />
                                                    <span className="text-[9px] text-blue-600 font-black uppercase tracking-widest">
                                                        {acc.count || 0} Clients Synced
                                                    </span>
                                                </div>
                                                <span className="text-[9px] text-slate-500 font-medium truncate" title={profileSummary(effective)}>
                                                    {profileSummary(effective)}
                                                </span>
                                            </div>
                                        </div>
                                            );
                                        })()}
                                        <div className="flex flex-col items-center gap-1">
                                            <button
                                                onClick={() => openProfileModal(acc)}
                                                className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600"
                                            >
                                                Edit Filters
                                            </button>
                                            <button 
                                                onClick={() => handleGmailSync(acc.id, acc.accountName || acc.email, acc.email)}
                                                disabled={syncStatus.gmail[acc.id] === "syncing"}
                                                className="flex flex-col items-center gap-1 group/btn"
                                            >
                                                <div className={cn(
                                                    "w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl transition-all",
                                                    syncStatus.gmail[acc.id] === "syncing" ? "border-blue-200 text-blue-600" : "hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-400 shadow-sm"
                                                )}>
                                                    {syncStatus.gmail[acc.id] === "syncing" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 group-hover/btn:rotate-180 transition-transform duration-500" />}
                                                </div>
                                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover/btn:text-red-500">Sync Again</span>
                                            </button>
                                        </div>
                                    </div>
                                    {insight && insight.skippedAutomatedTotal > 0 && (
                                        <div className="p-3 rounded-xl border border-amber-200 bg-amber-50">
                                            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
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
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">No accounts linked</p>
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={() => setIsGmailModalOpen(true)}
                                className="w-full h-12 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 hover:border-red-100 hover:text-red-600 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                            >
                                <Plus className="w-4 h-4" />
                                Connect Account
                            </button>
                        </div>
                    </div>
                </div>

                {/* Google Contacts Card */}
                <div className="group relative bg-white rounded-3xl border border-slate-200 p-6 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/5 hover:-translate-y-1 overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                    <div className="relative">
                        <div className="flex items-start justify-between mb-6">
                            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-6">
                                <User className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Directory Channel</span>
                                <div className={cn(
                                    "mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter",
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
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Last Pulse</span>
                                        <span className="text-[9px] text-emerald-600 font-black uppercase tracking-widest mt-0.5">
                                            {googleContactsConnected ? (globalSettings?.gmailStats?.count || 0) : 0} Contacts Synced
                                        </span>
                                    </div>
                                </div>
                                <span className="text-xs font-semibold text-slate-700">
                                    {googleContactsConnected && globalSettings?.gmailStats?.lastSyncAt 
                                        ? new Date(globalSettings.gmailStats.lastSyncAt).toLocaleString() 
                                        : "Never"}
                                </span>
                            </div>

                            <button
                                onClick={handleConnectGoogleContacts}
                                className="w-full h-12 bg-emerald-600 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-700 transition-all active:scale-[0.98] shadow-lg shadow-emerald-600/10 flex items-center justify-center gap-3"
                            >
                                <Plus className="w-4 h-4" />
                                {googleContactsConnected ? "Re-auth Directory" : "Connect Contacts"}
                            </button>
                            
                            {googleContactsConnected && (
                                <button
                                    onClick={handleGoogleContactsSync}
                                    disabled={googleContactsAccountId ? syncStatus.gmail[googleContactsAccountId] === "syncing" : true}
                                    className="w-full h-10 bg-white border border-emerald-200 text-emerald-700 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <RefreshCw className={cn("w-3.5 h-3.5", googleContactsAccountId && syncStatus.gmail[googleContactsAccountId] === "syncing" && "animate-spin")} />
                                    {googleContactsAccountId && syncStatus.gmail[googleContactsAccountId] === "syncing" ? "Syncing..." : "Run Directory Sync"}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Zoho Modal Refactor */}
            {isZohoModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-all" onClick={() => setIsZohoModalOpen(false)} />
                    <div className="bg-white w-full max-w-lg rounded-3xl border border-slate-200 shadow-xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                                    <Cloud className="w-4 h-4 text-orange-600" />
                                </div>
                                <h3 className="font-semibold text-slate-900 text-base">Zoho Settings</h3>
                            </div>
                            <button onClick={() => setIsZohoModalOpen(false)} className="text-slate-400 hover:text-slate-900 bg-slate-50 rounded-full p-1.5 transition-colors"><X className="w-4 h-4" /></button>
                        </div>

                        <div className="p-5 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
                            {/* Section 1: Authorization */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <Shield className="w-3.5 h-3.5 text-slate-400" />
                                    <h4 className="text-sm font-semibold text-slate-700">1. Connection</h4>
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
                                        className="w-full h-10 bg-orange-600 text-white rounded-xl text-sm font-semibold hover:bg-orange-700 transition-all active:scale-[0.98] shadow-md shadow-orange-600/10 flex items-center justify-center gap-2"
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
                                    <h4 className="text-sm font-semibold text-slate-700">2. Pipeline and stages</h4>
                                </div>
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={zohoFormData.pipelineName}
                                        onChange={(e) => setZohoFormData(prev => ({ ...prev, pipelineName: e.target.value }))}
                                        placeholder="Pipeline Name (e.g. Sales Pipeline)"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none focus:bg-white focus:border-orange-500 transition-all"
                                    />
                                    
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-xs text-slate-600 font-medium">Select stages to sync</p>
                                            <button 
                                                onClick={refreshAvailableStages}
                                                disabled={isLoadingStages}
                                                className="text-xs font-semibold text-orange-600 hover:text-orange-700 disabled:opacity-50 flex items-center gap-1"
                                            >
                                                <RefreshCw className={`w-3 h-3 ${isLoadingStages ? 'animate-spin' : ''}`} />
                                                Refresh
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 gap-1.5 max-h-[180px] overflow-y-auto p-3 bg-slate-50 rounded-xl border border-slate-200 custom-scrollbar">
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
                                    className="w-full flex items-center justify-between text-left"
                                >
                                    <span className="text-sm font-semibold text-slate-700">Advanced settings</span>
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
                                        className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1"
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
                                            placeholder="Quick filter..."
                                            value={zohoFieldSearch}
                                            onChange={(e) => setZohoFieldSearch(e.target.value)}
                                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs w-32 outline-none focus:border-orange-500 transition-all"
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
                                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter opacity-70 group-hover:text-orange-500 transition-colors">{field.module}.{field.api_name}</span>
                                                        </div>
                                                        <button 
                                                            onClick={() => {
                                                                const newExclusions = isExcluded 
                                                                    ? zohoExclusions.filter(id => id !== field.id)
                                                                    : [...zohoExclusions, field.id];
                                                                setZohoExclusions(newExclusions);
                                                            }}
                                                            className={cn(
                                                                "h-6 px-2.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all duration-300 border flex items-center justify-center min-w-[64px]",
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
                                    {zohoConfig.hasRefreshToken ? "Refresh token" : "Link account identity"}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Gmail Connection Modal */}
            {isGmailModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsGmailModalOpen(false)} />
                    <div className="bg-white w-full max-w-xl rounded-3xl border border-slate-200 shadow-xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Mail className="w-5 h-5 text-red-600" />
                                <h3 className="font-bold text-slate-900">Connect Gmail</h3>
                            </div>
                            <button onClick={() => setIsGmailModalOpen(false)} className="text-slate-400 hover:text-slate-900 bg-slate-50 rounded-full p-1.5 transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Account Label</label>
                                <input 
                                    type="text" 
                                    value={gmailLabel} 
                                    onChange={(e) => setGmailLabel(e.target.value)}
                                    placeholder="e.g. Sales Team, Support"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:bg-white focus:border-red-500 transition-all font-medium"
                                />
                                <p className="mt-2 text-[10px] text-slate-400 font-medium">Use this to identify this Gmail account later.</p>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">What do you want to do?</label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {[
                                        { id: "send", title: "Send Emails", detail: "Send emails from this Gmail account only." },
                                        { id: "sync", title: "Sync Contacts", detail: "Read Gmail and sync contact emails only." },
                                        { id: "both", title: "Do Both", detail: "Enable both sending and contact sync." },
                                    ].map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setGmailIntent(item.id as GmailConnectIntent)}
                                            className={cn(
                                                "text-left p-3 rounded-xl border transition-all",
                                                gmailIntent === item.id
                                                    ? "border-red-300 bg-red-50"
                                                    : "border-slate-200 bg-white hover:border-red-200"
                                            )}
                                        >
                                            <p className="text-[11px] font-bold text-slate-900">{item.title}</p>
                                            <p className="text-[10px] text-slate-500 mt-1">{item.detail}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {(gmailIntent === "sync" || gmailIntent === "both") && (
                                <div className="space-y-4 border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                                    <p className="text-[11px] font-bold text-slate-800">Contact Sync Options</p>

                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Source folders</label>
                                        <div className="flex flex-wrap gap-2">
                                            {(["INBOX", "SENT", "LABEL"] as GmailSyncFolder[]).map((folder) => (
                                                <button
                                                    key={folder}
                                                    type="button"
                                                    onClick={() =>
                                                        setGmailSyncProfile((prev) => ({
                                                            ...prev,
                                                            sourceFolders: prev.sourceFolders.includes(folder)
                                                                ? prev.sourceFolders.filter((f) => f !== folder)
                                                                : [...prev.sourceFolders, folder],
                                                        }))
                                                    }
                                                    className={cn(
                                                        "px-3 py-1.5 rounded-lg text-[10px] font-bold border",
                                                        gmailSyncProfile.sourceFolders.includes(folder)
                                                            ? "bg-blue-50 text-blue-700 border-blue-200"
                                                            : "bg-white text-slate-500 border-slate-200"
                                                    )}
                                                >
                                                    {folder}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {gmailSyncProfile.sourceFolders.includes("LABEL") && (
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Custom labels (comma separated)</label>
                                            <input
                                                type="text"
                                                value={gmailSyncProfile.customLabelsText}
                                                onChange={(e) => setGmailSyncProfile((prev) => ({ ...prev, customLabelsText: e.target.value }))}
                                                placeholder="leads, clients, high-priority"
                                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Extract from</label>
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
                                                        "px-3 py-1.5 rounded-lg text-[10px] font-bold border uppercase",
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

                                    <div className="grid sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Block domains</label>
                                            <input
                                                type="text"
                                                value={gmailSyncProfile.excludedDomainsText}
                                                onChange={(e) => setGmailSyncProfile((prev) => ({ ...prev, excludedDomainsText: e.target.value }))}
                                                placeholder="e.g. noreply.com, spam.com"
                                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500"
                                            />
                                            <p className="mt-1 text-[10px] text-slate-500">Skips contacts whose email domain matches these entries.</p>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Block keywords</label>
                                            <input
                                                type="text"
                                                value={gmailSyncProfile.excludedKeywordsText}
                                                onChange={(e) => setGmailSyncProfile((prev) => ({ ...prev, excludedKeywordsText: e.target.value }))}
                                                placeholder="e.g. unsubscribe, alert, invoice"
                                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500"
                                            />
                                            <p className="mt-1 text-[10px] text-slate-500">Skips contacts when keywords appear in sender details, subject, or snippet.</p>
                                        </div>
                                    </div>

                                    <label className="flex items-center gap-2 text-[11px] text-slate-700 font-medium">
                                        <input
                                            type="checkbox"
                                            checked={gmailSyncProfile.persistBlockList}
                                            onChange={(e) => setGmailSyncProfile((prev) => ({ ...prev, persistBlockList: e.target.checked }))}
                                        />
                                        Keep blocked domains active after future syncs
                                    </label>
                                    <label className="flex items-center gap-2 text-[11px] text-slate-700 font-medium">
                                        <input
                                            type="checkbox"
                                            checked={gmailSyncProfile.includeAutomatedEmails}
                                            onChange={(e) => setGmailSyncProfile((prev) => ({ ...prev, includeAutomatedEmails: e.target.checked }))}
                                        />
                                        Include newsletter/alert/transaction emails in normal sync
                                    </label>
                                </div>
                            )}

                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                                <p className="text-[10px] text-blue-700 font-medium">
                                    Permissions are requested based on your selection to reduce unnecessary access.
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
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsGmailProfileModalOpen(false)} />
                    <div className="bg-white w-full max-w-xl rounded-3xl border border-slate-200 shadow-xl relative overflow-hidden">
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-bold text-slate-900">Edit Sync Filters</h3>
                            <button onClick={() => setIsGmailProfileModalOpen(false)} className="text-slate-400 hover:text-slate-900 bg-slate-50 rounded-full p-1.5 transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-[11px] text-slate-600 font-medium">{activeGmailAccountForProfile.name} ({activeGmailAccountForProfile.email})</p>
                            <div className="space-y-3 border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Source folders</label>
                                    <div className="flex flex-wrap gap-2">
                                        {(["INBOX", "SENT", "LABEL"] as GmailSyncFolder[]).map((folder) => (
                                            <button
                                                key={folder}
                                                type="button"
                                                onClick={() =>
                                                    setGmailSyncProfile((prev) => ({
                                                        ...prev,
                                                        sourceFolders: prev.sourceFolders.includes(folder)
                                                            ? prev.sourceFolders.filter((f) => f !== folder)
                                                            : [...prev.sourceFolders, folder],
                                                    }))
                                                }
                                                className={cn(
                                                    "px-3 py-1.5 rounded-lg text-[10px] font-bold border",
                                                    gmailSyncProfile.sourceFolders.includes(folder)
                                                        ? "bg-blue-50 text-blue-700 border-blue-200"
                                                        : "bg-white text-slate-500 border-slate-200"
                                                )}
                                            >
                                                {folder}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {gmailSyncProfile.sourceFolders.includes("LABEL") && (
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Custom labels</label>
                                        <input
                                            type="text"
                                            value={gmailSyncProfile.customLabelsText}
                                            onChange={(e) => setGmailSyncProfile((prev) => ({ ...prev, customLabelsText: e.target.value }))}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500"
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Extract from</label>
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
                                                    "px-3 py-1.5 rounded-lg text-[10px] font-bold border uppercase",
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
                                <div className="grid sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Block domains</label>
                                        <input
                                            type="text"
                                            value={gmailSyncProfile.excludedDomainsText}
                                            onChange={(e) => setGmailSyncProfile((prev) => ({ ...prev, excludedDomainsText: e.target.value }))}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500"
                                        />
                                        <p className="mt-1 text-[10px] text-slate-500">Skips contacts whose email domain matches these entries.</p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Block keywords</label>
                                        <input
                                            type="text"
                                            value={gmailSyncProfile.excludedKeywordsText}
                                            onChange={(e) => setGmailSyncProfile((prev) => ({ ...prev, excludedKeywordsText: e.target.value }))}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500"
                                        />
                                        <p className="mt-1 text-[10px] text-slate-500">Skips contacts when keywords appear in sender details, subject, or snippet.</p>
                                    </div>
                                </div>
                                <label className="flex items-center gap-2 text-[11px] text-slate-700 font-medium">
                                    <input
                                        type="checkbox"
                                        checked={gmailSyncProfile.persistBlockList}
                                        onChange={(e) => setGmailSyncProfile((prev) => ({ ...prev, persistBlockList: e.target.checked }))}
                                    />
                                    Keep blocked domains active after future syncs
                                </label>
                                <label className="flex items-center gap-2 text-[11px] text-slate-700 font-medium">
                                    <input
                                        type="checkbox"
                                        checked={gmailSyncProfile.includeAutomatedEmails}
                                        onChange={(e) => setGmailSyncProfile((prev) => ({ ...prev, includeAutomatedEmails: e.target.checked }))}
                                    />
                                    Include newsletter/alert/transaction emails in normal sync
                                </label>
                            </div>
                            <button onClick={saveActiveProfile} className="w-full h-11 bg-slate-900 text-white rounded-2xl text-[11px] font-bold uppercase tracking-[0.2em]">
                                Save Filters
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
