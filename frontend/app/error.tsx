"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error);
    }, [error]);

    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 animate-in fade-in duration-700">
            <div className="bg-white p-10 md:p-14 rounded-3xl border border-slate-200/60 shadow-[0_20px_50px_rgba(0,0,0,0.1)] text-center max-w-md w-full relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-blue-600" />
                <div className="w-20 h-20 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-8 relative">
                    <div className="absolute inset-0 border border-blue-200 rounded-3xl animate-ping opacity-20" />
                    <AlertTriangle className="w-10 h-10" />
                </div>
                <div className="space-y-4 mb-10">
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">System Anomaly</h2>
                    <p className="text-sm font-medium text-slate-500 leading-relaxed">
                        A dissonance has occurred in the matrix. Our systems have logged the fault.
                    </p>
                </div>
                <button
                    onClick={() => reset()}
                    className="w-full bg-slate-900 text-white py-5 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl shadow-slate-200 hover:bg-slate-800 hover-lift"
                >
                    <RefreshCw className="w-4 h-4" />
                    Reinitialize Core
                </button>
            </div>
        </div>
    );
}
