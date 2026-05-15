import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isRoleBasedEmail } from "@/services/email-utils";
import { createClient, listClients, RelationshipLevel } from "@/domain/clients";
import { z } from "zod";
import { ok, error } from "@/services/api-response";
import { parseJsonBody } from "@/services/validation";
import { getBackendSession, hasInvoiceAccess } from "@/services/auth";
import { after } from "next/server";

// Track if backfill has run this process lifetime to avoid re-running on every request
let _roleBackfillDone = false;

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
        const isAdmin = session?.user?.role === "ADMIN";
        // Admins can view the full invoice/zoho portfolio but Gmail/Google Contacts are personal
        // sync data — always scoped to the requesting user regardless of role.
        const scopedUserId = isAdmin ? undefined : userId;
        const { searchParams } = new URL(request.url);
        const industries = searchParams.getAll("industry");
        const levels = searchParams.getAll("level");
        const serviceIds = searchParams.getAll("service");
        const requestedSources = searchParams.getAll("source");
        const canUseInvoice = await hasInvoiceAccess(request);
        const allowedRequestedSources = requestedSources.length > 0
            ? requestedSources.filter((s) => canUseInvoice || s !== "INVOICE_SYSTEM")
            : (canUseInvoice ? [] : ["ZOHO_BIGIN", "GMAIL", "MANUAL"]);
        const wantsGoogleContacts = allowedRequestedSources.includes("GOOGLE_CONTACTS");
        const sources = allowedRequestedSources.filter((s) => s !== "GOOGLE_CONTACTS");
        if (wantsGoogleContacts && !sources.includes("GMAIL")) {
            sources.push("GMAIL");
        }
        const showRoleBased = (searchParams.get("roleBased") === "true") || (searchParams.get("showRoleBased") === "true");
        const isSmartView = searchParams.get("smart") === "true";
        const search = searchParams.get("search")?.trim() || "";
        const sortField = (searchParams.get("sortField") || "lastInvoiceDate") as any;
        const sortDir = (searchParams.get("sortDir") === "asc" ? "asc" : "desc") as "asc" | "desc";

        const page = Math.max(parseInt(searchParams.get("page") || "1", 10) || 1, 1);
        const pageSizeRaw = parseInt(searchParams.get("pageSize") || "25", 10) || 25;

        // Fetch granular source stats for the mini dashboard
        // Invoice records are org-wide (no userId). For users with invoice access, don't apply userId
        // scope on invoice source — use OR(userId, source=INVOICE_SYSTEM) instead.
        const userScope = scopedUserId ? { userId: scopedUserId } : {};
        const gmailUserScope = userId ? { userId } : {};
        // Stats base: for non-admin users with invoice access, show their own records + all invoice records
        const statsBaseWhere: any = scopedUserId && canUseInvoice
            ? { OR: [{ userId: scopedUserId }, { source: "INVOICE_SYSTEM" }] }
            : { ...userScope, ...(canUseInvoice ? {} : { source: { not: "INVOICE_SYSTEM" } }) };
        const gmailStatsBaseWhere: any = { ...gmailUserScope };
        const [sourceStatsRaw, gmailStatsRaw, gmailAccounts, googleContactsStatsRaw, roleBasedStatsRaw] = await Promise.all([
            prisma.client.groupBy({
                by: ['source', 'relationshipLevel'],
                _count: { _all: true },
                where: statsBaseWhere,
            }),
            prisma.client.groupBy({
                by: ['gmailSourceAccount'],
                where: { ...gmailStatsBaseWhere, source: 'GMAIL' },
                _count: { _all: true }
            }),
            prisma.gmailAccount.findMany({
                where: userId ? { userId } : undefined,
                select: { accountName: true, email: true }
            }),
            prisma.client.groupBy({
                by: ['relationshipLevel'],
                _count: { _all: true },
                where: {
                    ...gmailStatsBaseWhere,
                    source: 'GMAIL',
                    metadata: { path: ["importChannels"], array_contains: "google_contacts" },
                },
            }),
            prisma.client.groupBy({
                by: ['source', 'isRoleBased'],
                _count: { _all: true },
                where: statsBaseWhere,
            }),
        ]);

        // Initialize structured stats
        const sourceStats: any = {};
        sourceStatsRaw.forEach(curr => {
            const s = curr.source;
            if (!sourceStats[s]) sourceStats[s] = { total: 0, active: 0, inactive: 0 };
            // Gmail rows are personal — count only the requesting user's synced contacts for the tab badge
            if (s === 'GMAIL') return;
            sourceStats[s].total += curr._count._all;
            if (curr.relationshipLevel === 'Active') {
                sourceStats[s].active += curr._count._all;
            } else {
                sourceStats[s].inactive += curr._count._all;
            }
        });

        // Gmail tab badge: always scoped to requesting user
        const gmailUserStats = await prisma.client.groupBy({
            by: ['relationshipLevel'],
            _count: { _all: true },
            where: { ...gmailUserScope, source: 'GMAIL' },
        });
        if (gmailUserStats.length > 0) {
            sourceStats['GMAIL'] = gmailUserStats.reduce((acc: any, curr: any) => {
                acc.total += curr._count._all;
                if (curr.relationshipLevel === 'Active') acc.active += curr._count._all;
                else acc.inactive += curr._count._all;
                return acc;
            }, { total: 0, active: 0, inactive: 0 });
        }

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
        if (googleContactsStatsRaw.length > 0) {
            sourceStats['GOOGLE_CONTACTS'] = googleContactsStatsRaw.reduce((acc: any, curr: any) => {
                acc.total += curr._count._all;
                if (curr.relationshipLevel === "Active") acc.active += curr._count._all;
                else acc.inactive += curr._count._all;
                return acc;
            }, { total: 0, active: 0, inactive: 0 });
        }

        // Attach generic/roleBased counts to each source stat entry
        const roleBasedMap: Record<string, { generic: number; roleBased: number }> = {};
        const addToRoleMap = (map: Record<string, { generic: number; roleBased: number }>, key: string, r: any) => {
            if (!map[key]) map[key] = { generic: 0, roleBased: 0 };
            if (r.isRoleBased === true) map[key].roleBased += r._count._all;
            else map[key].generic += r._count._all; // false AND null both treated as generic
        };
        roleBasedStatsRaw.forEach((r: any) => addToRoleMap(roleBasedMap, r.source, r));
        // For GMAIL use user-scoped counts
        const gmailRoleRaw = await prisma.client.groupBy({
            by: ['isRoleBased'],
            _count: { _all: true },
            where: { ...gmailUserScope, source: 'GMAIL' },
        });
        roleBasedMap['GMAIL'] = { generic: 0, roleBased: 0 };
        gmailRoleRaw.forEach((r: any) => addToRoleMap(roleBasedMap, 'GMAIL', r));
        // For GOOGLE_CONTACTS use user-scoped + importChannels filter
        const gcRoleRaw = await prisma.client.groupBy({
            by: ['isRoleBased'],
            _count: { _all: true },
            where: { ...gmailUserScope, source: 'GMAIL', metadata: { path: ["importChannels"], array_contains: "google_contacts" } },
        });
        roleBasedMap['GOOGLE_CONTACTS'] = { generic: 0, roleBased: 0 };
        gcRoleRaw.forEach((r: any) => addToRoleMap(roleBasedMap, 'GOOGLE_CONTACTS', r));
        Object.keys(sourceStats).forEach(s => {
            const rb = roleBasedMap[s];
            if (rb) { sourceStats[s].generic = rb.generic; sourceStats[s].roleBased = rb.roleBased; }
        });

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
            ...userScope,
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

        // Gmail/Google Contacts rows are personal — always filter by the requesting user's ID
        const isGmailOnlyQuery = sources.length > 0 && sources.every((s) => s === "GMAIL");
        const effectiveUserId = isGmailOnlyQuery ? userId : scopedUserId;

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
            userId: effectiveUserId,
            googleContactsOnly: wantsGoogleContacts,
            invoiceAccess: canUseInvoice,
        });

        const emails = clients
            .map((c) => c.email?.toLowerCase().trim())
            .filter((e): e is string => !!e);

        let duplicateInfoByEmail = new Map<string, { count: number; sources: Set<string> }>();

        if (emails.length > 0) {
            const duplicateScope =
                userId && canUseInvoice
                    ? { OR: [{ userId }, { source: "INVOICE_SYSTEM" as const }] }
                    : userId
                        ? { userId }
                        : {};
            const allWithEmails = await prisma.client.findMany({
                where: {
                    ...duplicateScope,
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

        // One-time background backfill: fix any stale isRoleBased values in the DB
        if (!_roleBackfillDone) {
            _roleBackfillDone = true;
            after(async () => {
                try {
                    const all = await prisma.client.findMany({ select: { id: true, email: true, isRoleBased: true } });
                    const toFix = all.filter(c => c.email && isRoleBasedEmail(c.email) !== c.isRoleBased);
                    if (toFix.length > 0) {
                        await Promise.all(toFix.map(c =>
                            prisma.client.update({ where: { id: c.id }, data: { isRoleBased: isRoleBasedEmail(c.email!) } }).catch(() => {})
                        ));
                        console.log(`[BACKFILL] Fixed isRoleBased for ${toFix.length} records.`);
                    }
                } catch (e) {
                    console.error("[BACKFILL] isRoleBased backfill failed:", e);
                }
            });
        }

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
        const safeMessage =
            typeof err?.message === "string" && err.message.trim().length > 0
                ? err.message
                : "Unexpected server failure while loading clients.";
        return error("INTERNAL_ERROR", `API Logic Failed: ${safeMessage}`, { 
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
        const session = await getBackendSession(request);
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
            userId: session?.user?.id,
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

