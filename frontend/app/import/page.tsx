"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import { DownloadCloud, FileText, Database, Loader2, RefreshCw, CheckCircle2, Cloud, X, Key, Shield, Mail, User, Plus } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { toast } from "sonner";
import { createClient } from "@/frontend/lib/supabase/client";
import { SmartLoader } from "@/frontend/components/SmartLoader";
import { safeImportRequest, type ImportSyncStatus } from "@/frontend/lib/import-sync";
import { apiPath, appPath } from "@/frontend/lib/app-path";

export default function ImportIntegrationsPage() {
    const { data: session } = useSession();
    const user = session?.user;
    const supabase = createClient();

    const [invoiceLastSync, setInvoiceLastSync] = useState<string | null>("Never");
    const [invoiceSyncNote, setInvoiceSyncNote] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [zohoLastSync, setZohoLastSync] = useState<string | null>("Never");

    // Gmail State
    const [gmailAccounts, setGmailAccounts] = useState<any[]>([]);
    const [isGmailModalOpen, setIsGmailModalOpen] = useState(false);
    const [gmailLabel, setGmailLabel] = useState("Sales Team");

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

    const fetchGlobalSettings = async () => {
        try {
            const res = await fetch(apiPath("/settings"));
            const result = await res.json();
            if (result.success) {
                setGlobalSettings(result.data);
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
                toast.error(result.error?.message || "Failed to load Zoho fields.");
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
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        setLoading(true);
        Promise.all([fetchSettings(), fetchGmailAccounts(), fetchGlobalSettings()]).finally(() => setLoading(false));
    }, []);

    const handleGmailSync = async (accountId: string, accountName: string) => {
        const lockKey = `gmail:${accountId}`;
        if (inFlightKeysRef.current.has(lockKey)) return;
        inFlightKeysRef.current.add(lockKey);
        setGmailStatus(accountId, "syncing");
        try {
            const result = await safeImportRequest<{ jobId: string }>("/api/import/gmail", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ accountId })
            });

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

            const message = `Successfully imported ${count} clients from ${accountName} Gmail.${conflicts > 0 ? ` Detected ${conflicts} existing record conflicts.` : ""}`;
            toast.success(message);
            setGmailStatus(accountId, conflicts > 0 ? "warning" : "success");
            await fetchGmailAccounts();
        } catch (error) {
            toast.error(`Network error during ${accountName} sync.`);
            setGmailStatus(accountId, "error");
        } finally {
            inFlightKeysRef.current.delete(lockKey);
        }
    };

    const handleAddGmailAccount = () => {
        // Redirect to Google Auth with the selected label in state
        window.location.href = `${appPath("/api/auth/google")}?state=${encodeURIComponent(gmailLabel)}`;
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

    const handleZohoSync = async () => {
        const lockKey = "zoho";
        if (inFlightKeysRef.current.has(lockKey)) return;
        inFlightKeysRef.current.add(lockKey);
        setSyncStatus((prev) => ({ ...prev, zoho: "syncing" }));
        try {
            const result = await safeImportRequest<{ count: number; conflicts: number; purged?: number }>(apiPath("/import/zoho"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pipelineStage: zohoConfig.stageName })
            });
            if (result.ok && result.data) {
                const data = result.data;
                const message = `Successfully imported ${data.count || 0} clients from Zoho Bigin.${data.conflicts > 0 ? ` Detected ${data.conflicts} existing record conflicts.` : ""}`;
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
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Universal Data Ingestion</span>
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">Integrations Studio</h2>
                <p className="text-slate-500 font-medium text-sm mt-1">Connect external data channels and synchronize your client base.</p>
            </header>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Core Data Node</span>
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
                            <h3 className="text-xl font-bold text-slate-900 mb-1">Internal Invoice System</h3>
                            <p className="text-sm text-slate-500 font-medium">Secondary source for client financial profiles.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="flex items-center gap-2">
                                    <RefreshCw className={cn("w-3.5 h-3.5 text-slate-400", syncStatus.invoice === "syncing" && "animate-spin")} />
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Last Pulse</span>
                                </div>
                                <span className="text-[11px] font-bold text-slate-700">{invoiceLastSync}</span>
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
                                className="w-full h-12 bg-blue-600 text-white rounded-2xl text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-blue-700 transition-all active:scale-[0.98] shadow-lg shadow-blue-600/20 flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                {syncStatus.invoice === "syncing" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                Synchronize Node
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
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pipeline Connector</span>
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
                            <h3 className="text-xl font-bold text-slate-900 mb-1">Zoho Bigin CRM</h3>
                            <p className="text-sm text-slate-500 font-medium">Primary source for deals and contact pipelines.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="flex items-center gap-2">
                                    <RefreshCw className={cn("w-3.5 h-3.5 text-slate-400", syncStatus.zoho === "syncing" && "animate-spin")} />
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Last Pulse</span>
                                </div>
                                <span className="text-[11px] font-bold text-slate-700">{zohoLastSync}</span>
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
                <div className="group relative bg-white rounded-3xl border border-slate-200 p-6 transition-all duration-300 hover:shadow-xl hover:shadow-red-500/5 hover:-translate-y-1 overflow-hidden lg:col-span-1 md:col-span-2">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                    
                    <div className="relative">
                        <div className="flex items-start justify-between mb-6">
                            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-6">
                                <Mail className="w-6 h-6 text-red-600" />
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Communication Node</span>
                                <span className="mt-1 px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[9px] font-bold uppercase tracking-tighter">
                                    {gmailAccounts.length} Connected
                                </span>
                            </div>
                        </div>

                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-slate-900 mb-1">Gmail Multi-Account</h3>
                            <p className="text-sm text-slate-500 font-medium">Extracting client intent from email channels.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="max-h-[160px] overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                                {gmailAccounts.map((acc: any) => (
                                    <div key={acc.id} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100 group/item hover:bg-white hover:border-red-100/50 transition-all hover:shadow-sm">
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
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleGmailSync(acc.id, acc.accountName || acc.email)}
                                            disabled={syncStatus.gmail[acc.id] === "syncing"}
                                            className="flex flex-col items-center gap-1 group/btn"
                                        >
                                            <div className={cn(
                                                "w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl transition-all",
                                                syncStatus.gmail[acc.id] === "syncing" ? "border-blue-200 text-blue-600" : "hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-400 shadow-sm"
                                            )}>
                                                {syncStatus.gmail[acc.id] === "syncing" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 group-hover/btn:rotate-180 transition-transform duration-500" />}
                                            </div>
                                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 group-hover/btn:text-red-500">Sync Again</span>
                                        </button>
                                    </div>
                                ))}
                                {gmailAccounts.length === 0 && (
                                    <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">No accounts linked</p>
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={() => setIsGmailModalOpen(true)}
                                className="w-full h-12 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-slate-50 hover:border-red-100 hover:text-red-600 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                            >
                                <Plus className="w-4 h-4" />
                                Link Account Node
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Zoho Modal Refactor */}
            {isZohoModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-all" onClick={() => setIsZohoModalOpen(false)} />
                    <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200 shadow-xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                                    <Cloud className="w-4 h-4 text-orange-600" />
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="font-bold text-slate-900 text-sm">Zoho Configuration</h3>
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Unified Setup Node</span>
                                </div>
                            </div>
                            <button onClick={() => setIsZohoModalOpen(false)} className="text-slate-400 hover:text-slate-900 bg-slate-50 rounded-full p-1.5 transition-colors"><X className="w-4 h-4" /></button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-8 flex-1 custom-scrollbar">
                            {/* Section 1: API Setup */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <Key className="w-3.5 h-3.5 text-slate-400" />
                                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">API Credentials</h4>
                                </div>
                                <div className="grid gap-3">
                                    <div>
                                        <input
                                            type="text"
                                            value={zohoFormData.clientId}
                                            onChange={(e) => setZohoFormData(prev => ({ ...prev, clientId: e.target.value }))}
                                            placeholder={zohoConfig.hasClientId ? "•••••••••••••••• (Encrypted)" : "Zoho Client ID"}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-orange-500 transition-all font-medium"
                                        />
                                    </div>
                                    <div>
                                        <input
                                            type="password"
                                            value={zohoFormData.clientSecret}
                                            onChange={(e) => setZohoFormData(prev => ({ ...prev, clientSecret: e.target.value }))}
                                            placeholder={zohoConfig.hasClientSecret ? "•••••••••••••••••••••••• (Encrypted)" : "Zoho Client Secret"}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-orange-500 transition-all font-medium"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Targeting */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pipeline & Stages</h4>
                                </div>
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={zohoFormData.pipelineName}
                                        onChange={(e) => setZohoFormData(prev => ({ ...prev, pipelineName: e.target.value }))}
                                        placeholder="Pipeline Name (e.g. Sales Pipeline)"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-orange-500 transition-all font-medium"
                                    />
                                    
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-[10px] text-slate-400 font-medium">Select Stages to Sync</p>
                                            <button 
                                                onClick={refreshAvailableStages}
                                                disabled={isLoadingStages}
                                                className="text-[10px] font-bold text-orange-600 hover:text-orange-700 disabled:opacity-50 flex items-center gap-1"
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
                                                                <span className={`text-[10px] font-bold tracking-tight ${isChecked ? 'text-slate-900' : 'text-slate-500'}`}>{stage}</span>
                                                            </label>
                                                        );
                                                    })}
                                                    {availableStages.length === 0 && (
                                                        <div className="py-8 text-center">
                                                            <p className="text-[10px] text-slate-400 italic">No stages found. Check your API credentials.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between text-[9px] text-slate-400 italic px-1">
                                            <span>{zohoStages.length} stages selected</span>
                                            {zohoStages.length === 0 && <span>(Will sync all if none selected)</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Column Mapping & Smart Sync */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <Database className="w-3.5 h-3.5 text-slate-400" />
                                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Column Mapping</h4>
                                    </div>
                                    <button 
                                        onClick={() => setFieldMapping([...fieldMapping, { zohoField: "", appField: "metadata" }])}
                                        className="text-[10px] font-bold text-orange-600 hover:text-orange-700 tracking-wider flex items-center gap-1"
                                    >
                                        <Plus className="w-3 h-3" /> Add Map
                                    </button>
                                </div>

                                <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                                    {fieldMapping.length === 0 && (
                                        <p className="text-[10px] text-slate-400 italic py-2">No custom mappers active. Using core identity defaults.</p>
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
                                                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] text-slate-900 outline-none focus:border-orange-500"
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
                                                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] text-slate-900 outline-none focus:border-orange-500"
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
                                                <p className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                                                    <DownloadCloud className="w-3.5 h-3.5 text-orange-600" /> Smart Multi-Column Sync
                                                </p>
                                                <p className="text-[9px] text-slate-500 font-medium leading-tight">Capture all pipeline depth automatically.</p>
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
                                            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Exclusion Controls</h4>
                                        </div>
                                        <input 
                                            type="text" 
                                            placeholder="Quick filter..."
                                            value={zohoFieldSearch}
                                            onChange={(e) => setZohoFieldSearch(e.target.value)}
                                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[9px] w-24 outline-none focus:border-orange-500 transition-all font-medium"
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

                                            if (allFields.length === 0) return <p className="text-[10px] text-slate-400 italic text-center py-4">No discovered columns to filter.</p>;

                                            return allFields.map(field => {
                                                const isExcluded = zohoExclusions.includes(field.id);
                                                return (
                                                    <div key={field.id} className={cn(
                                                        "flex items-center justify-between px-3 py-2 rounded-xl border transition-all duration-200 group",
                                                        isExcluded ? "bg-slate-50 border-slate-100 opacity-60 grayscale-[0.5]" : "bg-white border-slate-100 shadow-sm hover:border-orange-200"
                                                    )}>
                                                        <div className="flex flex-col">
                                                            <span className="text-[11px] font-bold text-slate-700">{field.field_label}</span>
                                                            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter opacity-70 group-hover:text-orange-500 transition-colors">{field.module}.{field.api_name}</span>
                                                        </div>
                                                        <button 
                                                            onClick={() => {
                                                                const newExclusions = isExcluded 
                                                                    ? zohoExclusions.filter(id => id !== field.id)
                                                                    : [...zohoExclusions, field.id];
                                                                setZohoExclusions(newExclusions);
                                                            }}
                                                            className={cn(
                                                                "h-6 px-2.5 rounded-lg text-[8px] font-bold uppercase tracking-widest transition-all duration-300 border flex items-center justify-center min-w-[64px]",
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
                        </div>

                        {/* Unified Action Footer */}
                        <div className="p-6 border-t border-slate-100 bg-slate-50/80 backdrop-blur-sm shrink-0 flex flex-col gap-3">
                            <button
                                onClick={handleSaveAllZoho}
                                disabled={isSavingZoho || ((user as any)?.role !== "ADMIN")}
                                className="w-full h-12 bg-slate-900 text-white rounded-2xl text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-slate-800 transition-all active:scale-[0.98] shadow-lg shadow-slate-900/10 flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                {isSavingZoho ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                                Sync Node Configuration
                            </button>

                            {(zohoConfig.hasClientId || zohoFormData.clientId) && (
                                <button
                                    onClick={() => { window.location.href = appPath("/api/auth/zoho"); }}
                                    className="w-full py-3 bg-white border border-slate-200 hover:border-orange-300 hover:bg-orange-50 text-slate-600 hover:text-orange-600 rounded-xl text-[10px] font-bold uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-2"
                                >
                                    <Key className="w-3.5 h-3.5" />
                                    {zohoConfig.hasRefreshToken ? "Refresh Identity Token" : "Link Account Identity"}
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
                    <div className="bg-white w-full max-w-sm rounded-3xl border border-slate-200 shadow-xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Mail className="w-5 h-5 text-red-600" />
                                <h3 className="font-bold text-slate-900">Link Gmail Account</h3>
                            </div>
                            <button onClick={() => setIsGmailModalOpen(false)} className="text-slate-400 hover:text-slate-900 bg-slate-50 rounded-full p-1.5 transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Account Identity Label</label>
                                <input 
                                    type="text" 
                                    value={gmailLabel} 
                                    onChange={(e) => setGmailLabel(e.target.value)}
                                    placeholder="e.g. Sales Team, Support"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:bg-white focus:border-red-500 transition-all font-medium"
                                />
                                <p className="mt-2 text-[10px] text-slate-400 font-medium">This label helps identify the context of imported clients.</p>
                            </div>
                            <button 
                                onClick={handleAddGmailAccount}
                                disabled={(user as any)?.role !== "ADMIN"}
                                className="w-full h-12 bg-slate-900 text-white rounded-2xl text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-slate-800 transition-all active:scale-[0.98] shadow-lg shadow-slate-900/10 flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                <User className="w-4 h-4" />
                                Authenticate Node
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
