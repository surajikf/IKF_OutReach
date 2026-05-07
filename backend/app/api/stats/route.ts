import prisma from "@/backend/lib/prisma";
import { startOfDay, subDays } from "date-fns";
import { ok, error } from "@/backend/lib/api-response";
import { getBackendSession } from "@/backend/lib/auth";
import {
    buildProcessChecklist,
    computeAudienceState,
    computeCampaignState,
    computeDataHealth,
    pickNextBestAction,
} from "@/shared/lib/dashboard-logic";

export async function GET(request: Request) {
    try {
        const session = await getBackendSession(request);
        const userId = session?.user?.id;
        type SourceCount = { source: string; gmailSourceAccount: string | null; _count: number };
        type DailyCampaign = { dateCreated: Date };
        type DailyClient = { createdAt: Date };
        type ServiceUsage = { serviceName: string; _count?: { clients?: number } };

        // 1. Core Stats & Distribution in one pass using aggregations/parallel counts
        const thirtyDaysAgo = subDays(new Date(), 30);
        const sevenDaysAgo = subDays(startOfDay(new Date()), 6);

        const [
            levelCounts,
            trendCounts,
            industryCountsRaw,
            serviceUtilizationRaw,
            dataIntegrityRaw,
            dailyActivityRaw,
            recentCampaigns,
            sourceCountsRaw,
            campaigns7dCount
        ] = await Promise.all([
            // Level distribution
            prisma.client.groupBy({
                by: ['relationshipLevel'],
                _count: true
            }),
            // Monthly trends
            Promise.all([
                prisma.client.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
                prisma.campaignHistory.count({ where: { dateCreated: { gte: thirtyDaysAgo } } })
            ]),
            // Industry distribution (Top 5)
            prisma.client.groupBy({
                by: ['industry'],
                _count: true,
                orderBy: { _count: { industry: 'desc' } },
                take: 5
            }),
            // Service utilization
            prisma.service.findMany({
                select: {
                    serviceName: true,
                    _count: {
                        select: {
                            clients: true
                        }
                    }
                },
                orderBy: { clients: { _count: 'desc' } }
            }),
            // Data integrity (count missing fields instead of fetching all)
            Promise.all([
                prisma.client.count(),
                prisma.client.count({
                    where: {
                        AND: [
                            { contactPerson: { not: null } },
                            { contactPerson: { not: "" } },
                            { email: { not: "" } },
                            { services: { some: {} } }
                        ]
                    }
                })
            ]),
            // Daily activity for chart
            Promise.all([
                prisma.campaignHistory.findMany({
                    where: { dateCreated: { gte: sevenDaysAgo } },
                    select: { dateCreated: true }
                }),
                prisma.client.findMany({
                    where: { createdAt: { gte: sevenDaysAgo } },
                    select: { createdAt: true }
                })
            ]),
            // Recent activity
            prisma.campaignHistory.findMany({
                take: 6,
                orderBy: { dateCreated: "desc" },
                select: {
                    id: true,
                    campaignType: true,
                    dateCreated: true,
                    client: {
                        select: {
                            clientName: true,
                            industry: true
                        }
                    }
                }
            }),
            // Source Breakdown
            prisma.client.groupBy({
                by: ['source', 'gmailSourceAccount'],
                _count: true
            }),
            prisma.campaignHistory.count({
                where: { dateCreated: { gte: sevenDaysAgo } }
            }),
        ]);

        // Integration readiness (used for "Verify data health and integrations")
        const [integrationConfig, gmailAccounts] = await Promise.all([
            prisma.globalSettings.findUnique({
                where: { id: "singleton" },
                select: {
                    googleRefreshTokenEncrypted: true,
                },
            }),
            prisma.gmailAccount.findMany({
                where: userId ? { userId } : undefined,
                select: { accountName: true, email: true }
            }),
        ]);
        const zohoConnected = userId ? await prisma.zohoConnection.count({ where: { userId } }) : 0;
        const integrationReady = !!(zohoConnected > 0 || integrationConfig?.googleRefreshTokenEncrypted || gmailAccounts.length > 0);

        const totalClients = dataIntegrityRaw[0];
        const completeProfiles = dataIntegrityRaw[1];
        const [newClientsLastMonth, campaignsLastMonth] = trendCounts;
        const [dailyCampaignsRaw, dailyClientsRaw] = dailyActivityRaw;
        const noContact30d = await prisma.client.count({
            where: {
                OR: [
                    { lastContacted: null },
                    { lastContacted: { lt: thirtyDaysAgo } },
                ],
            },
        });

        // Process Source Counts
        const sourceStats = {
            zoho: 0,
            invoice: 0,
            gmail: [] as { email: string, nametext: string, count: number }[]
        };

        const gmailAccountMap = new Map<string, number>();
        let gmailUnassigned = 0;

        (sourceCountsRaw as SourceCount[]).forEach((sc) => {
            if (sc.source === 'ZOHO_BIGIN') sourceStats.zoho += sc._count;
            if (sc.source === 'INVOICE_SYSTEM') sourceStats.invoice += sc._count;
            if (sc.source === 'GMAIL') {
                const source = sc.gmailSourceAccount?.trim();
                if (!source) {
                    gmailUnassigned += sc._count;
                } else {
                    // Try to resolve exactly or by name
                    const account = gmailAccounts.find(a => 
                        a.email.toLowerCase() === source.toLowerCase() || 
                        a.accountName.toLowerCase() === source.toLowerCase()
                    );
                    
                    if (account) {
                        gmailAccountMap.set(account.email, (gmailAccountMap.get(account.email) || 0) + sc._count);
                    } else if (gmailAccounts.length === 1) {
                        // If only one account, and it's a generic source string, map it
                        const soleAccount = gmailAccounts[0];
                        gmailAccountMap.set(soleAccount.email, (gmailAccountMap.get(soleAccount.email) || 0) + sc._count);
                    } else {
                        // Truly legacy/unassigned string with multiple accounts connected
                        gmailUnassigned += sc._count;
                    }
                }
            }
        });

        // Convert Map to Array for SourceStats
        sourceStats.gmail = Array.from(gmailAccountMap.entries()).map(([email, count]) => {
            const acc = gmailAccounts.find(a => a.email === email);
            return {
                email,
                nametext: acc?.accountName || "Connected Node",
                count
            };
        });

        if (gmailUnassigned > 0) {
            sourceStats.gmail.push({
                email: 'Unassigned',
                nametext: 'Legacy Syncs',
                count: gmailUnassigned
            });
        }

        // Process Level Counts
        const statsMap: Record<string, number> = { "Active": 0, "Warm Lead": 0, "Past Client": 0 };
        levelCounts.forEach(c => {
            if (c.relationshipLevel in statsMap) statsMap[c.relationshipLevel] = c._count;
        });
        const activeClientsCount = statsMap["Active"] || 0;
        const warmLeadsCount = statsMap["Warm Lead"] || 0;
        const pastClientsCount = statsMap["Past Client"] || 0;
        const lastCampaignAt = recentCampaigns[0]?.dateCreated ?? null;
        const dataHealth = computeDataHealth(totalClients, completeProfiles, noContact30d);
        const audienceState = computeAudienceState(totalClients, activeClientsCount, warmLeadsCount, pastClientsCount, noContact30d);
        const campaignState = computeCampaignState(campaigns7dCount, campaignsLastMonth, lastCampaignAt);
        const recommendedAction = pickNextBestAction({
            totalClients,
            activeClients: activeClientsCount,
            warmLeads: warmLeadsCount,
            pastClients: pastClientsCount,
            completeProfiles,
            campaigns7d: campaigns7dCount,
            campaigns30d: campaignsLastMonth,
            noContact30d,
            lastCampaignAt,
        });
        const processChecklist = buildProcessChecklist(dataHealth, campaignState, recommendedAction, integrationReady);

        // Process Chart Data & Sparklines
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const date = subDays(startOfDay(new Date()), 6 - i);
            return {
                label: date.toLocaleDateString('en-US', { weekday: 'short' }),
                dateString: date.toDateString(),
                campaigns: 0,
                clients: 0
            };
        });

        (dailyCampaignsRaw as DailyCampaign[]).forEach((c) => {
            const dateStr = new Date(c.dateCreated).toDateString();
            const day = last7Days.find(d => d.dateString === dateStr);
            if (day) day.campaigns++;
        });

        (dailyClientsRaw as DailyClient[]).forEach((c) => {
            const dateStr = new Date(c.createdAt).toDateString();
            const day = last7Days.find(d => d.dateString === dateStr);
            if (day) day.clients++;
        });

        return ok({
            stats: {
                totalClients,
                activeClients: statsMap["Active"],
                warmLeads: statsMap["Warm Lead"],
                pastClients: statsMap["Past Client"],
                trends: {
                    clients: `+${newClientsLastMonth}`,
                    engagement: `+${campaignsLastMonth}`,
                    growth: totalClients > 0 ? `+${Math.round((newClientsLastMonth / totalClients) * 100)}%` : "0%",
                    sparklines: {
                        clients: last7Days.map(d => d.clients),
                        campaigns: last7Days.map(d => d.campaigns)
                    }
                }
            },
            chartData: last7Days.map(({ label, campaigns }) => ({ label, value: campaigns })),
            industryDistribution: industryCountsRaw.map(i => ({ label: i.industry || "Other", value: i._count })),
            serviceUtilization: (serviceUtilizationRaw as ServiceUsage[]).map((s) => ({ label: s.serviceName, value: s._count?.clients || 0 })),
            integrityScore: totalClients > 0 ? Math.round((completeProfiles / totalClients) * 100) : 100,
            recentCampaigns: recentCampaigns.map(c => ({
                id: c.id,
                clientName: c.client?.clientName || "Unknown Client",
                industry: c.client?.industry || "Market",
                type: c.campaignType,
                date: c.dateCreated,
                status: "Sent"
            })),
            sourceStats
            ,
            dataHealth,
            audienceState,
            campaignState,
            recommendedAction,
            processChecklist,
            updatedAt: new Date().toISOString(),
            confidence: totalClients >= 20 ? "High" : totalClients >= 5 ? "Medium" : "Low",
        });
    } catch (err) {
        console.error("Failed to fetch stats:", err);
        return error("INTERNAL_ERROR", "Failed to fetch stats");
    }
}
