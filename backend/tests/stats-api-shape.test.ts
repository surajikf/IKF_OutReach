import { beforeEach, describe, expect, it, vi } from "vitest";

const clientGroupByMock = vi.fn();
const clientCountMock = vi.fn();
const clientFindManyMock = vi.fn();
const campaignCountMock = vi.fn();
const campaignFindManyMock = vi.fn();
const serviceFindManyMock = vi.fn();
const globalSettingsFindUniqueMock = vi.fn();
const gmailAccountFindManyMock = vi.fn();

vi.mock("@/backend/lib/prisma", () => ({
    default: {
        client: {
            groupBy: clientGroupByMock,
            count: clientCountMock,
            findMany: clientFindManyMock,
        },
        campaignHistory: {
            count: campaignCountMock,
            findMany: campaignFindManyMock,
        },
        service: {
            findMany: serviceFindManyMock,
        },
        globalSettings: {
            findUnique: globalSettingsFindUniqueMock,
        },
        gmailAccount: {
            findMany: gmailAccountFindManyMock,
        },
    },
}));

describe("/api/stats GET response contract", () => {
    beforeEach(() => {
        vi.resetAllMocks();

        clientGroupByMock
            .mockResolvedValueOnce([{ relationshipLevel: "Active", _count: 3 }])
            .mockResolvedValueOnce([{ industry: "IT", _count: 3 }])
            .mockResolvedValueOnce([{ source: "INVOICE_SYSTEM", gmailSourceAccount: null, _count: 3 }]);

        clientCountMock
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(10)
            .mockResolvedValueOnce(8)
            .mockResolvedValueOnce(2);

        campaignCountMock
            .mockResolvedValueOnce(2)
            .mockResolvedValueOnce(1);

        serviceFindManyMock.mockResolvedValueOnce([
            { serviceName: "SEO", _count: { clients: 4 } },
        ]);

        clientFindManyMock.mockResolvedValueOnce([{ createdAt: new Date() }]);

        campaignFindManyMock
            .mockResolvedValueOnce([{ dateCreated: new Date() }])
            .mockResolvedValueOnce([
                {
                    id: "1",
                    campaignType: "Broadcast",
                    dateCreated: new Date(),
                    client: { clientName: "Acme", industry: "IT" },
                },
            ]);

        globalSettingsFindUniqueMock.mockResolvedValueOnce({
            zohoRefreshTokenEncrypted: null,
            googleRefreshTokenEncrypted: null,
        });

        gmailAccountFindManyMock.mockResolvedValueOnce([]);
    });

    it("includes backward-compatible and new smart dashboard fields", async () => {
        const { GET } = await import("@/app/api/stats/route");
        const res = await GET();
        const payload = await res.json();

        expect(res.status).toBe(200);
        expect(payload.success).toBe(true);
        expect(payload.data).toHaveProperty("stats");
        expect(payload.data).toHaveProperty("sourceStats");
        expect(payload.data).toHaveProperty("dataHealth");
        expect(payload.data).toHaveProperty("audienceState");
        expect(payload.data).toHaveProperty("campaignState");
        expect(payload.data).toHaveProperty("recommendedAction");
        expect(payload.data).toHaveProperty("processChecklist");
        expect(Array.isArray(payload.data.processChecklist)).toBe(true);
    }, 30000);
});
