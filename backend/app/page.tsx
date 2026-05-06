import Link from "next/link";

export default function BackendStatusPage() {
  const stats = [
    { label: "Core Identity", value: "IKF_OutReach_API", emoji: "🛡️", color: "text-blue-500" },
    { label: "Service Mode", value: "Headless Node", emoji: "🖥️", color: "text-emerald-500" },
    { label: "Data Pipeline", value: "Prisma Active", emoji: "🗄️", color: "text-indigo-500" },
    { label: "Uptime Status", value: "Operational", emoji: "📈", color: "text-rose-500" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(17,24,39,1),rgba(2,6,23,1))]" />
      
      {/* Decorative Matrix Grid */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
           style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="relative w-full max-w-2xl">
        <div className="bg-slate-900/50 backdrop-blur-3xl rounded-[2.5rem] border border-slate-800/50 p-12 shadow-2xl overflow-hidden">
          {/* Glow Effect */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-[100px]" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-[100px]" />

          <div className="relative flex flex-col items-center text-center">
            {/* Logo/Icon */}
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl flex items-center justify-center mb-8 shadow-lg shadow-blue-500/20 transform hover:rotate-3 transition-transform duration-500 text-3xl">
              ⚙️
            </div>

            <h1 className="text-4xl font-extrabold text-white tracking-tight mb-3">
              IKF <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Outreach API</span>
            </h1>
            <p className="text-slate-400 font-medium mb-12 max-w-md">
              Secure data synchronization node and AI outreach engine. Monitoring active traffic and secure connections.
            </p>

            <div className="grid grid-cols-2 gap-4 w-full mb-12 text-left">
              {stats.map((stat) => (
                <div key={stat.label} className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-4 hover:border-slate-600/50 transition-colors">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-lg">{stat.emoji}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{stat.label}</span>
                  </div>
                  <div className="text-sm font-bold text-slate-200">{stat.value}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link 
                href="http://localhost:3000" 
                className="px-8 py-3 bg-white text-slate-900 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-[0.98] shadow-xl"
              >
                Access Frontend Studio
              </Link>
              <Link 
                href="/api/debug/db" 
                className="px-8 py-3 bg-slate-800 text-slate-300 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-slate-700 transition-all border border-slate-700"
              >
                Inspect Health
              </Link>
            </div>
          </div>
        </div>
        
        <div className="mt-8 flex justify-center items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Global Sync Active</span>
          </div>
          <div className="w-px h-3 bg-slate-800" />
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Version 1.2.4-stable</span>
        </div>
      </div>
    </div>
  );
}
