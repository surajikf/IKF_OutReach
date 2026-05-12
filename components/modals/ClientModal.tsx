"use client";

import { useState, useEffect } from "react";
import { X, User, Mail, Building2, Save, Loader2, Check, Shield, Hash, Phone, MapPin, Calendar, Tag } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { toast } from "sonner";
import { apiPath } from "@/lib/app-path";

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
            return {
                ...prev,
                serviceIds: isSelected
                    ? prev.serviceIds.filter(id => id !== serviceId)
                    : [...prev.serviceIds, serviceId]
            };
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
                setFormData({ clientName: "", contactPerson: "", email: "", industry: "", relationshipLevel: "Active", serviceIds: [] });
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
                toast.error(result.error?.message || "Failed to save. Please check your inputs.");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const SectionLabel = ({ icon: Icon, label }: { icon: any; label: string }) => (
        <div className="flex items-center gap-2 mb-3">
            <Icon className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500">{label}</span>
            <div className="h-px flex-1 bg-slate-100" />
        </div>
    );

    const FieldLabel = ({ children }: { children: React.ReactNode }) => (
        <label className="text-xs font-medium text-slate-500">{children}</label>
    );

    const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-50 transition-all";

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

            <div className="bg-white w-full max-w-2xl rounded-xl border border-slate-200 shadow-2xl relative flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                            <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-slate-900">
                                {client ? "Edit Client" : "Add New Client"}
                            </h3>
                            <p className="text-xs text-slate-400">Fill in the details below</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Identity */}
                    <div>
                        <SectionLabel icon={User} label="Basic Info" />
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <FieldLabel>Company / Client Name</FieldLabel>
                                <input
                                    required
                                    type="text"
                                    placeholder="e.g., Tata Consultancy Services"
                                    value={formData.clientName}
                                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                                    className={inputClass}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <FieldLabel>Contact Person</FieldLabel>
                                <input
                                    type="text"
                                    placeholder="e.g., John Doe"
                                    value={formData.contactPerson}
                                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Email */}
                    <div>
                        <SectionLabel icon={Mail} label="Email" />
                        <div className="space-y-1.5">
                            <FieldLabel>Email Address(es)</FieldLabel>
                            <textarea
                                required
                                placeholder="primary@company.com, secondary@company.com"
                                value={formData.email}
                                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                className={cn(inputClass, "h-20 resize-none")}
                            />
                            <p className="text-[11px] text-slate-400">Separate multiple emails with a comma</p>
                        </div>
                    </div>

                    {/* Classification */}
                    <div>
                        <SectionLabel icon={Tag} label="Classification" />
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <FieldLabel>Industry</FieldLabel>
                                <select
                                    required
                                    value={formData.industry}
                                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                                    className={inputClass}
                                >
                                    <option value="">Select industry</option>
                                    {["Engineering", "Industrial", "Technology", "Retail", "Corporate", "Digital", "Other"].map(i => (
                                        <option key={i} value={i}>{i}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <FieldLabel>Relationship Status</FieldLabel>
                                <select
                                    value={formData.relationshipLevel}
                                    onChange={(e) => setFormData({ ...formData, relationshipLevel: e.target.value })}
                                    className={inputClass}
                                >
                                    {["Active", "Warm Lead", "Past Client", "Inactive", "Not Active"].map(lvl => (
                                        <option key={lvl} value={lvl}>{lvl}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Services */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Tag className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-xs font-semibold text-slate-500">Linked Services</span>
                            <div className="h-px flex-1 bg-slate-100" />
                            {formData.serviceIds.length > 0 && (
                                <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                                    {formData.serviceIds.length} selected
                                </span>
                            )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50 border border-slate-100 p-4 rounded-xl max-h-48 overflow-y-auto">
                            {services.map((service) => {
                                const isSelected = formData.serviceIds.includes(service.id);
                                return (
                                    <button
                                        key={service.id}
                                        type="button"
                                        onClick={(e) => toggleService(service.id, e)}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all text-left",
                                            isSelected
                                                ? "bg-white border-blue-500 text-blue-700 shadow-sm"
                                                : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0",
                                            isSelected ? "bg-blue-600 border-blue-600" : "border-slate-300"
                                        )}>
                                            {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3px]" />}
                                        </div>
                                        <span className="truncate">{service.serviceName}</span>
                                    </button>
                                );
                            })}
                            {services.length === 0 && (
                                <div className="col-span-full py-6 text-center">
                                    <Loader2 className="w-4 h-4 animate-spin text-slate-300 mx-auto mb-1" />
                                    <p className="text-xs text-slate-400">Loading services...</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Read-only synced metadata */}
                    {client && (client.source === "INVOICE_SYSTEM" || client.gstin || client.poc || client.address) && (
                        <div className="pt-2 border-t border-slate-100">
                            <SectionLabel icon={Shield} label="Synced from Invoice System (read-only)" />
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-slate-50 rounded-lg p-4 border border-slate-100">
                                {client.poc && (
                                    <div>
                                        <p className="text-[11px] text-slate-400 mb-0.5">Point of Contact</p>
                                        <p className="text-sm font-medium text-slate-700">{client.poc}</p>
                                    </div>
                                )}
                                {client.gstin && (
                                    <div>
                                        <p className="text-[11px] text-slate-400 mb-0.5">GSTIN</p>
                                        <p className="text-xs font-mono font-semibold text-slate-700">{client.gstin}</p>
                                    </div>
                                )}
                                {client.externalId && (
                                    <div>
                                        <p className="text-[11px] text-slate-400 mb-0.5">External ID</p>
                                        <p className="text-xs font-mono text-slate-600">#{client.externalId}</p>
                                    </div>
                                )}
                                {(client.phone || client.mobile) && (
                                    <div>
                                        <p className="text-[11px] text-slate-400 mb-0.5">Phone</p>
                                        <p className="text-sm font-medium text-slate-700">{[client.phone, client.mobile].filter(Boolean).join(" / ")}</p>
                                    </div>
                                )}
                                {client.address && (
                                    <div className="col-span-full">
                                        <p className="text-[11px] text-slate-400 mb-0.5">Address</p>
                                        <p className="text-xs text-slate-600 leading-relaxed">{client.address}</p>
                                    </div>
                                )}
                                {client.lastInvoiceDate && (
                                    <div>
                                        <p className="text-[11px] text-slate-400 mb-0.5">Last Invoice</p>
                                        <p className="text-sm font-medium text-slate-700">
                                            {new Date(client.lastInvoiceDate).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </form>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 flex gap-3 flex-shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        onClick={handleSubmit}
                        className="flex-[2] py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {client ? "Save Changes" : "Add Client"}
                    </button>
                </div>
            </div>
        </div>
    );
}
