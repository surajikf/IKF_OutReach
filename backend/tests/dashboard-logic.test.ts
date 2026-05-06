import { describe, it, expect } from "vitest";
import {
    buildProcessChecklist,
    computeAudienceState,
    computeCampaignState,
    computeDataHealth,
    pickNextBestAction,
} from "@/shared/lib/dashboard-logic";

describe("dashboard logic", () => {
    it("computes data health safely", () => {
        const health = computeDataHealth(100, 75, 20);
        expect(health.profileIntegrity).toBe(75);
        expect(health.staleRecords).toBe(20);
    });

    it("picks data health action first on low integrity", () => {
        const action = pickNextBestAction({
            totalClients: 100,
            activeClients: 20,
            warmLeads: 30,
            pastClients: 10,
            completeProfiles: 50,
            campaigns7d: 1,
            campaigns30d: 4,
            noContact30d: 40,
            lastCampaignAt: new Date(),
        });
        expect(action.actionType).toBe("improve_data_health");
    });

    it("builds checklist with proper statuses", () => {
        const dataHealth = computeDataHealth(20, 18, 2);
        const campaignState = computeCampaignState(0, 2, null);
        const action = pickNextBestAction({
            totalClients: 20,
            activeClients: 10,
            warmLeads: 5,
            pastClients: 2,
            completeProfiles: 18,
            campaigns7d: 0,
            campaigns30d: 2,
            noContact30d: 2,
            lastCampaignAt: null,
        });
        const checklist = buildProcessChecklist(dataHealth, campaignState, action, true);
        expect(checklist).toHaveLength(3);
        expect(checklist[0].status).toBe("done");
        expect(checklist[2].status).toBe("todo");
    });

    it("computes audience ratios", () => {
        const audience = computeAudienceState(100, 40, 35, 25, 10);
        expect(audience.activeRatio).toBe(40);
        expect(audience.warmRatio).toBe(35);
        expect(audience.pastRatio).toBe(25);
    });
});

