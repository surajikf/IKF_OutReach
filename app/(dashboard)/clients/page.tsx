"use client";

import { useState, useEffect, useRef, useMemo, Fragment, memo } from "react";
import { formatDistanceToNow } from "date-fns";
import { 
    Search, 
    Filter, 
    MoreVertical, 
    Mail, 
    Building2, 
    Calendar, 
    Shield, 
    User, 
    MapPin, 
    ArrowUpDown, 
    Trash2, 
    Edit2,
    Edit3,
    Database,
    MessageSquare,
    AlertCircle,
    X,
    ChevronDown,
    ChevronRight,
    RotateCcw,
    Check,
    AlertTriangle,
    Tag,
    Upload,
    ShieldCheck,
    LogOut,
    UserCircle2,
    DownloadCloud,
    Phone,
    Loader2,
    ShieldAlert,
    Ban
} from "lucide-react";
import { cn } from "@/lib/shared/utils";
import { ClientModal } from "@/components/modals/ClientModal";
import { toast } from "sonner";
import { categorizeEmail, CATEGORIES, CATEGORY_COLORS, EmailCategory } from "@/lib/shared/emailCategorization";
import { motion, AnimatePresence } from "framer-motion";
import { SmartLoader } from "@/components/layout/SmartLoader";
import { apiPath, appPath } from "@/lib/app-path";

