import { NextResponse } from "next/server";
import prisma from "@/backend/lib/prisma";
import { isRoleBasedEmail } from "@/backend/lib/email-utils";
import { createClient, listClients, RelationshipLevel } from "@/backend/domain/clients";
import { z } from "zod";
import { ok, error } from "@/backend/lib/api-response";
import { parseJsonBody } from "@/backend/lib/validation";
import { getBackendSession, hasInvoiceAccess } from "@/backend/lib/auth";

function computeClientQuality(client: {
    email: string | null;
    industry: string | null;
    services: { id: string }[];
    invoiceServiceNames: string | null;
    phone: string | null;
    mobile: string | null;
    gstin: string | null;
}) {
    const missingFields: string[] = [];

    const email = client.email?.trim() || "";
    const hasEmail = !!email;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailValid = hasEmail && emailRegex.test(email);

    if (!hasEmail) missingFields.push("email");
    else if (!emailValid) missingFields.push("email_invalid");

    if (!client.industry) missingFields.push("industry");

    const hasStructuredServices = Array.isArray(client.services) && client.services.length > 0;
    const hasInvoiceServices = !!client.invoiceServiceNames;
    if (!hasStructuredServices && !hasInvoiceServices) missingFields.push("services");

    const hasAnyPhone = !!(client.phone || client.mobile);
    if (!hasAnyPhone) missingFields.push("phone");

    if (!client.gstin) missingFields.push("gstin");

    const maxSignals = 5;
    const missingCount = Math.min(missingFields.length, maxSignals);
    const completenessScore = Math.max(0, Math.round(((maxSignals - missingCount) / maxSignals) * 100));

    let level: "strong" | "medium" | "weak";
    if (completenessScore >= 80) level = "strong";
    else if (completenessScore >= 50) level = "medium";
    else level = "weak";

    return {
        completenessScore,
        level,
        missingFields,
    };
}

const createClientSchema = z.object({
    clientName: z.string().min(1, "Client name is required"),
    contactPerson: z.string().optional().nullable(),
    email: z.string()
        .min(1, "At least one email is required")
        .refine(
            (val) => val.split(',').every(e => z.string().email().safeParse(e.trim()).success),
            { message: "One or more email addresses are invalid" }
        ),
    industry: z.string().optional().nullable(),
    relationshipLevel: z.custom<RelationshipLevel>().default("Active"),
    serviceIds: z.array(z.string().min(1)).default([]),
});

