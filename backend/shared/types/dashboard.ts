export type ChecklistStatus = "todo" | "in_progress" | "done";

export type ProcessChecklistItem = {
    id: string;
    label: string;
    status: ChecklistStatus;
    route: string;
    // Optional extra context shown under the checklist label.
    details?: string;
};

export type RecommendedAction = {
    actionType: "improve_data_health" | "start_broadcast" | "run_reactivation" | "launch_targeted";
    reason: string;
    impactEstimate: string;
    targetCount: number;
    ctaRoute: string;
};

export type DashboardDataHealth = {
    completeness: number;
    staleRecords: number;
    profileIntegrity: number;
};

export type DashboardAudienceState = {
    activeRatio: number;
    warmRatio: number;
    pastRatio: number;
    noContact30d: number;
};

export type DashboardCampaignState = {
    lastCampaignAt: string | null;
    campaigns7d: number;
    campaigns30d: number;
    testDispatchFailures: number;
};

export type DashboardStatsResponse = {
    stats: {
        totalClients: number;
        activeClients: number;
        warmLeads: number;
        pastClients: number;
        trends: {
            clients: string;
            engagement: string;
            growth: string;
            sparklines: {
                clients: number[];
                campaigns: number[];
            };
        };
    };
    chartData: Array<{ label: string; value: number }>;
    industryDistribution: Array<{ label: string; value: number }>;
    serviceUtilization: Array<{ label: string; value: number }>;
    integrityScore: number;
    recentCampaigns: Array<{
        id: string;
        clientName: string;
        industry: string;
        type: string;
        date: Date;
        status: string;
    }>;
    sourceStats: {
        zoho: number;
        invoice: number;
        gmail: Array<{ email: string; nametext: string; count: number }>;
    };
    dataHealth: DashboardDataHealth;
    audienceState: DashboardAudienceState;
    campaignState: DashboardCampaignState;
    recommendedAction: RecommendedAction;
    processChecklist: ProcessChecklistItem[];
    updatedAt: string;
    confidence: "High" | "Medium" | "Low";
};