const ClientRow = memo(({ contact, index, page, pageSize, onEdit, onDelete, onToggleBlock, isSimpleGmailView = false, showServicesColumn = true, showEngagementColumn = true, showSourceColumn = true }: any) => {
    const isBlocked = contact.isBlocked;
    const source = contact?.source || "MANUAL";
    const isGmail = source === "GMAIL";
    const isInvoice = source === "INVOICE_SYSTEM";
    const isZoho = source === "ZOHO_BIGIN";

    if (isSimpleGmailView) {
        return (
            <motion.tr
                initial={pageSize > 50 ? false : { opacity: 0, y: 5 }}
                animate={pageSize > 50 ? false : { opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.05, 0.5), duration: 0.2 }}
                className={cn(
                    "hover:bg-slate-50/50 transition-all border-l-[3px] border-l-transparent hover:border-l-blue-600 group/row",
                    isBlocked && "opacity-40 grayscale-[0.5]"
                )}
            >
                <td className="px-6 py-5 align-top">
                    <span className="text-sm font-semibold text-slate-800 tracking-tight leading-tight">
                        {contact.contactPerson || "Anonymous Contact"}
                    </span>
                </td>
                <td className="px-6 py-5 align-top">
                    <div className="flex flex-col gap-1">
                        {(contact.email?.split(",") || [])
                            .map((email: string) => email.trim())
                            .filter(Boolean)
                            .map((email: string, idx: number) => (
                                <a
                                    key={idx}
                                    href={`mailto:${email}`}
                                    className="text-[11px] font-bold text-slate-600 hover:text-blue-600 transition-colors truncate max-w-[260px]"
                                >
                                    {email}
                                </a>
                            ))}
                    </div>
                </td>
                <td className="px-6 py-5 align-top" title="Date this contact was last reached via an AI campaign or manual message.">
                    {contact.lastContacted ? (
                        <span className="text-[11px] font-medium text-slate-700">
                            {new Date(contact.lastContacted).toLocaleDateString(undefined, {
                                day: "2-digit",
                                month: "short",
                                year: "numeric"
                            })}
                        </span>
                    ) : (
                        <span className="text-xs font-medium text-slate-400 italic">No outreach yet</span>
                    )}
                </td>
                <td className="px-6 py-5 align-top">
                    <div className="flex items-center gap-1.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                        <button onClick={() => onEdit(contact)} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                            <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => onDelete(contact.id)} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </td>
            </motion.tr>
        );
    }

    return (
        <motion.tr
            initial={pageSize > 50 ? false : { opacity: 0, y: 5 }}
            animate={pageSize > 50 ? false : { opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.05, 0.5), duration: 0.2 }}
            className={cn(
                "hover:bg-slate-50/50 transition-all border-l-[3px] border-l-transparent hover:border-l-blue-600 group/row",
                isBlocked && "opacity-40 grayscale-[0.5]"
            )}
        >
            <td className="px-4 py-5 w-12 text-center text-slate-400 text-xs font-bold align-top">
                <span className="text-slate-500">{(page - 1) * pageSize + index + 1}</span>
            </td>
            <td className="px-6 py-5 align-top">
                <div className="flex items-start gap-4">
                    <div className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base shrink-0 border shadow-sm relative",
                        isBlocked 
                            ? "bg-slate-100 text-slate-400 border-slate-200" 
                            : "bg-gradient-to-br from-blue-50 to-blue-100/50 text-blue-700 border-blue-100/50"
                    )} title="Client Profile Picture">
                        {(contact.contactPerson || contact.email || "?")[0].toUpperCase()}
                        {isBlocked && (
                            <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-slate-200">
                                <Ban className="w-2.5 h-2.5 text-rose-500" />
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-semibold text-slate-800 tracking-tight leading-tight" title="Primary Contact Person">
                                {contact.contactPerson || "Anonymous Contact"}
                            </span>
                            {contact.poc && (
                                <span 
                                    className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100 font-medium cursor-help flex items-center gap-1 shadow-sm" 
                                    title={`Point of Contact: ${contact.poc}. This is your primary internal contact for this account.`}
                                >
                                    <User className="w-2.5 h-2.5" />
                                    {contact.poc}
                                </span>
                            )}
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5" title="Company Entity Name">
                                <Building2 className="w-3 h-3 text-slate-400" />
                                <span className="text-[11px] font-bold text-slate-600 truncate max-w-[200px]">
                                    {contact.clientName || (contact.email ? contact.email.split('@')[0].toUpperCase() : "UNKNOWN ENTITY")}
                                </span>
                            </div>
                            {!isSimpleGmailView && <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <div className="flex items-center gap-1 text-slate-400" title={`Industry: ${contact.industry || "General Business"}`}>
                                    <Tag className="w-2.5 h-2.5" />
                                    <span className="text-[10px] font-medium truncate max-w-[100px]">{contact.industry || "General"}</span>
                                </div>
                                {contact.clientSize && (
                                    <div className="flex items-center gap-1" title={`Operational Scale: ${contact.clientSize}`}>
                                        <span className="text-[9px] opacity-30 mx-0.5">•</span>
                                        <span className="text-[9px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">{contact.clientSize}</span>
                                    </div>
                                )}
                                {contact.clientAddedOn && (
                                    <div className="flex items-center gap-1 text-slate-400" title={`Added to Portfolio: ${new Date(contact.clientAddedOn).toLocaleDateString()}`}>
                                        <span className="text-[9px] opacity-30 mx-0.5">•</span>
                                        <Calendar className="w-2.5 h-2.5" />
                                        <span className="text-[10px] font-medium">{new Date(contact.clientAddedOn).getUTCFullYear()}</span>
                                    </div>
                                )}
                            </div>}
                        </div>
                    </div>
                </div>
            </td>
            {!isSimpleGmailView && showServicesColumn && <td className="px-6 py-5 align-top">
                <div className="flex flex-wrap gap-1.5 items-start justify-start pt-1">
                    {isInvoice ? (
                        contact.invoiceServiceNames ? (
                            <span className="text-[9px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 shadow-sm cursor-help" title="These services are directly detected from your external Invoice System.">
                                {contact.invoiceServiceNames}
                            </span>
                        ) : (
                            <span className="text-xs text-slate-300 italic font-medium">No Services Identified</span>
                        )
                    ) : isGmail ? (
                        <span
                            className="inline-flex items-center text-[9px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200"
                            title="Gmail sync brings contacts and engagement signals. Service mapping is not collected from Gmail."
                        >
                            N/A (Gmail)
                        </span>
                    ) : (
                        <>
                            {contact.services?.map((s: any) => (
                                <span key={s.id} className="text-[9px] font-medium text-blue-700 bg-blue-50/50 px-2 py-0.5 rounded border border-blue-100 shadow-sm" title={`Service Category: ${s.serviceName}`}>
                                    {s.serviceName}
                                </span>
                            ))}
                            {!contact.services?.length && <span className="text-xs text-slate-300 italic font-medium">No Services Identified</span>}
                        </>
                    )}
                </div>
            </td>}
            <td className="px-6 py-5 align-top">
                <div className="flex flex-col gap-2 pt-0.5">
                    <div className="flex flex-col gap-1.5">
                        {(contact.email?.split(',') || []).map((email: string) => email.trim()).filter(Boolean).map((email: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 group/email" title={`Professional Email: ${email}`}>
                                <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                <a
                                    href={`mailto:${email}`}
                                    className="text-[11px] font-bold text-slate-600 hover:text-blue-600 transition-colors truncate max-w-[220px]"
                                >
                                    {email}
                                </a>
                            </div>
                        ))}
                        {(contact.phone || contact.mobile) && (
                            <div className="flex items-center gap-2" title={`Primary Contact: ${[contact.phone, contact.mobile].filter(Boolean).join(" / ")}`}>
                                <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="text-[11px] font-semibold text-slate-500 truncate max-w-[200px]">
                                    {[contact.phone, contact.mobile].filter(Boolean).join(" / ")}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-1.5 mt-1 border-t border-slate-50 pt-1.5">
                        {contact.address && (
                            <div className="flex items-start gap-2 cursor-help" title={`Registered Address: ${contact.address}`}>
                                <MapPin className="w-3 h-3 text-slate-300 shrink-0 mt-0.5" />
                                <span className="text-xs font-medium text-slate-400 leading-tight line-clamp-1 italic">
                                    {contact.address}
                                </span>
                            </div>
                        )}
                        {contact.gstin && (
                            <div className="flex items-center gap-2" title="GST Identification Number (Verified Entity)">
                                <Shield className="w-3 h-3 text-emerald-500 shrink-0" />
                                <span className="text-[10px] font-medium text-slate-400">
                                    {contact.gstin}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </td>
            {!isSimpleGmailView && showEngagementColumn && <td className="px-6 py-5 align-top">
                <div className="flex flex-col gap-3 pt-1">
                    {/* Source-aware engagement display */}
                    <div className="flex flex-col gap-2">
                        {contact.lastInvoiceDate ? (
                            <div className="flex flex-col gap-0.5 group/invoice cursor-help" title={`Latest Transaction detected on ${new Date(contact.lastInvoiceDate).toLocaleString()}. Data synced from Invoice System.`}>
                                <span className="text-[9px] font-medium text-rose-600 opacity-80 group-hover/invoice:opacity-100 transition-opacity">Last Invoice</span>
                                <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700">
                                    <Calendar className="w-3 h-3 text-rose-500" />
                                    {new Date(contact.lastInvoiceDate).toLocaleDateString(undefined, {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric"
                                    })}
                                </span>
                            </div>
                        ) : isInvoice ? (
                            <div className="flex flex-col gap-0.5" title="No invoice history detected in the connected system.">
                                <span className="text-[9px] font-medium text-slate-300">Last Invoice</span>
                                <span className="text-xs font-medium text-slate-300 italic">None Found</span>
                            </div>
                        ) : null}

                        {contact.lastContacted && (
                            <div className="flex flex-col gap-0.5 group/contact cursor-help pt-1 border-t border-slate-50" title={`Last Outreach: ${formatDistanceToNow(new Date(contact.lastContacted), { addSuffix: true })}. This includes AI campaigns or manual messages.`}>
                                <span className="text-[9px] font-medium text-blue-600 opacity-80 group-hover/contact:opacity-100 transition-opacity">Last Contact</span>
                                <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700">
                                    <MessageSquare className="w-3 h-3 text-blue-500" />
                                    {new Date(contact.lastContacted).toLocaleDateString(undefined, {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric"
                                    })}
                                </span>
                            </div>
                        )}

                        {!contact.lastContacted && (
                            <div className="flex flex-col gap-0.5 border-t border-slate-50 pt-1">
                                <span className="text-[9px] font-medium text-slate-300">Last Contact</span>
                                <span className="text-xs font-medium text-slate-300 italic">
                                    {isGmail ? "No outreach yet" : "Never Engaged"}
                                </span>
                            </div>
                        )}

                        {/* Smart Status Badge */}
                        {contact.lastInvoiceDate && (!contact.lastContacted || new Date(contact.lastInvoiceDate) > new Date(contact.lastContacted)) ? (
                            <div className="mt-1">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-50 text-[9px] font-medium text-amber-600 border border-amber-100 animate-pulse" title="Invoice detected after last contact. Client might need outreach.">
                                    Due for Outreach
                                </span>
                            </div>
                        ) : contact.lastContacted ? (
                            <div className="mt-1">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-50 text-[9px] font-medium text-blue-600 border border-blue-100" title="Engagement is up to date relative to transaction history.">
                                    Recently Engaged
                                </span>
                            </div>
                        ) : null}
                    </div>
                </div>
            </td>}
            <td className="px-6 py-5 align-top">
                {isInvoice ? (
                    <div className="flex items-center gap-2 pt-1.5 cursor-help group/status" title={
                        contact.relationshipLevel === "Active" ? "Has recent invoices in the billing system — currently an active paying client." :
                        contact.relationshipLevel === "Not Active" ? "No recent billing activity detected. Consider a re-engagement campaign." :
                        "Billing status unknown."
                    }>
                        <div className={cn(
                            "w-2 h-2 rounded-full transition-transform group-hover/status:scale-125",
                            contact.relationshipLevel === "Active" ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" :
                                "bg-slate-300 shadow-[0_0_8px_rgba(148,163,184,0.3)]"
                        )} />
                        <span className="text-[10px] font-semibold text-slate-700">{contact.relationshipLevel}</span>
                    </div>
                ) : (
                    <span className="text-[10px] text-slate-300 italic">—</span>
                )}
            </td>
            {showSourceColumn && <td className="px-6 py-5 align-top">
                <div className="pt-1">
                    {contact?.source && (
                        <span className="text-[9px] font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded uppercase border border-slate-200">
                            {contact.source.replace("_", " ")}
                        </span>
                    )}
                    {!contact?.source && (
                        <span className="text-[9px] font-medium text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded uppercase border border-slate-200">
                            MAN
                        </span>
                    )}
                    {Array.isArray(contact?.metadata?.importChannels) && contact.metadata.importChannels.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                            {contact.metadata.importChannels.map((channel: string) => {
                                const label =
                                    channel === "gmail_inbox" ? "Gmail Inbox" :
                                    channel === "gmail_sent" ? "Gmail Sent" :
                                    channel === "gmail_label" ? "Gmail Label" :
                                    channel === "google_contacts" ? "Google Contacts" :
                                    channel;
                                return (
                                    <span key={channel} className="text-[9px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                        {label}
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </div>
            </td>}
            <td className="px-6 py-5 align-top text-right">
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity pt-0.5">
                    <button 
                        onClick={() => onToggleBlock(contact)} 
                        className={cn(
                            "w-8 h-8 flex items-center justify-center rounded-lg transition-all",
                            isBlocked ? "text-emerald-600 hover:bg-emerald-50" : "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        )}
                        title={isBlocked ? "Unblock Client" : "Block Client (Exclude from Campaigns)"}
                    >
                        {isBlocked ? <Check className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => onEdit(contact)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                        <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onDelete(contact.id)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </td>
        </motion.tr>
    );
});

ClientRow.displayName = "ClientRow";

export default function ClientManager() {
    const [view, setView] = useState<"clients" | "services">("clients");
    const [activeSourceTab, setActiveSourceTab] = useState<"ALL" | "INVOICE" | "ZOHO" | "GMAIL" | "GOOGLE_CONTACTS">("ALL");
    const [contactTypeTab, setContactTypeTab] = useState<"generic" | "rolebased">("generic");
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);
    const [sourceStats, setSourceStats] = useState<Record<string, any>>({});
    const [filterIndustry, setFilterIndustry] = useState<string[]>([]);
    const [filterLevel, setFilterLevel] = useState<string[]>([]);
    const [filterService, setFilterService] = useState<string[]>([]);
    const [filterSource, setFilterSource] = useState<string[]>([]);
    const [filterStats, setFilterStats] = useState<{
        industries: Record<string, number>;
        levels: Record<string, number>;
        services: Record<string, number>;
    }>({ industries: {}, levels: {}, services: {} });
    const [services, setServices] = useState<any[]>([]);
    const [sortField] = useState<"lastInvoiceDate" | "createdAt">("lastInvoiceDate");
    const [sortDir] = useState<"asc" | "desc">("desc");
    const [clientToDelete, setClientToDelete] = useState<string | null>(null);
    const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);
    const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
    const [editingService, setEditingService] = useState<any>(null);
    const [newServiceData, setNewServiceData] = useState({ serviceName: "", category: "Digital", description: "" });
    const [serviceSearch, setServiceSearch] = useState("");
    const [serviceCategoryFilter, setServiceCategoryFilter] = useState("ALL");
    const [serviceSort, setServiceSort] = useState<"name_asc" | "name_desc" | "category">("name_asc");

    const abortControllerRef = useRef<AbortController | null>(null);
    const initialLoadRef = useRef(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<any>(null);

    useEffect(() => {
        const init = async () => {
            console.log("🎬 Component mount init");
            await fetchServices();
            await fetchClients();
            initialLoadRef.current = false;
        };
        init();
    }, []);

    useEffect(() => {
        if (!initialLoadRef.current) {
            if (view === "services") return;
            console.log("🔄 Filter update trigger");
            fetchClients();
        }
    }, [filterIndustry, filterLevel, filterService, filterSource, view, page, pageSize, search, contactTypeTab]);

    const fetchServices = async () => {
        try {
            const res = await fetch(apiPath("/services"));
            const result = await res.json();
            if (result.success) {
                setServices(result.data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchClients = async () => {
        console.log("🚀 fetchClients triggered");
        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();
        setLoading(true);
        try {
            const query = new URLSearchParams();
            filterIndustry.forEach(v => query.append("industry", v));
            filterLevel.forEach(v => query.append("level", v));
            filterService.forEach(v => query.append("service", v));
            filterSource.forEach(v => query.append("source", v));
            query.append("roleBased", contactTypeTab === "rolebased" ? "true" : "false");
            if (search) query.append("search", search);
            query.append("page", String(page));
            query.append("pageSize", String(pageSize));
            query.append("sortField", sortField);
            query.append("sortDir", sortDir);

            const res = await fetch(apiPath(`/clients?${query.toString()}`), { signal: abortControllerRef.current.signal });
            const contentType = res.headers.get("content-type") || "";
            let result: any = null;
            if (contentType.includes("application/json")) {
                result = await res.json();
            } else {
                const text = await res.text().catch(() => "");
                throw new Error(text || `Unexpected response (${res.status})`);
            }
            
            if (res.ok && result?.success) {
                const { clients: fetchedClients, total: fetchedTotal, sourceStats: fetchedSourceStats, filterStats: fetchedFilterStats } = result.data;
                setClients(fetchedClients || []);
                setTotal(fetchedTotal || 0);
                setSourceStats(fetchedSourceStats || {});
                if (fetchedFilterStats) setFilterStats(fetchedFilterStats);
            } else {
                const rawError = result?.error;
                const errorCode = typeof rawError?.code === "string" ? rawError.code : "";
                const detailText =
                    typeof rawError?.details === "string"
                        ? rawError.details
                        : rawError?.details?.message || rawError?.details?.reason || "";
                const apiMessage =
                    result?.error?.message ||
                    result?.message ||
                    detailText ||
                    `Failed to load clients (${res.status}${res.statusText ? ` ${res.statusText}` : ""})`;
                const normalizedError = {
                    code: errorCode || "UNKNOWN_ERROR",
                    message: apiMessage,
                    status: res.status,
                };
                console.error("API Error:", normalizedError, { raw: result });
                toast.error(apiMessage);
                setClients([]);
                setTotal(0);
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.error(err);
                toast.error(err?.message || "Failed to load clients.");
            }
        } finally {
            setLoading(false);
        }
    };

    const confirmDelete = async () => {
        if (!clientToDelete) return;
        try {
            const res = await fetch(apiPath(`/clients/${clientToDelete}`), { method: "DELETE" });
            const result = await res.json();
            if (result.success) {
                toast.success("Entity removed from the database.");
                fetchClients();
            } else {
                toast.error(result.error?.message || "Failed to remove entity.");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setClientToDelete(null);
        }
    };

    const handleServiceSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = editingService ? `/api/services/${editingService.id}` : "/api/services";
            const method = editingService ? "PUT" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newServiceData),
            });
            if (res.ok) {
                toast.success(editingService ? "Service record recalibrated." : "New service record integrated.");
                fetchServices();
                setIsServiceModalOpen(false);
                setEditingService(null);
                setNewServiceData({ serviceName: "", category: "Digital", description: "" });
            } else {
                const data = await res.json();
                toast.error(data.error?.message || data.error || "Failed to sync service record.");
            }
        } catch (err) {
            console.error(err);
            toast.error("Transmission failure during service sync.");
        }
    };

    const confirmServiceDelete = async () => {
        if (!serviceToDelete) return;
        try {
            const res = await fetch(apiPath(`/services/${serviceToDelete}`), { method: "DELETE" });
            if (res.ok) {
                toast.success("Service record purged.");
                fetchServices();
                fetchClients(); // Update client tags
            }
        } catch (err) {
            console.error(err);
        } finally {
            setServiceToDelete(null);
        }
    };

    const handleEdit = (client: any) => {
        setSelectedClient(client);
        setIsModalOpen(true);
    };

    const handleToggleBlock = async (client: any) => {
        const newStatus = !client.isBlocked;
        try {
            const res = await fetch(apiPath(`/clients/${client.id}/block`), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isBlocked: newStatus }),
            });
            const result = await res.json();
            if (result.success) {
                toast.success(newStatus ? "Client blocked from campaigns." : "Client reinstated.");
                fetchClients();
            } else {
                toast.error(result.error?.message || "Failed to update status.");
                console.error("BLOCK UPDATE CRITICAL ERROR:", result.error);
                if (result.error?.details) {
                    console.error("DETAILS:", JSON.stringify(result.error.details, null, 2));
                }
            }
        } catch (err) {
            console.error(err);
            toast.error("Transmission failure.");
        }
    };

    const filteredClients = useMemo(() => {
        const priority: Record<string, number> = {
            "Active": 0,
            "Warm Lead": 1,
            "Past Client": 2,
            "Not Active": 3,
        };

        return [...clients].sort((a, b) => {
            const aInvoiceTs = a?.lastInvoiceDate ? new Date(a.lastInvoiceDate).getTime() : 0;
            const bInvoiceTs = b?.lastInvoiceDate ? new Date(b.lastInvoiceDate).getTime() : 0;
            const aContactTs = a?.lastContacted ? new Date(a.lastContacted).getTime() : 0;
            const bContactTs = b?.lastContacted ? new Date(b.lastContacted).getTime() : 0;

            const aIsDue = aInvoiceTs > 0 && (aContactTs === 0 || aInvoiceTs > aContactTs);
            const bIsDue = bInvoiceTs > 0 && (bContactTs === 0 || bInvoiceTs > bContactTs);

            // 1) Bubble actionable rows first.
            if (aIsDue !== bIsDue) return aIsDue ? -1 : 1;

            // 2) Within same action state, keep most recently contacted at top.
            if (aContactTs !== bContactTs) return bContactTs - aContactTs;

            // 3) Then apply relationship-level priority.
            const aPriority = priority[a?.relationshipLevel] ?? 99;
            const bPriority = priority[b?.relationshipLevel] ?? 99;
            if (aPriority !== bPriority) return aPriority - bPriority;

            // 4) Final tie-breaker by latest invoice recency.
            if (aInvoiceTs !== bInvoiceTs) return bInvoiceTs - aInvoiceTs;
            return 0;
        });
    }, [clients]);
    const levels = ["Active", "Warm Lead", "Past Client", "Not Active"];

    const toggleFilter = (setter: any, current: string[], value: string) => {
        if (current.includes(value)) {
            setter(current.filter(v => v !== value));
        } else {
            setter([...current, value]);
        }
    };

    const clearAllFilters = () => {
        setSearch("");
        setFilterIndustry([]);
        setFilterLevel([]);
        setFilterService([]);
        setFilterSource([]);
        setActiveSourceTab("ALL");
        setPage(1);
    };

    const handleSourceTab = (tab: "ALL" | "INVOICE" | "ZOHO" | "GMAIL" | "GOOGLE_CONTACTS") => {
        setActiveSourceTab(tab);
        setContactTypeTab("generic");
        setPage(1);
        if (tab === "ALL") setFilterSource([]);
        else if (tab === "INVOICE") setFilterSource(["INVOICE_SYSTEM"]);
        else if (tab === "ZOHO") setFilterSource(["ZOHO_BIGIN"]);
        else if (tab === "GMAIL") setFilterSource(["GMAIL"]);
        else if (tab === "GOOGLE_CONTACTS") setFilterSource(["GOOGLE_CONTACTS"]);
    };

    const activeFilterCount = filterIndustry.length + filterLevel.length + filterService.length + filterSource.length;
    const hasAnyGmailRows = filteredClients.some((c) => c?.source === "GMAIL");
    const isAutoGmailOnlyDataset = filteredClients.length > 0 && filteredClients.every((c) => c?.source === "GMAIL");
    const isSimpleGmailView =
        (filterSource.length === 1 && (filterSource[0] === "GMAIL" || filterSource[0] === "GOOGLE_CONTACTS")) ||
        isAutoGmailOnlyDataset;
    const hasAnyInvoiceRows = filteredClients.some((c) => c?.source === "INVOICE_SYSTEM");
    const isAutoInvoiceOnlyDataset = filteredClients.length > 0 && filteredClients.every((c) => c?.source === "INVOICE_SYSTEM");
    const isInvoiceFocusedView = (filterSource.length === 1 && filterSource[0] === "INVOICE_SYSTEM") || isAutoInvoiceOnlyDataset;
    const showServicesColumn = !isSimpleGmailView && isInvoiceFocusedView && hasAnyInvoiceRows;
    const showEngagementColumn = activeSourceTab !== "GMAIL" && activeSourceTab !== "GOOGLE_CONTACTS";
    const showSourceColumn = activeSourceTab === "ALL";
    const tableColumnCount = isSimpleGmailView ? 5 : (showServicesColumn ? 8 : 7) - (showEngagementColumn ? 0 : 1) - (showSourceColumn ? 0 : 1);
    const gmailRowsWithoutInvoiceServices = filteredClients.filter((c) => c?.source === "GMAIL").length;
    const outreachDueCount = filteredClients.filter((c) =>
        c?.lastInvoiceDate && (!c?.lastContacted || new Date(c.lastInvoiceDate) > new Date(c.lastContacted))
    ).length;

    const stats = useMemo(() => {
        const total = clients.length;
        const active = clients.filter(c => c.relationshipLevel === "Active").length;
        const warm = clients.filter(c => c.relationshipLevel === "Warm Lead").length;
        const due = clients.filter(c => 
            c.lastInvoiceDate && (!c.lastContacted || new Date(c.lastInvoiceDate) > new Date(c.lastContacted))
        ).length;

        return [
            { label: "Total Portfolio", value: total, icon: Database, color: "text-slate-600", bg: "bg-slate-50" },
            { label: "Active Clients", value: active, icon: Shield, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Warm Leads", value: warm, icon: Tag, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Outreach Due", value: due, icon: AlertCircle, color: "text-rose-600", bg: "bg-rose-50" },
        ];
    }, [clients]);

    const serviceCategories = useMemo(() => {
        const categories = Array.from(
            new Set(
                services
                    .map((service: any) => service?.category?.trim())
                    .filter((category: string | undefined): category is string => !!category)
            )
        ).sort((a, b) => a.localeCompare(b));
        return ["ALL", ...categories];
    }, [services]);

    const filteredServices = useMemo(() => {
        const query = serviceSearch.trim().toLowerCase();
        const byText = (services || []).filter((service: any) => {
            if (!query) return true;
            const name = String(service?.serviceName || "").toLowerCase();
            const desc = String(service?.description || "").toLowerCase();
            const category = String(service?.category || "").toLowerCase();
            return name.includes(query) || desc.includes(query) || category.includes(query);
        });

        const byCategory =
            serviceCategoryFilter === "ALL"
                ? byText
                : byText.filter((service: any) => service?.category === serviceCategoryFilter);

        return [...byCategory].sort((a: any, b: any) => {
            if (serviceSort === "category") {
                return String(a?.category || "").localeCompare(String(b?.category || ""));
            }
            if (serviceSort === "name_desc") {
                return String(b?.serviceName || "").localeCompare(String(a?.serviceName || ""));
            }
            return String(a?.serviceName || "").localeCompare(String(b?.serviceName || ""));
        });
    }, [services, serviceSearch, serviceCategoryFilter, serviceSort]);

    const servicesWithoutDescription = useMemo(
        () => filteredServices.filter((service: any) => !String(service?.description || "").trim()).length,
        [filteredServices]
    );

    const FilterPopover = ({ label, options, selected, onToggle, icon: Icon, stats }: any) => {
        const [isOpen, setIsOpen] = useState(false);
        const [optSearch, setOptSearch] = useState("");
        const popoverRef = useRef<HTMLDivElement>(null);

        useEffect(() => {
            const handleClickOutside = (event: MouseEvent) => {
                if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                    setIsOpen(false);
                }
            };
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }, []);

        const filteredOptions = options.filter((opt: any) => {
            const display = typeof opt === 'string' ? opt : opt.label;
            return display.toLowerCase().includes(optSearch.toLowerCase());
        });

        return (
            <div className="relative" ref={popoverRef}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-300 border",
                        selected.length > 0
                            ? "bg-blue-600 text-white border-blue-500 shadow-[0_4px_12px_rgba(37,99,235,0.2)]"
                            : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-sm"
                    )}
                >
                    {Icon && <Icon className={cn("w-3.5 h-3.5", selected.length > 0 ? "text-white" : "text-slate-400")} />}
                    <span>{label}</span>
                    {selected.length > 0 && (
                        <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[9px] font-semibold bg-white text-blue-600 rounded-lg shadow-sm">
                            {selected.length}
                        </span>
                    )}
                    <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-300", isOpen && "rotate-180")} />
                </button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.95 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="absolute z-50 mt-2 w-72 bg-white/95 backdrop-blur-2xl border border-slate-200 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] p-2 top-full right-0 md:left-0 origin-top-left"
                        >
                            {/* Option Search */}
                            <div className="px-2 pb-2 pt-1 border-b border-slate-100/50 mb-2">
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100 focus-within:border-blue-300 transition-all">
                                    <Search className="w-3.5 h-3.5 text-slate-400" />
                                    <input 
                                        type="text" 
                                        placeholder={`Find ${label.toLowerCase()}...`}
                                        className="bg-transparent border-none outline-none text-xs font-bold text-slate-600 w-full placeholder:text-slate-300"
                                        value={optSearch}
                                        onChange={(e) => setOptSearch(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 pr-1">
                                {filteredOptions.length === 0 ? (
                                    <div className="py-8 text-center px-4">
                                        <p className="text-xs font-medium text-slate-300 leading-relaxed">No matching<br/>entries found</p>
                                    </div>
                                ) : (
                                    filteredOptions.map((opt: any) => {
                                        const value = typeof opt === 'string' ? opt : opt.value;
                                        const display = typeof opt === 'string' ? opt : opt.label;
                                        const isSelected = selected.includes(value);
                                        const count = stats?.[value] || 0;

                                        return (
                                            <button
                                                key={value}
                                                onClick={() => onToggle(value)}
                                                className={cn(
                                                    "w-full flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-bold transition-all mb-1 group/item",
                                                    isSelected
                                                        ? "bg-blue-50 text-blue-700 shadow-sm"
                                                        : "text-slate-600 hover:bg-slate-50"
                                                )}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className={cn(
                                                        "w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0",
                                                        isSelected 
                                                            ? "bg-blue-600 border-blue-600 shadow-[0_2px_8px_rgba(37,99,235,0.3)]" 
                                                            : "bg-white border-slate-300 group-hover/item:border-blue-400"
                                                    )}>
                                                        {isSelected && <Check className="w-3 h-3 text-white stroke-[3px]" />}
                                                    </div>
                                                    <span className="truncate">{display}</span>
                                                </div>
                                                {count > 0 && (
                                                    <span className={cn(
                                                        "text-[9px] font-medium px-1.5 py-0.5 rounded-md min-w-[20px] text-center transition-colors",
                                                        isSelected ? "bg-white text-blue-600" : "bg-slate-100 text-slate-400 group-hover/item:bg-blue-50 group-hover/item:text-blue-500"
                                                    )}>
                                                        {count}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                            
                            {selected.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between px-2 pb-1">
                                    <p className="text-[10px] font-medium text-slate-400">{selected.length} Selected</p>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); selected.forEach((v: string) => onToggle(v)); }}
                                        className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 p-1"
                                    >
                                        Clear
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    return (
        <div className="space-y-4 w-full max-w-[100vw] px-3 md:px-5 lg:px-6 pb-16">
            {/* Single compact header row */}
            <div className="flex items-center justify-between gap-4 px-2 py-1">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-semibold text-slate-900 shrink-0">
                        {view === "clients" ? "Portfolio" : "Capabilities"}
                    </h2>
                    {view === "clients" && (
                        <>
                            <div className="w-px h-5 bg-slate-200" />
                            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                        {(["ALL", "INVOICE", "ZOHO", "GMAIL", "GOOGLE_CONTACTS"] as const).map((tab) => {
                            const tabLabels: Record<string, string> = { ALL: "All Clients", INVOICE: "Invoice", ZOHO: "Zoho Bigin", GMAIL: "Gmail", GOOGLE_CONTACTS: "Google Contacts" };
                            const tabColors: Record<string, string> = {
                                ALL: "text-slate-700",
                                INVOICE: "text-indigo-600",
                                ZOHO: "text-[#E42527]",
                                GMAIL: "text-[#EA4335]",
                                GOOGLE_CONTACTS: "text-[#34A853]",
                            };
                            const sourceKey = tab === "INVOICE" ? "INVOICE_SYSTEM" : tab === "ZOHO" ? "ZOHO_BIGIN" : tab;
                            const statEntry = sourceStats[sourceKey];
                            const count = tab === "ALL" ? Object.values(sourceStats).reduce((a: any, b: any) => a + (b?.total || 0), 0) : (statEntry?.total ?? null);
                            const genericCount = tab === "ALL" ? Object.values(sourceStats).reduce((a: any, b: any) => a + (b?.generic || 0), 0) : (statEntry?.generic ?? null);
                            const roleBasedCount = tab === "ALL" ? Object.values(sourceStats).reduce((a: any, b: any) => a + (b?.roleBased || 0), 0) : (statEntry?.roleBased ?? null);
                            // Show breakdown only when role-based contacts exist — badge format: generic/roleBased
                            const hasRoleBased = roleBasedCount !== null && roleBasedCount > 0;
                            const showBreakdown = genericCount !== null && roleBasedCount !== null && (genericCount > 0 || roleBasedCount > 0);
                            const badgeTooltip = showBreakdown
                                ? hasRoleBased
                                    ? `${genericCount} Generic contacts · ${roleBasedCount} Role-Based contacts\n${count} total`
                                    : `${genericCount} contacts (all generic)`
                                : undefined;
                            const isActive = activeSourceTab === tab;
                            const TabIcon = () => {
                                if (tab === "ALL") return <Database className="w-3.5 h-3.5 shrink-0" />;
                                if (tab === "INVOICE") return <DownloadCloud className="w-3.5 h-3.5 shrink-0 text-indigo-500" />;
                                if (tab === "ZOHO") return (
                                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="128" cy="128" r="128" fill="#E42527"/>
                                        <path d="M60 88h88L60 168v16h136v-24h-88l88-80V72H60z" fill="#fff"/>
                                    </svg>
                                );
                                if (tab === "GMAIL") return (
                                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M6 18V8.4L12 13l6-4.6V18H6zm0-11.6L12 11l6-4.6V6a.6.6 0 0 0-.6-.6H6.6A.6.6 0 0 0 6 6v.4z" fill="#EA4335"/>
                                        <path d="M18 18V6.6L12 11 6 6.6V18h12z" fill="#FBBC05" opacity=".2"/>
                                        <path d="M2 5.6C2 4.16 3.16 3 4.6 3H6v2.4L12 10l6-4.6V3h1.4C20.84 3 22 4.16 22 5.6V18.4c0 1.44-1.16 2.6-2.6 2.6H4.6C3.16 21 2 19.84 2 18.4V5.6z" fill="none"/>
                                        <path d="M2 6l10 7.5L22 6" stroke="#EA4335" strokeWidth="2" fill="none"/>
                                        <path d="M2 6v12.4C2 19.84 3.16 21 4.6 21h14.8C20.84 21 22 19.84 22 18.4V6L12 13.5 2 6z" fill="#EA4335"/>
                                        <path d="M4.6 3H6v.9L12 8.5l6-4.6V3h1.4C20.84 3 22 4.16 22 5.6V6L12 13.5 2 6v-.4C2 4.16 3.16 3 4.6 3z" fill="#C5221F"/>
                                    </svg>
                                );
                                if (tab === "GOOGLE_CONTACTS") return (
                                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M24 24c4.97 0 9-4.03 9-9s-4.03-9-9-9-9 4.03-9 9 4.03 9 9 9zm0 4.5c-6.01 0-18 3.01-18 9V42h36v-4.5c0-5.99-11.99-9-18-9z" fill="#34A853"/>
                                        <path d="M36 6v6h-6v4h6v6h4v-6h6v-4h-6V6z" fill="#1A73E8"/>
                                    </svg>
                                );
                                return null;
                            };
                            return (
                                <button
                                    key={tab}
                                    onClick={() => handleSourceTab(tab)}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                                        isActive
                                            ? "bg-white shadow-sm " + tabColors[tab]
                                            : "text-slate-500 hover:text-slate-700"
                                    )}
                                >
                                    <TabIcon />
                                    {tabLabels[tab]}
                                    {count !== null && count > 0 && (
                                        <span
                                            title={badgeTooltip}
                                            className={cn(
                                                "text-[10px] font-bold px-1.5 py-0.5 rounded-full cursor-default",
                                                isActive ? "bg-slate-100" : "bg-slate-200 text-slate-500"
                                            )}
                                        >
                                            {showBreakdown ? `${genericCount}/${roleBasedCount}` : count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                            </div>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <div className="bg-slate-100 p-1 rounded-lg flex items-center gap-1">
                        {(["clients", "services"] as const).map((v) => (
                            <button key={v} onClick={() => setView(v)} className={cn("text-xs font-semibold px-3 py-1.5 rounded-md transition-all", view === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
                                {v === "clients" ? "Clients" : "Services"}
                            </button>
                        ))}
                    </div>
                    {view === "services" && (
                        <button onClick={() => { setEditingService(null); setNewServiceData({ serviceName: "", category: "Digital", description: "" }); setIsServiceModalOpen(true); }} className="bg-slate-900 text-white px-4 py-1.5 rounded-md text-xs font-semibold hover:bg-slate-800 transition-colors shadow-sm">
                            Add Service
                        </button>
                    )}
                </div>
            </div>

            {view === "clients" ? (
                <>
                    <div className="sticky top-3 z-40 flex flex-col gap-2.5 bg-white/80 backdrop-blur-xl p-4 rounded-2xl border border-slate-200/50 shadow-[0_4px_20px_rgb(0,0,0,0.04)] transition-all">
                    <div className="flex flex-wrap items-center gap-4">
                            <div className="flex flex-1 min-w-[200px] items-center gap-3 px-4 py-2.5 bg-slate-100/50 rounded-2xl group focus-within:bg-white border border-transparent focus-within:border-blue-500/30 focus-within:ring-4 focus-within:ring-blue-50/50 transition-all duration-500">
                                <Search className="w-5 h-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Search by company, industry, or email..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="bg-transparent border-none outline-none text-xs w-full placeholder:text-slate-400 font-bold text-slate-900"
                                />
                                {search && (
                                    <button onClick={() => setSearch("")} className="p-1 hover:bg-slate-200 rounded-lg transition-colors">
                                        <X className="w-4 h-4 text-slate-400" />
                                    </button>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <FilterPopover
                                    label="Relationship"
                                    options={levels}
                                    selected={filterLevel}
                                    onToggle={(val: string) => toggleFilter(setFilterLevel, filterLevel, val)}
                                    icon={Shield}
                                />
                                <FilterPopover
                                    label="Source"
                                    options={[
                                        { label: "Zoho", value: "ZOHO_BIGIN" },
                                        { label: "Gmail", value: "GMAIL" },
                                        { label: "Google Contacts", value: "GOOGLE_CONTACTS" },
                                        { label: "Invoice", value: "INVOICE_SYSTEM" },
                                    ]}
                                    selected={filterSource}
                                    onToggle={(val: string) => toggleFilter(setFilterSource, filterSource, val)}
                                    icon={Database}
                                />

                                {activeFilterCount > 0 && (
                                    <button
                                        onClick={clearAllFilters}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-all group border border-transparent hover:border-rose-100"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5 group-hover:rotate-[-180deg] transition-transform duration-500" />
                                        Reset
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Filter Chips */}
                        <AnimatePresence>
                            {activeFilterCount > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="flex flex-wrap gap-2 pt-2 border-t border-slate-100"
                                >
                                    {filterIndustry.map(val => (
                                        <span key={val} className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-bold border border-blue-100 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                                            {val}
                                            <button onClick={() => toggleFilter(setFilterIndustry, filterIndustry, val)} className="p-0.5 hover:bg-blue-100 rounded-full"><X className="w-3 h-3" /></button>
                                        </span>
                                    ))}
                                    {filterService.map(val => {
                                        const s = services.find(srv => srv.id === val);
                                        return (
                                            <span key={val} className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold border border-emerald-100 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                                                {s?.serviceName}
                                                <button onClick={() => toggleFilter(setFilterService, filterService, val)} className="p-0.5 hover:bg-emerald-100 rounded-full"><X className="w-3 h-3" /></button>
                                            </span>
                                        );
                                    })}
                                    {filterLevel.map(val => (
                                        <span key={val} className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 text-orange-700 rounded-full text-[10px] font-bold border border-orange-100 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                                            {val}
                                            <button onClick={() => toggleFilter(setFilterLevel, filterLevel, val)} className="p-0.5 hover:bg-orange-100 rounded-full"><X className="w-3 h-3" /></button>
                                        </span>
                                    ))}
                                    {filterSource.map(val => (
                                        <span key={val} className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-[10px] font-bold border border-slate-200 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                                            {val}
                                            <button onClick={() => toggleFilter(setFilterSource, filterSource, val)} className="p-0.5 hover:bg-slate-200 rounded-full"><X className="w-3 h-3" /></button>
                                        </span>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="bg-white overflow-hidden rounded-3xl border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-sm">
                        {activeSourceTab === "GMAIL" && (
                            <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
                                <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <p className="text-[11px] font-semibold text-blue-800">
                                    Showing Gmail contacts only — invoice and services data are not available for this source.
                                </p>
                            </div>
                        )}
                        {activeSourceTab === "ALL" && outreachDueCount > 0 && (
                            <div className="px-6 py-3 bg-amber-50/70 border-b border-amber-100">
                                <p className="text-[11px] font-semibold text-amber-800">
                                    {outreachDueCount} client{outreachDueCount !== 1 ? "s" : ""} {outreachDueCount !== 1 ? "are" : "is"} due for outreach — invoice detected after last contact.
                                </p>
                            </div>
                        )}
                        {/* Generic / Role-Based contact type sub-tabs */}
                        <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-100 bg-white">
                            {(["generic", "rolebased"] as const).map((t) => (
                                <button
                                    key={t}
                                    onClick={() => { setContactTypeTab(t); setPage(1); }}
                                    className={cn(
                                        "text-[11px] font-semibold px-3 py-1.5 rounded-md transition-all",
                                        contactTypeTab === t
                                            ? "bg-slate-900 text-white"
                                            : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                                    )}
                                >
                                    {t === "generic" ? "Generic Contacts" : "Role-Based Contacts"}
                                </button>
                            ))}
                        </div>
                        <table className="w-full text-left border-collapse overflow-hidden min-w-[780px]">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] sm:text-[11px]">
                                    {isSimpleGmailView ? (
                                        <>
                                            <th className="px-4 py-4 font-medium text-slate-400 w-[28%]">Name</th>
                                            <th className="px-4 py-4 font-medium text-slate-400 w-[35%]">Email</th>
                                            <th className="px-4 py-4 font-medium text-slate-400 w-[32%]" title="Date this contact was last reached via an AI campaign or manual message.">Last Outreach</th>
                                            <th className="px-4 py-4 w-14"></th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="px-3 py-4 font-medium text-slate-400 w-10 text-center">Sr.</th>
                                            <th className="px-4 py-4 font-medium text-slate-400 w-[30%]">Client Profile</th>
                                            {showServicesColumn && <th className="px-4 py-4 font-medium text-slate-400 w-[14%]">Services</th>}
                                            <th className="px-4 py-4 font-medium text-slate-400 w-[18%]">Contact Info</th>
                                            {activeSourceTab !== "GMAIL" && <th className="px-4 py-4 font-medium text-slate-400 w-[13%]">Engagement</th>}
                                            <th className="px-4 py-4 font-medium text-slate-400 w-[10%]" title="Billing relationship level synced from Invoice System. Active = recent invoices found. Not Active = no recent billing activity.">Relationship</th>
                                            {activeSourceTab === "ALL" && <th className="px-4 py-4 font-medium text-slate-400 w-[9%]">Source</th>}
                                            <th className="px-4 py-4 text-right w-16"></th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 bg-white">
                                {loading ? (
                                    [...Array(6)].map((_, i) => (
                                        <tr key={i} className="animate-pulse border-b border-slate-50">
                                            <td className="px-6 py-8" colSpan={tableColumnCount}>
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-xl bg-slate-50" />
                                                    <div className="space-y-2">
                                                        <div className="h-4 bg-slate-50 rounded w-48" />
                                                        <div className="h-3 bg-slate-50 rounded w-24" />
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : filteredClients.length === 0 ? (
                                    <tr>
                                        <td colSpan={tableColumnCount} className="px-8 py-24 text-center">
                                            <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
                                                <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
                                                    <Search className="w-6 h-6" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-slate-700 font-semibold tracking-tight">No clients match your current view.</p>
                                                    <p className="text-slate-400 text-sm">
                                                        Adjust filters, import from your systems, or add a client manually to get started.
                                                    </p>
                                                </div>
                                                <div className="flex flex-wrap items-center justify-center gap-3">
                                                    <button
                                                        onClick={clearAllFilters}
                                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200"
                                                    >
                                                        <RotateCcw className="w-3.5 h-3.5" />
                                                        Clear Filters
                                                    </button>
                                                    <button
                                                        onClick={() => { window.location.href = appPath("/import"); }}
                                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200"
                                                    >
                                                        <Upload className="w-3.5 h-3.5" />
                                                        Go to Integrations
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredClients.map((contact, index) => (
                                        <ClientRow
                                            key={contact.id}
                                            contact={contact}
                                            index={index}
                                            page={page}
                                            pageSize={pageSize}
                                            onEdit={handleEdit}
                                            onDelete={(id: string) => setClientToDelete(id)}
                                            onToggleBlock={handleToggleBlock}
                                            isSimpleGmailView={isSimpleGmailView}
                                            showServicesColumn={showServicesColumn}
                                            showEngagementColumn={activeSourceTab !== "GMAIL"}
                                            showSourceColumn={activeSourceTab === "ALL"}
                                        />
                                    ))
                                )}
                            </tbody>
                        </table>



                        {/* Pagination footer */}
                        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50">
                            <div className="text-[11px] text-slate-500">
                                {total > 0 && (
                                    <span>
                                        Showing{" "}
                                        <span className="font-semibold">
                                            {(page - 1) * pageSize + 1}-
                                            {Math.min(page * pageSize, total)}
                                        </span>{" "}
                                        of <span className="font-semibold">{total}</span> clients
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                    <span>Rows:</span>
                                    <select
                                        value={pageSize}
                                        onChange={(e) => {
                                            setPageSize(Number(e.target.value));
                                            setPage(1);
                                        }}
                                        className="bg-white border border-slate-200 rounded-md px-2 py-1 text-[11px]"
                                    >
                                        {[10, 25, 50, 100, 200, 500].map(size => (
                                            <option key={size} value={size}>{size}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setPage(p => Math.max(p - 1, 1))}
                                        disabled={page === 1 || loading}
                                        className="px-2 py-1 text-[11px] rounded-md border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100"
                                    >
                                        Prev
                                    </button>
                                    <span className="text-[11px] text-slate-500">
                                        Page <span className="font-semibold">{page}</span>
                                        {total > 0 && (
                                            <> of {Math.max(1, Math.ceil(total / pageSize))}</>
                                        )}
                                    </span>
                                    <button
                                        onClick={() => {
                                            const maxPage = total > 0 ? Math.ceil(total / pageSize) : page;
                                            setPage(p => Math.min(p + 1, maxPage));
                                        }}
                                        disabled={loading || (total > 0 && page >= Math.ceil(total / pageSize))}
                                        className="px-2 py-1 text-[11px] rounded-md border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>

                        <AnimatePresence>
                            {loading && (
                                <SmartLoader label="Syncing Database" description="Optimizing client view..." />
                            )}
                        </AnimatePresence>
                    </div>
                </>
            ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="sticky top-3 z-30 flex flex-col gap-3 bg-white/90 backdrop-blur-xl p-4 rounded-2xl border border-slate-200/60 shadow-[0_4px_20px_rgb(0,0,0,0.04)]">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex-1 min-w-[220px] flex items-center gap-3 px-4 py-2.5 bg-slate-100/50 rounded-xl border border-transparent focus-within:bg-white focus-within:border-blue-500/30 focus-within:ring-4 focus-within:ring-blue-50/50 transition-all">
                                <Search className="w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={serviceSearch}
                                    onChange={(e) => setServiceSearch(e.target.value)}
                                    placeholder="Search service name, category, or description..."
                                    className="w-full bg-transparent border-none outline-none text-xs font-semibold text-slate-900 placeholder:text-slate-400"
                                />
                                {serviceSearch && (
                                    <button
                                        type="button"
                                        aria-label="Clear service search"
                                        onClick={() => setServiceSearch("")}
                                        className="p-1 rounded-md text-slate-400 hover:bg-slate-200"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl">
                                    <Tag className="w-3.5 h-3.5 text-slate-400" />
                                    <select
                                        value={serviceCategoryFilter}
                                        onChange={(e) => setServiceCategoryFilter(e.target.value)}
                                        className="bg-transparent text-xs font-semibold text-slate-700 outline-none pr-1"
                                        aria-label="Filter services by category"
                                    >
                                        {serviceCategories.map((category) => (
                                            <option key={category} value={category}>
                                                {category === "ALL" ? "All Categories" : category}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl">
                                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                                    <select
                                        value={serviceSort}
                                        onChange={(e) => setServiceSort(e.target.value as "name_asc" | "name_desc" | "category")}
                                        className="bg-transparent text-xs font-semibold text-slate-700 outline-none pr-1"
                                        aria-label="Sort services"
                                    >
                                        <option value="name_asc">Name (A to Z)</option>
                                        <option value="name_desc">Name (Z to A)</option>
                                        <option value="category">Category</option>
                                    </select>
                                </div>
                                {(serviceSearch || serviceCategoryFilter !== "ALL" || serviceSort !== "name_asc") && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setServiceSearch("");
                                            setServiceCategoryFilter("ALL");
                                            setServiceSort("name_asc");
                                        }}
                                        className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all"
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                                {filteredServices.length} services
                            </span>
                            <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-100">
                                {Math.max(serviceCategories.length - 1, 0)} categories
                            </span>
                            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-100">
                                {servicesWithoutDescription} missing description
                            </span>
                        </div>
                    </div>

                    {filteredServices.length === 0 ? (
                        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
                            <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
                                <Search className="w-5 h-5 text-slate-400" />
                            </div>
                            <h4 className="text-sm font-semibold text-slate-900">No services match current filters</h4>
                            <p className="text-xs text-slate-500 mt-1">Adjust search or category filter to see results.</p>
                        </div>
                    ) : (
                        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                            {filteredServices.map((service) => (
                                <div key={service.id} className="group bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all space-y-2.5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                                            {service.category || "General"}
                                        </div>
                                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                                            <button
                                                type="button"
                                                aria-label={`Edit ${service.serviceName}`}
                                                onClick={() => { setEditingService(service); setNewServiceData({ serviceName: service.serviceName, category: service.category || "Digital", description: service.description || "" }); setIsServiceModalOpen(true); }}
                                                className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-md"
                                            >
                                                <Edit3 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                aria-label={`Remove ${service.serviceName}`}
                                                onClick={() => setServiceToDelete(service.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-bold text-slate-900 tracking-tight text-xl leading-snug">
                                            {service.serviceName}
                                        </h4>
                                        <p className="text-xs text-slate-600 font-medium leading-relaxed line-clamp-2">
                                            {service.description || "Add a short description so teammates understand when to use this service."}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <ClientModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchClients}
                client={selectedClient}
            />

            {/* Client Delete Modal */}
            {clientToDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-all" onClick={() => setClientToDelete(null)} />
                    <div className="bg-white p-6 rounded-xl shadow-xl relative w-full max-w-sm border border-slate-200">
                        <div className="space-y-4 text-center">
                            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100">
                                <Trash2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900">Remove Client</h3>
                                <p className="text-sm text-slate-500 mt-1">This action will permanently delete this client record. Are you sure?</p>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-6">
                            <button onClick={() => setClientToDelete(null)} className="flex-1 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors rounded-md shadow-sm">Cancel</button>
                            <button onClick={confirmDelete} className="flex-1 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors rounded-md shadow-sm active:scale-[0.98]">Remove</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Service Delete Modal */}
            {serviceToDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-all" onClick={() => setServiceToDelete(null)} />
                    <div className="bg-white p-6 rounded-xl shadow-xl relative w-full max-w-sm border border-slate-200">
                        <div className="space-y-4 text-center">
                            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100">
                                <Trash2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900">Remove Service</h3>
                                <p className="text-sm text-slate-500 mt-1">This will remove this service from the catalog and all linked clients. Continue?</p>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-6">
                            <button onClick={() => setServiceToDelete(null)} className="flex-1 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors rounded-md shadow-sm">Cancel</button>
                            <button onClick={confirmServiceDelete} className="flex-1 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors rounded-md shadow-sm active:scale-[0.98]">Remove</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Service Edit/Add Modal */}
            {isServiceModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-all" onClick={() => setIsServiceModalOpen(false)} />
                    <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="font-semibold text-slate-900 text-xs">{editingService ? "Edit Service" : "Add Service"}</h3>
                            <button onClick={() => setIsServiceModalOpen(false)} className="text-slate-400 hover:text-slate-900"><X className="w-4 h-4" /></button>
                        </div>
                        <form onSubmit={handleServiceSubmit} className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-medium text-slate-400">Service Name</label>
                                <input
                                    required
                                    type="text"
                                    value={newServiceData.serviceName}
                                    onChange={(e) => setNewServiceData({ ...newServiceData, serviceName: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:bg-white focus:border-blue-500 transition-all font-medium"
                                    placeholder="e.g., Strategic Advisory"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-medium text-slate-400">Category</label>
                                <select
                                    value={newServiceData.category}
                                    onChange={(e) => setNewServiceData({ ...newServiceData, category: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:bg-white focus:border-blue-500 transition-all font-medium"
                                >
                                    {["Digital", "Strategy", "Creative", "Marketing", "Technology", "Other"].map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-medium text-slate-400">Description</label>
                                <textarea
                                    value={newServiceData.description}
                                    onChange={(e) => setNewServiceData({ ...newServiceData, description: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:bg-white focus:border-blue-500 transition-all font-medium h-24 resize-none"
                                    placeholder="Briefly describe this service..."
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-all active:scale-[0.98] mt-2 shadow-lg"
                            >
                                {editingService ? "Save Service" : "Add Service"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

