"use client";

import { useState, useEffect } from "react";
import { X, User, Mail, Building2, Save, Loader2, Check, Shield, Hash, Phone, MapPin, Calendar, Tag } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { toast } from "sonner";
import { apiPath } from "@/frontend/lib/app-path";

interface ClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    client?: any;
}

export function ClientModal({ isOpen, onClose, onSuccess, client }: ClientModalProps) {
    const toggleService = (serviceId: string, e: React.MouseEvent) => {
        e.preventDefault();
        setFormData(prev => {
            const isSelected = prev.serviceIds.includes(serviceId);
            if (isSelected) {
                return { ...prev, serviceIds: prev.serviceIds.filter(id => id !== serviceId) };
            } else {
                return { ...prev, serviceIds: [...prev.serviceIds, serviceId] };
            }
        });
    };
    const [formData, setFormData] = useState({
        clientName: "",
        contactPerson: "",
        email: "",
        industry: "",
        relationshipLevel: "Active",
        serviceIds: [] as string[]
    });
    const [services, setServices] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchServices();
            if (client) {
                setFormData({
                    clientName: client.clientName || "",
                    contactPerson: client.contactPerson || "",
                    email: client.email || "",
                    industry: client.industry || "",
                    relationshipLevel: client.relationshipLevel || "Active",
                    serviceIds: client.services?.map((s: any) => s.id) || []
                });
            } else {
                setFormData({
                    clientName: "",
                    contactPerson: "",
                    email: "",
                    industry: "",
                    relationshipLevel: "Active",
                    serviceIds: []
                });
            }
        }
    }, [isOpen, client]);

    const fetchServices = async () => {
        try {
            const res = await fetch(apiPath("/services"));
            const result = await res.json();
            if (result.success) setServices(result.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        setLoading(true);
        try {
            const url = client ? apiPath(`/clients/${client.id}`) : apiPath("/clients");
            const method = client ? "PUT" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });
            const result = await res.json();
            if (result.success) {
                onSuccess();
                onClose();
            } else {
                toast.error(result.error?.message || "A disruption occurred in the matrix. Please verify your inputs.");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-all" onClick={onClose} />

            <div className="bg-white w-full max-w-2xl rounded-2xl border border-slate-200 shadow-2xl relative flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-200">
                <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-100">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 uppercase tracking-widest">
                                {client ? "Recalibrate Profile" : "Onboard New Partner"}
                            </h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Client Portfolio Node</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200/50 rounded-full transition-colors text-slate-400 hover:text-slate-900">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 pt-6 space-y-8 custom-scrollbar">
                    {/* Identity Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <User className="w-3.5 h-3.5 text-blue-600" />
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Institutional Identity</h4>
                            <div className="h-px flex-1 bg-slate-100" />
                        </div>
                        
                        <div className="grid sm:grid-cols-2 gap-5">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Company / Client Name</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="e.g., Tata Consultancy Services"
                                    value={formData.clientName}
                                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all font-medium"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Point of Contact</label>
                                <input
                                    type="text"
                                    placeholder="e.g., John Doe"
                                    value={formData.contactPerson}
                                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all font-medium"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Communication Architecture */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Mail className="w-3.5 h-3.5 text-blue-600" />
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Communication Hub</h4>
                            <div className="h-px flex-1 bg-slate-100" />
                        </div>

                        <div className="space-y-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Authorized Email List</label>
                                <textarea
                                    required
                                    placeholder="primary@company.com, secondary@company.com"
                                    value={formData.email}
                                    onChange={(e) => {
                                        const newVal = e.target.value;
                                        setFormData(prev => ({
                                            ...prev,
                                            email: newVal
                                        }));
                                    }}
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all font-medium h-24 resize-none leading-relaxed"
                                />
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider pl-1">
                                    <Hash className="w-3 h-3" />
                                    Comma-separated for multiple routing
                                </div>
                            </div>


                        </div>
                    </div>

                    {/* Segmentation & Intelligence */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Tag className="w-3.5 h-3.5 text-blue-600" />
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Project Alignment</h4>
                            <div className="h-px flex-1 bg-slate-100" />
                        </div>

                        <div className="grid sm:grid-cols-2 gap-5">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Industry Sector</label>
                                <select
                                    required
                                    value={formData.industry}
                                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 outline-none focus:bg-white focus:border-blue-500 transition-all font-medium appearance-none cursor-pointer"
                                >
                                    <option value="">Select Sector</option>
                                    {["Engineering", "Industrial", "Technology", "Retail", "Corporate", "Digital", "Other"].map(i => (
                                        <option key={i} value={i}>{i}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Relationship Status</label>
                                <select
                                    value={formData.relationshipLevel}
                                    onChange={(e) => setFormData({ ...formData, relationshipLevel: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 outline-none focus:bg-white focus:border-blue-500 transition-all font-medium appearance-none cursor-pointer"
                                >
                                    {["Active", "Warm Lead", "Past Client", "Inactive", "Not Active"].map(lvl => (
                                        <option key={lvl} value={lvl}>{lvl}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-3">
                             <div className="flex items-center justify-between px-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Technological Footprint</label>
                                <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100 animate-pulse uppercase tracking-wider">
                                    {formData.serviceIds.length} Linked Services
                                </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-slate-50 border border-slate-100 p-5 rounded-2xl max-h-56 overflow-y-auto custom-scrollbar shadow-inner">
                                {services.map((service) => {
                                    const isSelected = formData.serviceIds.includes(service.id);
                                    return (
                                        <button
                                            key={service.id}
                                            type="button"
                                            onClick={(e) => toggleService(service.id, e)}
                                            className={cn(
                                                "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-[11px] font-bold transition-all group/btn uppercase tracking-wider",
                                                isSelected
                                                    ? "bg-white border-blue-600 text-blue-700 shadow-md ring-2 ring-blue-50"
                                                    : "bg-white border-slate-200 text-slate-400 hover:border-blue-300 hover:text-slate-600"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-4 h-4 rounded-md border flex items-center justify-center transition-all flex-shrink-0 shadow-sm",
                                                isSelected ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-200 group-hover/btn:border-blue-300"
                                            )}>
                                                {isSelected && <Check className="w-2.5 h-2.5 stroke-[4px]" />}
                                            </div>
                                            <span className="truncate">{service.serviceName}</span>
                                        </button>
                                    );
                                })}
                                {services.length === 0 && (
                                    <div className="col-span-full py-8 text-center bg-white/50 rounded-xl border border-dashed border-slate-200">
                                        <Loader2 className="w-5 h-5 animate-spin text-slate-300 mx-auto mb-2" />
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Synchronizing Service Matrix</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Integrated Metadata Section (Read-only / Synced) */}
                    {client && (client.source === "INVOICE_SYSTEM" || client.gstin || client.poc || client.address) && (
                        <div className="space-y-4 pt-4 border-t border-slate-100">
                             <div className="flex items-center gap-2 mb-2">
                                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Verified System Metadata</h4>
                                <div className="h-px flex-1 bg-slate-100" />
                            </div>
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-emerald-50/30 rounded-2xl p-6 border border-emerald-100/50">
                                {client.poc && (
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-black uppercase tracking-widest leading-none">
                                            <User className="w-2.5 h-2.5" />
                                            Primary POC
                                        </div>
                                        <p className="text-sm font-bold text-slate-700 truncate pl-4 border-l border-emerald-100 ml-1">{client.poc}</p>
                                    </div>
                                )}
                                {client.gstin && (
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-black uppercase tracking-widest leading-none">
                                            <Shield className="w-2.5 h-2.5" />
                                            Tax ID / GSTIN
                                        </div>
                                        <p className="text-[11px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded ml-1 w-fit">{client.gstin}</p>
                                    </div>
                                )}
                                {client.externalId && (
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-black uppercase tracking-widest leading-none">
                                            <Hash className="w-2.5 h-2.5" />
                                            External ID
                                        </div>
                                        <p className="text-xs font-mono font-bold text-slate-600 pl-4 border-l border-emerald-100 ml-1">#{client.externalId}</p>
                                    </div>
                                )}
                                {(client.phone || client.mobile) && (
                                    <div className="space-y-1 col-span-full">
                                        <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-black uppercase tracking-widest leading-none">
                                            <Phone className="w-2.5 h-2.5" />
                                            Authorized Telemetry
                                        </div>
                                        <p className="text-sm font-bold text-slate-700 pl-4 border-l border-emerald-100 ml-1">
                                            {[client.phone, client.mobile].filter(Boolean).join(" • ")}
                                        </p>
                                    </div>
                                )}
                                {client.address && (
                                    <div className="space-y-1 col-span-full">
                                        <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-black uppercase tracking-widest leading-none">
                                            <MapPin className="w-2.5 h-2.5" />
                                            Geospatial Node
                                        </div>
                                        <p className="text-[11px] font-medium text-slate-600 leading-relaxed italic pl-4 border-l border-emerald-100 ml-1">
                                            {client.address}
                                        </p>
                                    </div>
                                )}
                                {client.clientAddedOn && (
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-black uppercase tracking-widest leading-none">
                                            <Calendar className="w-2.5 h-2.5" />
                                            Partnership Since
                                        </div>
                                        <p className="text-xs font-bold text-slate-700 pl-4 border-l border-emerald-100 ml-1">
                                            {new Date(client.clientAddedOn).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                                        </p>
                                    </div>
                                )}
                                {client.lastInvoiceDate && (
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-[10px] text-blue-600 font-black uppercase tracking-widest leading-none">
                                            <Calendar className="w-2.5 h-2.5" />
                                            Last Invoice
                                        </div>
                                        <p className="text-xs font-bold text-blue-800 pl-4 border-l border-blue-100 ml-1">
                                            {new Date(client.lastInvoiceDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </form>

                <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-4 flex-shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        onClick={handleSubmit}
                        className="flex-[1.5] py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 shadow-xl shadow-slate-200 disabled:opacity-70 group"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />}
                        {client ? "Save Changes" : "Add Client"}
                    </button>
                </div>
            </div>
        </div>
    );
}
