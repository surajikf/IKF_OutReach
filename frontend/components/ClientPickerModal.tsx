"use client";

import { useState, useMemo } from "react";
import { X, Search, Building2, User, ChevronRight, CheckCircle2, CheckSquare, AlertCircle, EyeOff } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface Client {
    id: string;
    clientName: string;
    industry: string;
    contactPerson?: string;
    relationshipLevel?: string;
}

interface ClientPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    clients: Client[];
    selectedClientId?: string;
    onSelect: (clientId: string) => void;
    loading?: boolean;
    mode?: 'single' | 'oversight';
    excludedIds?: string[];
    onToggleExclusion?: (clientId: string) => void;
    onSetExcludedIds?: (ids: string[]) => void;
}

export function ClientPickerModal({ 
    isOpen, 
    onClose, 
    clients, 
    selectedClientId, 
    onSelect,
    loading,
    mode = 'single',
    excludedIds = [],
    onToggleExclusion,
    onSetExcludedIds
}: ClientPickerModalProps) {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredClients = useMemo(() => {
        if (!searchQuery.trim()) return clients;
        const query = searchQuery.toLowerCase();
        return clients.filter(c => 
            c.clientName.toLowerCase().includes(query) || 
            c.industry?.toLowerCase().includes(query) ||
            c.contactPerson?.toLowerCase().includes(query)
        );
    }, [clients, searchQuery]);

    const activeClients = useMemo(() => {
        // Treat "Warm Lead" as active-like so the user can target Active + Warm in one bucket.
        return clients.filter((c) => {
            const rel = (c.relationshipLevel || "").toLowerCase().trim();
            return rel === "active" || rel === "warm lead";
        });
    }, [clients]);
    const notActiveClients = useMemo(() => {
        return clients.filter((c) => {
            const rel = (c.relationshipLevel || "").toLowerCase().trim();
            return rel !== "active" && rel !== "warm lead";
        });
    }, [clients]);

    const excludedIdSet = useMemo(() => new Set(excludedIds), [excludedIds]);
    const allClientIds = useMemo(() => clients.map((c) => c.id), [clients]);
    const activeClientIds = useMemo(() => activeClients.map((c) => c.id), [activeClients]);
    const notActiveClientIds = useMemo(() => notActiveClients.map((c) => c.id), [notActiveClients]);

    const selectedCount = useMemo(() => {
        return allClientIds.filter((id) => !excludedIdSet.has(id)).length;
    }, [allClientIds, excludedIdSet]);

    const selectedActiveCount = useMemo(() => {
        return activeClientIds.filter((id) => !excludedIdSet.has(id)).length;
    }, [activeClientIds, excludedIdSet]);

    const selectedNotActiveCount = useMemo(() => {
        return notActiveClientIds.filter((id) => !excludedIdSet.has(id)).length;
    }, [notActiveClientIds, excludedIdSet]);

    const setExcludedIdsExactly = (ids: string[]) => {
        // excludedIds are "NOT selected" recipients
        onSetExcludedIds?.(Array.from(new Set(ids)));
    };

    // Smart selection semantics:
    // - Select All: include every client
    // - Exclude All: exclude every client
    // - Select All Active: include only Active + Warm Lead (exclude the rest)
    // - Select All Not Active: include only Not Active (everything else)
    const selectAll = () => setExcludedIdsExactly([]);
    const excludeAll = () => setExcludedIdsExactly(allClientIds);
    const selectAllActiveOnly = () => setExcludedIdsExactly(notActiveClientIds);
    const selectAllNotActiveOnly = () => setExcludedIdsExactly(activeClientIds);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-all" onClick={onClose} />
            
            <div className="bg-white w-full max-w-2xl rounded-2xl border border-slate-200 shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-all",
                            mode === 'oversight' ? "bg-amber-500 text-white shadow-amber-100" : "bg-blue-600 text-white shadow-blue-100"
                        )}>
                            {mode === 'oversight' ? <CheckSquare className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                                {mode === 'oversight' ? 'Review Target Audience' : 'Select Sample Client'}
                            </h3>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-0.5">
                                {mode === 'oversight' ? `${selectedCount} Verified Recipients` : 'Anchoring Campaign Tone'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200/50 rounded-lg transition-colors text-slate-400 hover:text-slate-900">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-4 border-b border-slate-100 bg-white sticky top-0 z-10">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by client name, industry, or contact..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-900 outline-none focus:bg-white focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/5 transition-all font-medium"
                            autoFocus
                        />
                    </div>
                    {mode === "oversight" && (
                        <div className="mt-3 space-y-2">
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={selectAll}
                                    className="px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                                >
                                    Select All
                                </button>
                                <button
                                    type="button"
                                    onClick={excludeAll}
                                    className="px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors"
                                >
                                    Exclude All
                                </button>
                                <button
                                    type="button"
                                    disabled={activeClientIds.length === 0}
                                    onClick={selectAllActiveOnly}
                                    className="px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Select All Active
                                </button>
                                <button
                                    type="button"
                                    disabled={notActiveClientIds.length === 0}
                                    onClick={selectAllNotActiveOnly}
                                    className="px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Select All Not Active
                                </button>
                            </div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Active Selected: {selectedActiveCount}/{activeClients.length} · Not Active Selected: {selectedNotActiveCount}/{notActiveClients.length}
                            </div>
                        </div>
                    )}
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/30">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Synchronizing Clients...</p>
                        </div>
                    ) : filteredClients.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-2">
                            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                                <Search className="w-8 h-8 text-slate-300" />
                            </div>
                            <p className="text-slate-900 font-bold">No clients found</p>
                            <p className="text-sm text-slate-500 max-w-[250px]">Try refining your search or checking the database connectivity.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {filteredClients.map((client) => {
                                const isSelected = selectedClientId === client.id;
                                const isExcluded = excludedIds.includes(client.id);

                                return (
                                    <button
                                        key={client.id}
                                        onClick={() => {
                                            if (mode === 'oversight') {
                                                onToggleExclusion?.(client.id);
                                            } else {
                                                onSelect(client.id);
                                            }
                                        }}
                                        className={cn(
                                            "flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left relative group",
                                            mode === 'oversight'
                                                ? isExcluded 
                                                    ? "bg-slate-50 border-slate-200 grayscale opacity-60" 
                                                    : "bg-white border-blue-100 hover:border-blue-300 shadow-sm"
                                                : isSelected
                                                    ? "bg-blue-50 border-blue-500 ring-4 ring-blue-500/5" 
                                                    : "bg-white border-white hover:border-slate-200 hover:shadow-md shadow-sm"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                                            isExcluded 
                                                ? "bg-slate-200 text-slate-400" 
                                                : (isSelected || mode === 'oversight')
                                                    ? "bg-blue-600 text-white" 
                                                    : "bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600"
                                        )}>
                                            {isExcluded ? <EyeOff className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className={cn("text-sm font-bold truncate", isExcluded ? "text-slate-500" : "text-slate-900")}>
                                                    {client.clientName}
                                                </p>
                                                {isExcluded && <span className="text-[8px] font-black bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded uppercase">Excluded</span>}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] font-black uppercase tracking-tighter text-slate-400">{client.industry}</span>
                                                {client.contactPerson && !isExcluded && (
                                                    <>
                                                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                                            <User className="w-2.5 h-2.5" />
                                                            {client.contactPerson}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        {mode === 'oversight' ? (
                                            <div className={cn(
                                                "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                                                isExcluded ? "border-slate-300 bg-white" : "border-blue-600 bg-blue-600"
                                            )}>
                                                {!isExcluded && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                                            </div>
                                        ) : isSelected ? (
                                            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                                        ) : (
                                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {filteredClients.length} Clients Available
                    </p>
                    <button 
                        onClick={onClose}
                        className="text-[10px] font-black text-slate-500 hover:text-slate-900 uppercase tracking-widest px-3 py-1.5 hover:bg-slate-50 rounded-lg transition-all"
                    >
                        Dismiss
                    </button>
                </div>
            </div>
        </div>
    );
}