export async function GET(request: Request) {
    try {
        const session = await getBackendSession(request);
        const userId = session?.user?.id;
        const { searchParams } = new URL(request.url);
        const industries = searchParams.getAll("industry");
        const levels = searchParams.getAll("level");
        const serviceIds = searchParams.getAll("service");
        const requestedSources = searchParams.getAll("source");
        const canUseInvoice = await hasInvoiceAccess(request);
        const sources = requestedSources.length > 0
            ? requestedSources.filter((s) => canUseInvoice || s !== "INVOICE_SYSTEM")
            : (canUseInvoice ? [] : ["ZOHO_BIGIN", "GMAIL", "MANUAL"]);
        const showRoleBased = (searchParams.get("roleBased") === "true") || (searchParams.get("showRoleBased") === "true");
        const isSmartView = searchParams.get("smart") === "true";
        const search = searchParams.get("search")?.trim() || "";
        const sortField = (searchParams.get("sortField") || "lastInvoiceDate") as any;
        const sortDir = (searchParams.get("sortDir") === "asc" ? "asc" : "desc") as "asc" | "desc";

        const page = Math.max(parseInt(searchParams.get("page") || "1", 10) || 1, 1);
        const pageSizeRaw = parseInt(searchParams.get("pageSize") || "25", 10) || 25;

        // Fetch granular source stats for the mini dashboard
        const statsBaseWhere: any = canUseInvoice ? {} : { source: { not: "INVOICE_SYSTEM" } };
        const [sourceStatsRaw, gmailStatsRaw, gmailAccounts] = await Promise.all([
            prisma.client.groupBy({
                by: ['source', 'relationshipLevel'],
                _count: { _all: true },
                where: statsBaseWhere,
            }),
            prisma.client.groupBy({
                by: ['gmailSourceAccount'],
                where: { ...statsBaseWhere, source: 'GMAIL' },
                _count: { _all: true }
            }),
            prisma.gmailAccount.findMany({
                where: userId ? { userId } : undefined,
                select: { accountName: true, email: true }
            }),
        ]);

        // Initialize structured stats
        const sourceStats: any = {};
        sourceStatsRaw.forEach(curr => {
            const s = curr.source;
            if (!sourceStats[s]) sourceStats[s] = { total: 0, active: 0, inactive: 0 };
            sourceStats[s].total += curr._count._all;
            if (curr.relationshipLevel === 'Active') {
                sourceStats[s].active += curr._count._all;
            } else {
                sourceStats[s].inactive += curr._count._all;
            }
        });

        // Add Gmail specifics
        if (sourceStats['GMAIL']) {
            sourceStats['GMAIL'].accounts = gmailStatsRaw.reduce((acc: any, curr: any) => {
                const key = curr.gmailSourceAccount || 'Unknown';
                const account = gmailAccounts.find(a => a.accountName === key || a.email === key);
                const resolvedKey = account ? account.email : key;
                acc[resolvedKey] = (acc[resolvedKey] || 0) + curr._count._all;
                return acc;
            }, {});
        }

        // Add Zoho specifics (Tags breakdown for the mini-dashboard tooltips)
        if (sourceStats['ZOHO_BIGIN']) {
            const zohoClients = await prisma.client.findMany({
                where: { ...statsBaseWhere, source: 'ZOHO_BIGIN' },
                select: { zohoTags: true }
            });
            
            const tagCounts: Record<string, number> = {};
            zohoClients.forEach(c => {
                (c.zohoTags || []).forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            });
            sourceStats['ZOHO_BIGIN'].accounts = tagCounts;
        }

        // Fetch Filter Distribution Stats (Smart Targeting Data)
        const statsWhere = {
            isRoleBased: showRoleBased,
            isBlocked: false,
            ...(canUseInvoice ? {} : { source: { not: "INVOICE_SYSTEM" as const } }),
        };

        const [industryGroup, levelGroup, serviceGroup] = await Promise.all([
            prisma.client.groupBy({
                by: ['industry'],
                _count: { _all: true },
                where: statsWhere
            }),
            prisma.client.groupBy({
                by: ['relationshipLevel'],
                _count: { _all: true },
                where: statsWhere
            }),
            prisma.service.findMany({
                select: {
                    id: true,
                    serviceName: true,
                    _count: { 
                        select: { 
                            clients: { where: statsWhere } 
                        } 
                    }
                }
            })
        ]);


        const filterStats = {
            industries: (industryGroup as any[]).reduce((acc, curr) => {
                if (curr.industry) acc[curr.industry] = curr._count._all;
                return acc;
            }, {} as Record<string, number>),
            levels: (levelGroup as any[]).reduce((acc, curr) => {
                if (curr.relationshipLevel) acc[curr.relationshipLevel] = curr._count._all;
                return acc;
            }, {} as Record<string, number>),
            services: serviceGroup.reduce((acc, curr) => {
                acc[curr.id] = (curr as any)._count.clients;
                return acc;
            }, {} as Record<string, number>)
        };

        const { data: clients, total, page: resolvedPage, pageSize } = await listClients({
            industries,
            levels,
            serviceIds,
            sources,
            showRoleBased,
            search,
            sortField,
            sortDir,
            page,
            pageSize: pageSizeRaw,
        });

        const emails = clients
            .map((c) => c.email?.toLowerCase().trim())
            .filter((e): e is string => !!e);

        let duplicateInfoByEmail = new Map<string, { count: number; sources: Set<string> }>();

        if (emails.length > 0) {
            const allWithEmails = await prisma.client.findMany({
                where: {
                    email: { in: emails },
                },
                select: {
                    email: true,
                    source: true,
                },
            });

            duplicateInfoByEmail = allWithEmails.reduce((map, row) => {
                const email = row.email?.toLowerCase().trim();
                if (!email) return map;
                const existing = map.get(email) || { count: 0, sources: new Set<string>() };
                existing.count += 1;
                if (row.source) existing.sources.add(row.source);
                map.set(email, existing);
                return map;
            }, new Map<string, { count: number; sources: Set<string> }>());
        }

        const enrichedClients = clients.map((client) => {
            const baseQuality = computeClientQuality({
                email: client.email,
                industry: client.industry,
                services: client.services,
                invoiceServiceNames: client.invoiceServiceNames,
                phone: client.phone,
                mobile: client.mobile,
                gstin: client.gstin,
            });

            const emailKey = client.email?.toLowerCase().trim() || "";
            const dupInfo = emailKey ? duplicateInfoByEmail.get(emailKey) : undefined;
            const hasDuplicates = !!dupInfo && dupInfo.count > 1;
            const hasCrossSourceConflict = !!dupInfo && dupInfo.sources.size > 1;

            return {
                ...client,
                quality: {
                    ...baseQuality,
                    hasDuplicates,
                    hasCrossSourceConflict,
                    sources: dupInfo ? Array.from(dupInfo.sources) : [],
                },
            };
        });

        return ok({
            clients: enrichedClients,
            total,
            page: resolvedPage,
            pageSize,
            sourceStats,
            filterStats
        });
    } catch (err: any) {
        console.error("CRITICAL API ERROR:", err);
        return error("INTERNAL_ERROR", `API Logic Failed: ${err.message || 'Unknown Error'}`, { 
            details: { 
                name: err.name,
                stack: err.stack,
                prismaCode: err.code,
                prismaMeta: err.meta
            }
        });
    }
}

export async function POST(request: Request) {
    try {
        const parsed = await parseJsonBody(createClientSchema, request);
        if (!parsed.ok) {
            return parsed.response;
        }

        const body = parsed.data;

        const client = await createClient({
            clientName: body.clientName,
            contactPerson: body.contactPerson ?? undefined,
            email: body.email,
            industry: body.industry ?? undefined,
            relationshipLevel: body.relationshipLevel,
            serviceIds: body.serviceIds || [],
        });

        return ok(client);
    } catch (err: any) {
        if (err.code === 'P2002') {
            return error("CONFLICT", "A client with this email already exists.");
        }
        console.error("Failed to create client:", err);
        return error("INTERNAL_ERROR", "Failed to create client");
    }
}
