"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronRight,
  Loader2,
  CheckCircle2,
  CircleDashed,
  AlertTriangle,
  Database,
  Users,
  Activity,
  Mail,
  LineChart,
  RefreshCw,
  Flame,
} from "lucide-react";
import { SmartLoader } from "@/components/SmartLoader";
import { DashboardStatsResponse } from "@/shared/types/dashboard";
import { apiPath, appPath } from "@/lib/app-path";

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      fetchStats(true);
    }, 60000);
    return () => clearInterval(t);
  }, []);

  const fetchStats = async (silent = false) => {
    if (silent) setIsRefreshing(true);
    setLoadError(null);
    if (!silent) setLoading(true);
    try {
      const res = await fetch(apiPath("/stats"));
      const result = await res.json();
      if (result.success) {
        setData(result.data);
        setLastRefreshedAt(new Date());
      } else {
        setLoadError(result.error?.message || "Unable to fetch dashboard insights.");
      }
    } catch (err) {
      console.error(err);
      setLoadError("Unable to load dashboard right now.");
    } finally {
      if (!silent) setLoading(false);
      setIsRefreshing(false);
    }
  };

  if (loading) return <SmartLoader label="Analyzing Dashboard" description="Fetching real-time business metrics..." />;
  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 space-y-4 text-center">
          <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto" />
          <h2 className="text-lg font-semibold text-slate-900">Dashboard unavailable</h2>
          <p className="text-sm text-slate-500">{loadError}</p>
          <button
            onClick={() => fetchStats(false)}
            className="w-full py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const safe = data || {
    stats: { totalClients: 0, activeClients: 0, warmLeads: 0, pastClients: 0, trends: { clients: "0", engagement: "0", growth: "0%", sparklines: { clients: [], campaigns: [] } } },
    chartData: [],
    industryDistribution: [],
    serviceUtilization: [],
    integrityScore: 100,
    recentCampaigns: [],
    sourceStats: { zoho: 0, invoice: 0, gmail: [] },
    dataHealth: { completeness: 100, staleRecords: 0, profileIntegrity: 100 },
    audienceState: { activeRatio: 0, warmRatio: 0, pastRatio: 0, noContact30d: 0 },
    campaignState: { lastCampaignAt: null, campaigns7d: 0, campaigns30d: 0, testDispatchFailures: 0 },
    recommendedAction: {
      actionType: "launch_targeted",
      reason: "No immediate risk detected.",
      impactEstimate: "Start a focused campaign for your best-fit audience.",
      targetCount: 0,
      ctaRoute: "/campaigns",
    },
    processChecklist: [],
    updatedAt: new Date().toISOString(),
    confidence: "Low" as const,
  };

  const summaryCards = [
    { id: "database", label: "Total Clients", title: "Total number of clients in your system", value: safe.stats.totalClients, sub: "total records", icon: Users, accent: "blue" },
    { id: "activeRatio", label: "Active Clients %", title: "Percentage of clients who are currently engaged", value: `${safe.audienceState.activeRatio}%`, sub: "engagement rate", icon: Activity, accent: "blue" },
    {
      id: "lastOutreach",
      label: "Last Message Sent",
      title: "How long ago you last sent a campaign message",
      value: safe.campaignState.lastCampaignAt
        ? formatDistanceToNow(new Date(safe.campaignState.lastCampaignAt), { addSuffix: true })
        : "No outreach yet",
      sub: "recent activity",
      icon: Mail,
      accent: "blue",
    },
    { id: "dataQuality", label: "Data Quality", title: "Overall completeness of your client profiles and contact data", value: `${safe.dataHealth.profileIntegrity}%`, sub: "profile completeness", icon: Activity, accent: "emerald" },
  ];

  const maxTrendValue = Math.max(1, ...(safe.chartData || []).map((d) => d.value || 0));
  const clientSpark = safe?.stats?.trends?.sparklines?.clients || [];
  const campaignSpark = safe?.stats?.trends?.sparklines?.campaigns || [];
  const clientDelta = clientSpark.length > 1 ? clientSpark[clientSpark.length - 1] - clientSpark[0] : 0;
  const campaignDelta = campaignSpark.length > 1 ? campaignSpark[campaignSpark.length - 1] - campaignSpark[0] : 0;
  const activeWarmTotal = Math.max(1, safe.stats.activeClients + safe.stats.warmLeads + safe.stats.pastClients);

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="w-full px-4 md:px-8 xl:px-10 py-8 space-y-6">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 px-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-blue-600 mb-1">Control Center</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
            <p className="text-sm font-medium text-slate-500 mt-1">Easily see your client status and what needs attention next.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm">
              <div className="flex items-center gap-1.5">
                <div 
                  className={`w-1.5 h-1.5 rounded-full ${safe.confidence === 'High' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-amber-500'}`} 
                  title={`${safe.confidence} Confidence`}
                />
                <span className="text-[10px] font-bold text-slate-700">{safe.confidence}</span>
              </div>
              
              <div className="w-px h-3 bg-slate-200" />
              
              <div className="flex items-center gap-3 text-[10px] font-medium text-slate-500">
                <span title={`Data updated ${formatDistanceToNow(new Date(safe.updatedAt), { addSuffix: true })}`}>
                  Updated {formatDistanceToNow(new Date(safe.updatedAt), { addSuffix: true })}
                </span>
                {lastRefreshedAt && (
                  <>
                    <div className="w-1 h-1 rounded-full bg-slate-300" />
                    <span title={`Last refreshed ${formatDistanceToNow(lastRefreshedAt, { addSuffix: true })}`}>
                      Refreshed {formatDistanceToNow(lastRefreshedAt, { addSuffix: true })}
                    </span>
                  </>
                )}
              </div>
            </div>

            <button
              onClick={() => fetchStats(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {summaryCards.map((card) => (
            <div key={card.id} className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm hover:shadow-md transition-shadow group/card" title={card.title}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-black uppercase tracking-widest text-slate-400 transition-colors ${card.accent === "emerald" ? "group-hover/card:text-emerald-500" : "group-hover/card:text-blue-500"}`}>{card.label}</span>
                <card.icon className={`w-4 h-4 ${card.accent === "emerald" ? "text-emerald-500" : "text-blue-500"}`} />
              </div>
              <div className="text-2xl font-bold text-slate-900">{card.value}</div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">{card.sub}</div>
            </div>
          ))}
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <section className="xl:col-span-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3" title="The smartest next step to take based on your current data">Recommended Step</p>
            <h2 className="text-xl font-bold text-slate-900 mb-2 capitalize">{safe.recommendedAction.actionType.replace(/_/g, " ")}</h2>
            <p className="text-sm font-medium text-slate-500 mb-3">{safe.recommendedAction.reason}</p>
            <div className="bg-slate-50 rounded-xl p-3 mb-6">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Expected Impact</p>
              <p className="text-xs font-bold text-blue-700">
                {safe.recommendedAction.impactEstimate} · Targeting {safe.recommendedAction.targetCount} Clients
              </p>
            </div>
            <button
              onClick={() => router.push(appPath(safe.recommendedAction.ctaRoute))}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-black transition-all shadow-md active:scale-[0.98]"
            >
              Start Now
              <ChevronRight className="w-4 h-4" />
            </button>
          </section>

          <section className="xl:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900" title="Key tasks and cleanup actions to keep your business running smoothly">To-Do List</h3>
              <button 
                onClick={() => router.push(appPath("/campaigns"))} 
                className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded transition-colors"
              >
                Campaigns
              </button>
            </div>
            <div className="space-y-3">
              {(safe.processChecklist || []).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 bg-slate-50/50 border border-slate-100 rounded-2xl px-4 py-3 group hover:bg-white hover:border-blue-200 transition-all">
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-3 min-w-0">
                      {item.status === "done" ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                        </div>
                      ) : item.status === "in_progress" ? (
                        <div className="w-5 h-5 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center">
                          <Loader2 className="w-3 h-3 text-amber-600 animate-spin shrink-0" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                          <CircleDashed className="w-3 h-3 text-slate-400 shrink-0" />
                        </div>
                      )}
                      <span className="text-sm font-bold text-slate-800 truncate">{item.label}</span>
                    </div>
                    {item.details ? (
                      <div className="text-[11px] font-medium text-slate-400 truncate mt-1 pl-8">{item.details}</div>
                    ) : null}
                  </div>
                  <button onClick={() => router.push(item.route)} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors">Action</button>
                </div>
              ))}
              {(safe.processChecklist || []).length === 0 && (
                <div className="text-xs font-bold text-slate-400 border-2 border-dashed border-slate-100 rounded-2xl p-6 text-center italic">
                  No pending tasks. You can set up data sync in Settings.
                </div>
              )}
            </div>
            <div className="mt-6 pt-6 border-t border-slate-100">
              <div className="flex items-center gap-3 mb-4">
                <LineChart className="w-4 h-4 text-blue-500" />
                <span className="text-[10px] font-black uppercase tracking-[.15em] text-slate-500">7-Day Engagement Velocity</span>
                <span className={`ml-auto text-[10px] font-black px-2 py-0.5 rounded uppercase ${campaignDelta >= 0 ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50"}`}>
                  {campaignDelta >= 0 ? "+" : ""}{campaignDelta} Change
                </span>
              </div>
              <div className="h-20 flex items-end gap-2.5">
                {(safe.chartData || []).map((point) => (
                  <div key={point.label} className="flex-1 flex flex-col items-center gap-2 group/bar">
                    <div className="w-full h-14 bg-slate-100/50 rounded-lg relative overflow-hidden group-hover/bar:bg-slate-200/50 transition-colors">
                      <div
                        className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-blue-600 to-blue-400 rounded-lg shadow-[0_-2px_8px_rgba(37,99,235,0.3)]"
                        style={{ height: `${Math.max(8, Math.round((point.value / maxTrendValue) * 100))}%` }}
                      >
                        <div className="absolute top-1 inset-x-1 h-0.5 bg-white/20 rounded-full" />
                      </div>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-tighter text-slate-400 group-hover/bar:text-slate-600">{point.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="xl:col-span-3 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-4" title="Deep analysis of your client base through smart grouping">Key Insights</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dormant (30d)</span>
                <span className="text-xs font-black text-rose-600">{safe.audienceState.noContact30d}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Weekly Pulse</span>
                <span className="text-xs font-black text-blue-600">{safe.campaignState.campaigns7d}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Growth Signal</span>
                <span className="text-xs font-black text-emerald-600">{clientDelta >= 0 ? "+" : ""}{clientDelta}</span>
              </div>
            </div>
            
            <div className="pt-6 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400" title="How your clients are categorized by relationship type">Client Mix</span>
                <span className="text-[10px] font-bold text-slate-500">{safe.stats.activeClients + safe.stats.warmLeads + safe.stats.pastClients} Clients</span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden flex shadow-inner">
                <div className="bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" style={{ width: `${Math.round((safe.stats.activeClients / activeWarmTotal) * 100)}%` }} />
                <div className="bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.2)]" style={{ width: `${Math.round((safe.stats.warmLeads / activeWarmTotal) * 100)}%` }} />
                <div className="bg-slate-300" style={{ width: `${Math.round((safe.stats.pastClients / activeWarmTotal) * 100)}%` }} />
              </div>
              <div className="grid grid-cols-3 text-[9px] font-black uppercase tracking-widest text-slate-400 gap-2">
                <div className="text-center">Active</div>
                <div className="text-center">Warm</div>
                <div className="text-center">Inactive</div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4" title="External services successfully connected to your account">Synced Apps</div>
              <div className="space-y-2">
                <div className="flex justify-between items-center bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Invoices</span>
                  <span className="text-xs font-black text-slate-900">{safe.sourceStats.invoice}</span>
                </div>
                <div className="flex justify-between items-center bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Zoho Bigin</span>
                  <span className="text-xs font-black text-slate-900">{safe.sourceStats.zoho}</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Gmail Sync</span>
                    <span className="text-[10px] font-black text-slate-900 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                      {(safe.sourceStats.gmail || []).reduce((acc, g) => acc + g.count, 0)} Total
                    </span>
                  </div>
                  <div className="pt-2 mt-1 border-t border-slate-200/50 space-y-2">
                    {(safe.sourceStats.gmail || []).map((g) => (
                      <div key={g.email} className="flex justify-between items-start px-1 group/gmail">
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] font-bold text-slate-700 lowercase truncate leading-none mb-0.5">{g.email}</span>
                          <span className="text-[9px] font-medium text-slate-400 capitalize truncate max-w-[140px] leading-tight">
                            {g.email === 'Unassigned' ? 'Manual/Old Data' : g.nametext}
                          </span>
                        </div>
                        <span className="text-[10px] font-black text-slate-600 tabular-nums">{g.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={() => router.push(appPath("/clients"))}
              className="w-full py-3 rounded-xl border border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 hover:border-slate-800 transition-all shadow-sm active:scale-[0.98]"
            >
              Audience Audit
            </button>
          </aside>
        </div>

        <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 border-l-4 border-blue-600 pl-4">Recent Activity</h3>
            <button 
              onClick={() => router.push(appPath("/campaigns/results"))} 
              className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors"
            >
              View Feed
            </button>
          </div>
          {safe.recentCampaigns.length === 0 ? (
            <div className="text-sm font-bold text-slate-400 border-2 border-dashed border-slate-100 rounded-2xl p-8 text-center bg-slate-50/50">
              No activity yet. Send your first campaign to see updates here.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {safe.recentCampaigns.slice(0, 4).map((c) => (
                <div key={c.id} className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 hover:bg-white hover:border-blue-200 transition-all group">
                  <div className="text-sm font-bold text-slate-900 truncate mb-1">{c.clientName}</div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{c.type}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">{c.industry}</span>
                  </div>
                  <div className="text-[10px] font-medium text-slate-400 italic">
                    {formatDistanceToNow(new Date(c.date), { addSuffix: true })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-50" />
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center">
              <Flame className="w-4 h-4 text-amber-500" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900" title="Key indicators of system growth and engagement health">Growth Indicators</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs relative z-10">
            <div className="bg-slate-50/80 backdrop-blur-sm border border-slate-100 rounded-2xl p-4 group hover:bg-white hover:border-blue-200 transition-all">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Portfolio Expansion</p>
              <p className="text-lg font-bold text-slate-900">{safe.stats.trends.growth} Growth</p>
              <p className="text-[10px] font-medium text-slate-500 mt-1 uppercase">vs baseline metrics</p>
            </div>
            <div className="bg-slate-50/80 backdrop-blur-sm border border-slate-100 rounded-2xl p-4 group hover:bg-white hover:border-blue-200 transition-all">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Engagement Momentum</p>
              <p className="text-lg font-bold text-slate-900">{campaignDelta >= 0 ? "Improving" : "Cooling"}</p>
              <p className="text-[10px] font-medium text-slate-500 mt-1 uppercase">
                {campaignDelta >= 0 ? "+" : ""}{campaignDelta} Strategic Dispatches
              </p>
            </div>
            <div className="bg-slate-50/80 backdrop-blur-sm border border-slate-100 rounded-2xl p-4 group hover:bg-white hover:border-blue-200 transition-all">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">System Integrity</p>
              <p className="text-lg font-bold text-rose-600">{safe.dataHealth.staleRecords} Stale</p>
              <p className="text-[10px] font-medium text-slate-500 mt-1 uppercase">Units requiring calibration</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
