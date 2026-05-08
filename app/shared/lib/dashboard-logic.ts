import {
    DashboardAudienceState,
    DashboardCampaignState,
    DashboardDataHealth,
    ProcessChecklistItem,
    RecommendedAction,
} from "@/shared/types/dashboard";

type InputSignals = {
    totalClients: number;
    activeClients: number;
    warmLeads: number;
    pastClients: number;
    completeProfiles: number;
    campaigns7d: number;
    campaigns30d: number;
    noContact30d: number;
    lastCampaignAt: Date | null;
};

export function computeDataHealth(totalClients: number, completeProfiles: number, noContact30d: number): DashboardDataHealth {
    const profileIntegrity = totalClients > 0 ? Math.round((completeProfiles / totalClients) * 100) : 100;
    const completeness = profileIntegrity;
    return {
        completeness,
        staleRecords: noContact30d,
        profileIntegrity,
    };
}

export function computeAudienceState(totalClients: number, activeClients: number, warmLeads: number, pastClients: number, noContact30d: number): DashboardAudienceState {
    const safeTotal = Math.max(totalClients, 1);
    return {
        activeRatio: Math.round((activeClients / safeTotal) * 100),
        warmRatio: Math.round((warmLeads / safeTotal) * 100),
        pastRatio: Math.round((pastClients / safeTotal) * 100),
        noContact30d,
    };
}

export function computeCampaignState(campaigns7d: number, campaigns30d: number, lastCampaignAt: Date | null): DashboardCampaignState {
    return {
        lastCampaignAt: lastCampaignAt ? lastCampaignAt.toISOString() : null,
        campaigns7d,
        campaigns30d,
        testDispatchFailures: 0,
    };
}

export function pickNextBestAction(signals: InputSignals): RecommendedAction {
    const { totalClients, completeProfiles, campaigns30d, pastClients, activeClients } = signals;
    const integrity = totalClients > 0 ? Math.round((completeProfiles / totalClients) * 100) : 100;

    if (totalClients > 0 && integrity < 75) {
        return {
            actionType: "improve_data_health",
            reason: "Data health is limiting personalization quality and campaign accuracy.",
            impactEstimate: "Improving profile quality can increase campaign relevance and response rates.",
            targetCount: totalClients - completeProfiles,
            // The Integrations UI lives at `/import` in this app.
            ctaRoute: "/import",
        };
    }

    if (totalClients > 0 && campaigns30d === 0) {
        return {
            actionType: "start_broadcast",
            reason: "No outreach activity in the last 30 days.",
            impactEstimate: "A broadcast can quickly reactivate visibility across your client base.",
            targetCount: totalClients,
            ctaRoute: "/campaigns",
        };
    }

    if (pastClients > 0) {
        return {
            actionType: "run_reactivation",
            reason: "You have past clients who can be reactivated with focused outreach.",
            impactEstimate: "Reactivation campaigns can recover dormant opportunities faster than cold outreach.",
            targetCount: pastClients,
            ctaRoute: "/campaigns",
        };
    }

    return {
        actionType: "launch_targeted",
        reason: "Your data is healthy enough to run higher-conversion targeted campaigns.",
        impactEstimate: "Targeted outreach should improve conversion quality with less volume.",
        targetCount: Math.max(activeClients, 1),
        ctaRoute: "/campaigns",
    };
}

export function buildProcessChecklist(
    dataHealth: DashboardDataHealth,
    campaignState: DashboardCampaignState,
    recommendedAction: RecommendedAction,
    integrationReady: boolean
): ProcessChecklistItem[] {
    return [
        {
            id: "data-health",
            label: "Verify data health and integrations",
            status: dataHealth.profileIntegrity >= 80 && integrationReady ? "done" : "in_progress",
            // The Integrations UI lives at `/import` in this app.
            route: "/import",
            details: `Integrity ${dataHealth.profileIntegrity}% · Stale last 30d: ${dataHealth.staleRecords} · Integrations ${integrationReady ? "ready" : "not configured"}`,
        },
        {
            id: "audience-readiness",
            label: "Review audience segments and priorities",
            status: dataHealth.profileIntegrity >= 70 ? "done" : "todo",
            route: "/clients",
            details: `Stale records last 30d: ${dataHealth.staleRecords}`,
        },
        {
            id: "execute-action",
            label: `Execute next action: ${recommendedAction.actionType.replace(/_/g, " ")}`,
            status: campaignState.campaigns7d > 0 ? "done" : "todo",
            route: recommendedAction.ctaRoute,
            details: `Why: ${recommendedAction.reason}`,
        },
    ];
}

