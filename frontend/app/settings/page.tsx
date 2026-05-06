"use client";

import { toast } from "sonner";
import { useState, useEffect } from "react";
import {
    Settings as SettingsIcon,
    Bot,
    Mail,
    Save,
    CheckCircle2,
    AlertCircle,
    Loader2,
    RotateCcw,
    ShieldCheck,
    Eye,
    EyeOff,
    Zap,
    Cpu,
    ArrowLeft,
    Network,
    Info,
    Send,
    Settings2,
    Shield,
    LayoutDashboard,
    Users,
    UserPlus,
    RefreshCw,
    Smartphone,
    ChevronRight,
    Activity,
    Server,
    Lock,
    Key,
    ShieldAlert,
    Timer,
    ZapOff,
    Pulse
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { SmartLoader } from "@/frontend/components/SmartLoader";
import { PageHeader } from "@/frontend/components/ui/page-header";
import { apiPath } from "@/frontend/lib/app-path";
import { useSession, signIn } from "next-auth/react";

const MASK = "••••••••••••••••";

export default function SettingsPage() {
    const { data: session } = useSession();
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [resetModalOpen, setResetModalOpen] = useState(false);
    const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});
    const [testStatus, setTestStatus] = useState<{ status: 'idle' | 'testing' | 'success' | 'error', message?: string }>({ status: 'idle' });
    const [nodeTestLoading, setNodeTestLoading] = useState<string | null>(null);

    const defaultSettings = {
        aiProvider: "Groq",
        aiModel: "llama-3.3-70b-versatile",
        groqApiKey: "",
        openaiApiKey: "",
        googleClientId: "",
        googleClientSecret: "",
        projectName: "IKF Outreach",
        projectLogo: "",
        emailProvider: "GMAIL" as "GMAIL" | "SMTP",
        invoiceApiKey: "",
        invoiceApiUrl: "",
        autoFailover: true,
        
        // SMTP Configuration
        smtpHost: "",
        smtpPort: 587,
        smtpUser: "",
        smtpPass: "",
        smtpSecure: false,
        smtpSenderEmail: "",
        smtpSenderName: "IKF Outreach",
        
        gmailAccounts: [] as any[]
    };

    const [formData, setFormData] = useState(defaultSettings);
    const [activeTab, setActiveTab] = useState<"GMAIL" | "SMTP">("GMAIL");

    useEffect(() => {
        fetchSettings();
    }, []);

    const toggleKeyVisibility = (field: string) => {
        setShowKeys(prev => ({ ...prev, [field]: !prev[field] }));
    };

    const fetchSettings = async () => {
        try {
            const res = await fetch(apiPath("/settings"));
            const result = await res.json();
            if (result.success) {
                setFormData({
                    ...defaultSettings,
                    ...result.data,
                    gmailAccounts: result.data.gmailAccounts || []
                });
                setActiveTab(result.data.emailProvider || "GMAIL");
            }
        } catch (err) {
            console.error(err);
            toast.error("Network instability detected.");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (dataToSave = formData) => {
        setSaving(true);
        try {
            const res = await fetch(apiPath("/settings"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dataToSave),
            });
            const result = await res.json();

            if (result.success) {
                setFormData(prev => ({ ...prev, ...result.data }));
                setSaved(true);
                toast.success("Configuration persisted successfully.");
                setTimeout(() => setSaved(false), 3000);
                return result.data;
            } else {
                toast.error(result.error?.message || "Database failure.");
            }
        } catch (err) {
            console.error(err);
            toast.error("Network instability detected.");
        } finally {
            setSaving(false);
        }
        return null;
    };

    const handleTestNode = async (type: "GMAIL" | "SMTP", accountId?: string) => {
        const id = accountId || type;
        setNodeTestLoading(id);
        try {
            const res = await fetch(apiPath("/settings/test-dispatch"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nodeType: type, accountId })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Dispatch Verified", {
                    description: `A neural connection test email has been sent to ${session?.user?.email}.`,
                    icon: <Send className="w-4 h-4" />
                });
            } else {
                toast.error("Dispatch Failed", {
                    description: data.error?.message || "Verify your credentials and try again.",
                    icon: <ZapOff className="w-4 h-4" />
                });
            }
        } catch (err) {
            toast.error("Network Error", { description: "Failed to communicate with the dispatch node." });
        } finally {
            setNodeTestLoading(null);
            fetchSettings(); // Refresh status
        }
    };

    const handleTestAI = async () => {
        setTestStatus({ status: 'testing' });
        try {
            const res = await fetch(apiPath(`/test-ai?provider=${formData.aiProvider}`));
            const result = await res.json();
            if (result.success) {
                setTestStatus({ status: 'success' });
                toast.success(`Connected to ${formData.aiProvider}.`);
            } else {
                setTestStatus({ status: 'error' });
                toast.error("Neural link failure.");
            }
        } catch (err) {
            setTestStatus({ status: 'error' });
            toast.error("Network error.");
        } finally {
            setTimeout(() => setTestStatus({ status: 'idle' }), 5000);
        }
    };

    const CredentialInput = ({ label, value, field, placeholder, type = "password" }: { label: string, value: string, field: string, placeholder?: string, type?: string }) => (
        <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-0.5">{label}</label>
            <div className="relative group">
                <input
                    type={type === "password" ? (showKeys[field] ? "text" : "password") : type}
                    value={value}
                    placeholder={placeholder}
                    onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2.5 pr-10 outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-medium text-slate-900 placeholder:text-slate-400 font-mono"
                />
                {type === "password" && (
                    <button
                        type="button"
                        onClick={() => toggleKeyVisibility(field)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        {showKeys[field] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                )}
            </div>
        </div>
    );

    if (loading) return <SmartLoader label="Loading Configuration" description="Reading system node settings..." />;

    return (
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="w-full space-y-8 pb-20 animate-in fade-in duration-500 px-3 sm:px-4 lg:px-6">
            <PageHeader
                title="Configuration"
                subtitle="Manage your system nodes and operational vectors."
                eyebrow="System Settings"
                actions={
                    <>
                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm active:scale-[0.98] flex items-center gap-2"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {saving ? "Saving..." : "Save"}
                        </button>
                        {saved && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 animate-in fade-in slide-in-from-left-2 transition-all">
                                <CheckCircle2 className="w-3 h-3" />
                                Saved
                            </span>
                        )}
                    </>
                }
            />

            <div className="grid gap-6">
                {/* 1. Intelligence Hub */}
                <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm space-y-8">
                    <div className="flex items-center gap-3 pb-4 border-b border-slate-50">
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-slate-600">
                            <Bot className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Intelligence Hub</h3>
                            <p className="text-xs font-medium text-slate-400">Configure AI providers and authorization nodes.</p>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-0.5">Provider</label>
                                    <select
                                        value={formData.aiProvider}
                                        onChange={(e) => setFormData({ ...formData, aiProvider: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2.5 outline-none focus:bg-white focus:border-blue-500 transition-all font-semibold text-slate-700 text-sm"
                                    >
                                        <option value="Groq">Groq Synthesis</option>
                                        <option value="OpenAI">OpenAI Intelligence</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-0.5">Model</label>
                                    <select
                                        value={formData.aiModel}
                                        onChange={(e) => setFormData({ ...formData, aiModel: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2.5 outline-none focus:bg-white focus:border-blue-500 transition-all font-semibold text-slate-700 text-sm"
                                    >
                                        <option value={formData.aiModel}>{formData.aiModel}</option>
                                        {formData.aiProvider === "Groq" && <option value="llama-3.3-70b-versatile">llama-3.3-70b</option>}
                                        {formData.aiProvider === "OpenAI" && <option value="gpt-4o">gpt-4o</option>}
                                    </select>
                                </div>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={handleTestAI}
                                    disabled={testStatus.status === 'testing'}
                                    className={cn(
                                        "text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded-md border transition-all flex items-center gap-2",
                                        testStatus.status === 'success' ? "bg-emerald-50 border-emerald-200 text-emerald-600" :
                                            testStatus.status === 'error' ? "bg-red-50 border-red-200 text-red-600" :
                                                "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 shadow-sm"
                                    )}
                                >
                                    <Zap className={cn("w-3.5 h-3.5", testStatus.status === 'testing' && "animate-pulse")} />
                                    {testStatus.status === 'testing' ? "Testing..." : "Test Connection"}
                                </button>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-6 rounded-lg border border-slate-100 flex flex-col justify-center">
                            {formData.aiProvider === "Groq" ? (
                                <CredentialInput label="Groq Strategic Key" value={formData.groqApiKey} field="groqApiKey" placeholder="gsk_••••••••" />
                            ) : (
                                <CredentialInput label="OpenAI Project Key" value={formData.openaiApiKey} field="openaiApiKey" placeholder="sk-••••••••" />
                            )}
                            <p className="text-[10px] text-slate-400 font-medium mt-3 flex items-center gap-1.5 uppercase tracking-tight italic">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                Encrypted node storage active.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-6 pb-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 tracking-tight">Email Connections</h3>
                                    <p className="text-xs text-slate-500 font-medium">Configure how your outreach emails are delivered.</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-900 uppercase tracking-wider">Auto-Backup (SMTP)</span>
                                    <span className="text-[9px] text-slate-500 font-medium">Switches on failure</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, autoFailover: !formData.autoFailover })}
                                    className={cn(
                                        "w-10 h-5 rounded-full transition-all relative shrink-0",
                                        formData.autoFailover ? "bg-emerald-500" : "bg-slate-300"
                                    )}
                                >
                                    <div className={cn(
                                        "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                                        formData.autoFailover ? "left-6" : "left-1"
                                    )} />
                                </button>
                            </div>
                        </div>

                        <div className="mt-6 flex bg-slate-100/50 p-1 rounded-xl border border-slate-200/60 max-w-sm">
                            <button
                                type="button"
                                onClick={() => setActiveTab("GMAIL")}
                                className={cn(
                                    "flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
                                    activeTab === "GMAIL" ? "bg-white text-blue-600 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                <Mail className="w-3.5 h-3.5" />
                                Gmail
                                {formData.emailProvider === "GMAIL" && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-1" />}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("SMTP")}
                                className={cn(
                                    "flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
                                    activeTab === "SMTP" ? "bg-white text-blue-600 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                <Server className="w-3.5 h-3.5" />
                                Custom SMTP
                                {formData.emailProvider === "SMTP" && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-1" />}
                            </button>
                        </div>
                    </div>


                    <div className="p-8 pt-0">
                        {activeTab === "GMAIL" ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                                {/* Identity List */}
                                <div className="space-y-4">
                                    <div className="flex flex-wrap items-center justify-between px-1 gap-4 border-b border-slate-100 pb-4">
                                        <div className="flex items-center gap-4">
                                            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                                                <Users className="w-4 h-4 text-slate-400" />
                                                Sender Accounts
                                            </h4>
                                            {formData.emailProvider === "GMAIL" ? (
                                                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-md border border-emerald-100">Primary Channel</span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, emailProvider: "GMAIL" })}
                                                    className="text-[10px] font-bold text-blue-600 hover:bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100 transition-all"
                                                >
                                                    Set as Primary
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button 
                                                type="button"
                                                onClick={() => signIn("google", { callbackUrl: "/settings" })}
                                                className="text-xs font-bold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2"
                                            >
                                                <UserPlus className="w-4 h-4" />
                                                Connect Gmail
                                            </button>
                                            <button 
                                                type="button"
                                                disabled={nodeTestLoading !== null}
                                                onClick={() => handleTestNode("GMAIL")}
                                                className="text-xs font-bold text-slate-600 hover:text-blue-600 px-3 py-2 rounded-lg border border-slate-200 hover:border-blue-200 transition-all flex items-center gap-2 disabled:opacity-50"
                                            >
                                                {nodeTestLoading === "GMAIL" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                                Send Test Email
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {formData.gmailAccounts.length > 0 ? (
                                        <div className="grid gap-3">
                                            {formData.gmailAccounts.map((account: any) => (
                                                <div key={account.id} className={cn(
                                                    "flex items-center justify-between p-5 rounded-xl border transition-all relative overflow-hidden group",
                                                    account.isDefault ? "bg-white border-blue-200 shadow-lg shadow-blue-50/50" : "bg-slate-50/50 border-slate-100 opacity-80"
                                                )}>
                                                    <div className="flex items-center gap-4 relative z-10">
                                                        <div className={cn(
                                                            "w-12 h-12 rounded-full flex items-center justify-center border transition-all",
                                                            account.lastStatus === "HEALTHY" 
                                                                ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                                                                : account.lastStatus?.startsWith("ERROR") 
                                                                    ? "bg-red-50 text-red-600 border-red-100 animate-pulse" 
                                                                    : "bg-slate-50 text-slate-400 border-slate-100"
                                                        )}>
                                                            {account.lastStatus === "HEALTHY" ? <ShieldCheck className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-black text-slate-900 uppercase tracking-tight">{account.accountName}</span>
                                                                {account.isDefault && <span className="text-[7px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-full uppercase tracking-widest">Primary</span>}
                                                                {!account.scopeGranted && <span className="text-[7px] font-black bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full uppercase tracking-widest border border-amber-200">Invalid Scope</span>}
                                                            </div>
                                                            <p className="text-[10px] font-bold text-slate-500 font-mono lower">{account.email}</p>
                                                            <div className="flex items-center gap-3 mt-1.5">
                                                                <div className="flex items-center gap-1.5 text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                                                                    <Timer className="w-3 h-3" />
                                                                    Last Used: {account.lastUsed ? new Date(account.lastUsed).toLocaleTimeString() : "Never"}
                                                                </div>
                                                                <div className={cn(
                                                                    "flex items-center gap-1.5 text-[8px] font-black uppercase tracking-tighter",
                                                                    account.lastStatus === "HEALTHY" ? "text-emerald-500" : "text-slate-400"
                                                                )}>
                                                                    <Activity className="w-3 h-3" />
                                                                    Status: {account.lastStatus || "IDLE"}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 relative z-10">
                                                        {!account.isDefault && (
                                                            <button
                                                                type="button"
                                                                onClick={async () => {
                                                                    const res = await fetch(apiPath("/settings/google/default"), {
                                                                        method: "POST", headers: { "Content-Type": "application/json" },
                                                                        body: JSON.stringify({ accountId: account.id })
                                                                    });
                                                                    if ((await res.json()).success) { toast.success("Identity promoted."); fetchSettings(); }
                                                                }}
                                                                className="text-[9px] font-black text-slate-500 hover:text-blue-600 uppercase tracking-widest px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-200 transition-all font-mono"
                                                            >
                                                                [PROMOTE]
                                                            </button>
                                                        )}
                                                        <button
                                                             type="button"
                                                             disabled={nodeTestLoading === account.id}
                                                             onClick={() => handleTestNode("GMAIL", account.id)}
                                                             className="p-2 rounded-lg bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 border border-slate-100 transition-all"
                                                        >
                                                            {nodeTestLoading === account.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-20 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200 group hover:border-blue-300 transition-all cursor-pointer" onClick={() => signIn("google", { callbackUrl: "/settings" })}>
                                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mx-auto mb-4 group-hover:scale-110 transition-transform">
                                                <Mail className="w-8 h-8 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                            </div>
                                            <p className="text-sm font-bold text-slate-900">No accounts connected</p>
                                            <p className="text-xs text-slate-500 mt-1">Click to connect your first Gmail account for outreach.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm relative overflow-hidden group">
                                    <div className="space-y-1 relative z-10">
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-sm font-bold text-slate-900">Custom SMTP Server</h4>
                                            {formData.emailProvider === "SMTP" && (
                                                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded border border-emerald-100">Active</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 font-medium">Use for high-volume delivery nodes (Amazon SES, Postmark, etc.)</p>
                                    </div>
                                    <div className="flex gap-3 relative z-10">
                                        <button
                                            type="button"
                                            disabled={nodeTestLoading === "SMTP"}
                                            onClick={() => handleTestNode("SMTP")}
                                            className="px-4 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold transition-all flex items-center gap-2"
                                        >
                                            {nodeTestLoading === "SMTP" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-slate-400" />}
                                            Test Email
                                        </button>
                                        {formData.emailProvider !== "SMTP" && (
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, emailProvider: "SMTP" })}
                                                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm active:scale-95"
                                            >
                                                Switch to SMTP
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-5 gap-6">
                                    <div className="md:col-span-3 space-y-4">
                                         <CredentialInput label="SMTP HOST" field="smtpHost" value={formData.smtpHost} placeholder="e.g. email-smtp.us-east-1.amazonaws.com" type="text" />
                                    </div>
                                    <div className="md:col-span-1 space-y-4">
                                         <CredentialInput label="NODE PORT" field="smtpPort" value={String(formData.smtpPort)} placeholder="587" type="number" />
                                    </div>
                                    <div className="md:col-span-1 flex items-end">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, smtpSecure: !formData.smtpSecure })}
                                            className={cn(
                                                "w-full h-11 rounded-lg border text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-sm font-mono",
                                                formData.smtpSecure ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-slate-50 border-slate-200 text-slate-400"
                                            )}
                                        >
                                            <Lock className="w-3.5 h-3.5" />
                                            {formData.smtpSecure ? "[ SSL_ON ]" : "[ TLS_ON ]"}
                                        </button>
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-8 items-start">
                                    <div className="space-y-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Key className="w-4 h-4 text-blue-500" />
                                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">ACCESS CREDENTIALS</span>
                                        </div>
                                        <CredentialInput label="Registry Username" field="smtpUser" value={formData.smtpUser} placeholder="Login / IAM User" type="text" />
                                        <CredentialInput label="Access Key / Pass" field="smtpPass" value={formData.smtpPass} placeholder="••••••••••••••••" />
                                    </div>
                                    <div className="space-y-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Smartphone className="w-4 h-4 text-blue-500" />
                                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">SENDER METADATA</span>
                                        </div>
                                        <CredentialInput label="Dispatcher Display Name" field="smtpSenderName" value={formData.smtpSenderName} placeholder="Project Name" type="text" />
                                        <CredentialInput label="Verified From Email" field="smtpSenderEmail" value={formData.smtpSenderEmail} placeholder="hello@company.com" type="text" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* Reset Modal Support */}
            {resetModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 text-amber-600 mb-6 font-mono text-xs uppercase tracking-[0.25em]">
                             <ShieldAlert className="w-5 h-5" />
                             Security Protocol Warning
                        </div>
                        <h3 className="text-lg font-black text-slate-900 mb-2 uppercase tracking-tight leading-none">Flush System Configuration?</h3>
                        <p className="text-sm text-slate-500 font-medium leading-relaxed mb-8">This action will revert all system nodes to their factory baseline. All strategic keys and dispatch identities will be detached.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setResetModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest transition-all">Cancel</button>
                            <button onClick={() => { setFormData(defaultSettings); setResetModalOpen(false); toast.info("Settings reset."); }} className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-200 transition-all active:scale-95">Reset Settings</button>
                        </div>
                    </div>
                </div>
            )}
        </form>
    );
}
