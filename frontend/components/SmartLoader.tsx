"use client";

import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface SmartLoaderProps {
    label?: string;
    description?: string;
    fullPage?: boolean;
}

export function SmartLoader({
    label = "Synchronizing Database",
    description = "Optimizing your experience...",
    fullPage = true
}: SmartLoaderProps) {
    const content = (
        <div className="flex flex-col items-center gap-6">
            <div className="relative">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0.5 }}
                    animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.5, 0.2, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 bg-blue-500/20 rounded-2xl blur-xl"
                />
                <div className="relative w-16 h-16 bg-white rounded-2xl border-2 border-slate-100 shadow-sm flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent" />
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin relative z-10" />
                </div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-1.5 flex flex-col items-center text-center"
            >
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-[0.2em]">{label}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">{description}</p>
            </motion.div>
        </div>
    );

    if (fullPage) {
        return (
            <div className="fixed inset-0 z-[9999] bg-white/60 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-500">
                {content}
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center p-12 min-h-[300px]">
            {content}
        </div>
    );
}
