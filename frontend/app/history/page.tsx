"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
    Search,
    ArrowUpRight,
    Zap,
    X,
    Filter,
    Calendar,
    ChevronDown,
    Check,
    RotateCcw,
    Eye,
    Clock,
    User,
    Mail,
    Copy,
    CheckCircle2
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { SmartLoader } from "@/frontend/components/SmartLoader";
import { motion, AnimatePresence } from "framer-motion";
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { apiPath, appPath } from "@/frontend/lib/app-path";

export default function HistoryPage() {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterType, setFilterType] = useState<string>("All");
    const [selectedRecord, setSelectedRecord] = useState<any>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        fetchHistory();
    }, [filterType]);

    const fetchHistory = async () => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();

        setLoading(true);
        try {
            const query = new URLSearchParams();
            query.append("limit", "100");
            if (filterType !== "All") query.append("type", filterType);
            if (search) query.append("search", search);

            const res = await fetch(apiPath(`/campaigns/history?${query.toString()}`), {
                signal: abortControllerRef.current.signal
            });
            const result = await res.json();
            if (result.success) {
                setHistory(Array.isArray(result.data) ? result.data : []);
            } else {
                setHistory([]);
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Debounced search trigger
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchHistory();
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const groupedHistory = useMemo(() => {
        const groups: { [key: string]: any[] } = {
            "Today": [],
            "Yesterday": [],
            "Older": []
        };

        history.forEach(record => {
            const date = new Date(record.dateCreated);
            if (isToday(date)) groups["Today"].push(record);
            else if (isYesterday(date)) groups["Yesterday"].push(record);
            else groups["Older"].push(record);
        });

        return groups;
    }, [history]);

    const campaignTypes = ["All", "First Outreach", "Follow Up", "Strategic Advisory", "Partnership Proposal"];

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Content copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
    };

    const FilterPopover = ({ label, options, selected, onSelect, icon: Icon }: any) => {
        const [isOpen, setIsOpen] = useState(false);
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

        return (
            <div className="relative" ref={popoverRef}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 border",
                        selected !== "All"
                            ? "bg-blue-50 text-blue-700 border-blue-200 shadow-sm"
                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    )}
                >
                    {Icon && <Icon className="w-3.5 h-3.5" />}
                    <span>{label}: {selected}</span>
                    <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", isOpen && "rotate-180")} />
                </button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute z-50 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-2xl p-2 top-full right-0 md:left-0"
                        >
                            {options.map((opt: string) => (
                                <button
                                    key={opt}
                                    onClick={() => { onSelect(opt); setIsOpen(false); }}
                                    className={cn(
                                        "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-0.5",
                                        selected === opt
                                            ? "bg-blue-600 text-white"
                                            : "text-slate-700 hover:bg-slate-100"
                                    )}
                                >
                                    <span>{opt}</span>
                                    {selected === opt && <Check className="w-4 h-4" />}
                                </button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    return (
        <div className="space-y-10 w-full px-3 sm:px-4 lg:px-6 pb-20 animate-in fade-in duration-700">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h2 className="text-4xl font-bold tracking-tight text-slate-900">Interaction Archive</h2>
                    <p className="text-slate-500 font-medium text-lg">Historical record of synthesized client communications.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                                        onClick={() => { window.location.href = appPath("/campaigns/results"); }}
                        className="flex items-center gap-2 bg-slate-100 text-slate-600 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all active:scale-[0.98]"
                    >
                        <Zap className="w-4 h-4" />
                        Campaign Studio
                    </button>
                </div>
            </header>

            <div className="flex flex-col gap-4 bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-[300px] flex items-center gap-3 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus-within:bg-white focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-50 transition-all duration-300">
                        <Search className="w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by company, topic, or content..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-transparent border-none outline-none text-sm w-full font-medium text-slate-900 placeholder:text-slate-400"
                        />
                        {search && (
                            <button onClick={() => setSearch("")} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
                                <X className="w-4 h-4 text-slate-400" />
                            </button>
                        )}
                    </div>

                    <FilterPopover
                        label="Type"
                        options={campaignTypes}
                        selected={filterType}
                        onSelect={setFilterType}
                        icon={Filter}
                    />

                    {(search || filterType !== "All") && (
                        <button
                            onClick={() => { setSearch(""); setFilterType("All"); }}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reset
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-8">
                {Object.entries(groupedHistory).map(([group, records]) => (
                    records.length > 0 && (
                        <div key={group} className="space-y-4">
                            <div className="flex items-center gap-4 px-2">
                                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{group}</h3>
                                <div className="h-px flex-1 bg-slate-100" />
                            </div>

                            <div className="bg-white overflow-hidden rounded-2xl border border-slate-200 layered-shadow">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px]">
                                            <th className="px-8 py-4 font-bold uppercase tracking-widest text-slate-500">Entities & Subject</th>
                                            <th className="px-8 py-4 font-bold uppercase tracking-widest text-slate-500">Context</th>
                                            <th className="px-8 py-4 font-bold uppercase tracking-widest text-slate-500">Timestamp</th>
                                            <th className="px-8 py-4 text-right"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 text-sm">
                                        {records.map((record) => (
                                            <tr key={record.id} className="hover:bg-slate-50/30 transition-colors group">
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center font-bold text-slate-400 text-sm group-hover:border-blue-500 group-hover:text-blue-600 transition-all duration-300">
                                                            {record.client?.clientName?.[0] || "?"}
                                                        </div>
                                                        <div className="space-y-1">
                                                            <div className="font-bold text-slate-900">{record.client?.clientName}</div>
                                                            <div className="text-xs font-medium text-slate-400 truncate max-w-[200px]">{record.campaignTopic}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex flex-col gap-1.5">
                                                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md w-fit uppercase tracking-widest border border-blue-100">
                                                            {record.campaignType}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-emerald-500">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                            Dispatched
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="space-y-1">
                                                        <div className="font-bold text-slate-700 text-xs">
                                                            {format(new Date(record.dateCreated), "MMM dd, yyyy")}
                                                        </div>
                                                        <div className="text-[10px] font-medium text-slate-400 flex items-center gap-1.5">
                                                            <Clock className="w-3 h-3" />
                                                            {format(new Date(record.dateCreated), "hh:mm a")}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => { setSelectedRecord(record); setIsPreviewOpen(true); }}
                                                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                            title="Preview Content"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => window.location.href = `/clients`}
                                                            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
                                                        >
                                                            <ArrowUpRight className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )
                ))}

                {history.length === 0 && !loading && (
                    <div className="py-32 text-center space-y-4 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-sm border border-slate-200">
                            <Clock className="w-8 h-8 text-slate-300" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-lg font-bold text-slate-900 tracking-tight">No Archive Records</h3>
                            <p className="text-sm text-slate-500 font-medium">No interaction history matches your current filters.</p>
                        </div>
                        <button
                            onClick={() => { setSearch(""); setFilterType("All"); }}
                            className="text-xs font-bold text-blue-600 hover:underline uppercase tracking-widest"
                        >
                            Reset Search Filters
                        </button>
                    </div>
                )}

                {loading && (
                    <div className="py-20 flex justify-center">
                        <div className="flex flex-col items-center gap-4">
                            <SmartLoader label="Accessing Archive" description="Sequencing historical interactions..." />
                        </div>
                    </div>
                )}
            </div>

            {/* Preview Modal */}
            <AnimatePresence>
                {isPreviewOpen && selectedRecord && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
                            onClick={() => setIsPreviewOpen(false)}
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh] border border-slate-200"
                        >
                            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div className="space-y-0.5">
                                    <h3 className="font-bold text-slate-900 uppercase tracking-widest text-[10px]">Interaction Artifact</h3>
                                    <p className="text-sm font-bold text-slate-500">{selectedRecord.campaignTopic}</p>
                                </div>
                                <button
                                    onClick={() => setIsPreviewOpen(false)}
                                    className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white">
                                <div className="space-y-8">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recipient</span>
                                            <div className="flex items-center gap-2 group cursor-pointer">
                                                <div className="w-6 h-6 rounded bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-bold">
                                                    <User className="w-3 h-3" />
                                                </div>
                                                <span className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
                                                    {selectedRecord.client?.clientName}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                                    <Mail className="w-3 h-3" />
                                                </div>
                                                <span className="font-medium text-slate-500 text-sm">{selectedRecord.client?.email}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Synthesized Content</span>
                                            <button
                                                onClick={() => handleCopy(selectedRecord.generatedOutput)}
                                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white"
                                            >
                                                {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                                {copied ? "Copied" : "Copy Content"}
                                            </button>
                                        </div>
                                        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200/60 font-medium text-slate-800 text-sm leading-relaxed whitespace-pre-wrap shadow-inner">
                                            {selectedRecord.generatedOutput}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="px-8 py-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Type</span>
                                        <span className="text-xs font-bold text-slate-900">{selectedRecord.campaignType}</span>
                                    </div>
                                    <div className="w-px h-6 bg-slate-200" />
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Status</span>
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            Active Record
                                        </div>
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-slate-200">
                                    <Clock className="w-3 h-3" />
                                    {formatDistanceToNow(new Date(selectedRecord.dateCreated), { addSuffix: true })}
                                </span>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
