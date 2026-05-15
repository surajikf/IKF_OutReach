import prisma from "@/lib/prisma";

export type CampaignType = "Broadcast" | "Targeted" | "Cross-Sell" | "Reactivation" | "Reactivate" | string;
export type AudienceSource = "INVOICE_SYSTEM" | "ZOHO_BIGIN" | "GMAIL" | "GOOGLE_CONTACTS";
type AudienceSourceInput = AudienceSource | AudienceSource[];

function getRelationshipFilterForType(type: CampaignType) {
  const normalizedType = String(type || "").toLowerCase();

  // Use case-insensitive equality to avoid brittle status matching.
  if (normalizedType === "broadcast" || normalizedType === "cross-sell") {
    return {
      OR: [
        { relationshipLevel: { equals: "Active", mode: "insensitive" as const } },
        { relationshipLevel: { equals: "Warm Lead", mode: "insensitive" as const } },
        // Include non-active records so the user can decide in the preview pop.
        { relationshipLevel: { equals: "Not Active", mode: "insensitive" as const } },
        { relationshipLevel: { equals: "Inactive", mode: "insensitive" as const } },
      ],
    };
  }

  if (normalizedType === "reactivation" || normalizedType === "reactivate") {
    return {
      OR: [
        { relationshipLevel: { equals: "Past Client", mode: "insensitive" as const } },
        { relationshipLevel: { equals: "Not Active", mode: "insensitive" as const } },
        { relationshipLevel: { equals: "Inactive", mode: "insensitive" as const } },
      ],
    };
  }

  if (normalizedType === "targeted") {
    // Include both active and non-active records; final selection happens in `ClientPickerModal`.
    return {
      OR: [
        { relationshipLevel: { equals: "Active", mode: "insensitive" as const } },
        { relationshipLevel: { equals: "Not Active", mode: "insensitive" as const } },
        { relationshipLevel: { equals: "Inactive", mode: "insensitive" as const } },
      ],
    };
  }

  return {};
}

function buildAudienceWhere(
  audienceSourceInput: AudienceSourceInput,
  type: CampaignType,
  serviceFilters: string[] = [],
  serviceLogic: "AND" | "OR" = "OR",
  excludedIds: string[] = [],
  includeExclusions = false,
) {
  const sources = Array.isArray(audienceSourceInput) ? audienceSourceInput : [audienceSourceInput];
  const clauses: any[] = [
    { isBlocked: { not: true } },
  ];
  const relationshipFilter = getRelationshipFilterForType(type);

  // Smart default: if the user hasn't selected any service segmentation,
  // target all clients regardless of relationship status.
  // Once service filters are chosen, we apply campaign-type relationship logic.
  const hasRelationshipSegmentation =
    serviceFilters.length > 0 && !serviceFilters.includes("All");

  if (hasRelationshipSegmentation && Object.keys(relationshipFilter).length > 0) {
    clauses.push(relationshipFilter);
  }

  if (excludedIds.length > 0 && !includeExclusions) clauses.push({ id: { notIn: excludedIds } });

  const hasServiceSegmentation = sources.includes("INVOICE_SYSTEM") && serviceFilters.length > 0 && !serviceFilters.includes("All");
  const serviceQueries = hasServiceSegmentation
    ? serviceFilters.map((service) => ({ invoiceServiceNames: { contains: service, mode: "insensitive" as const } }))
    : [];

  const sourceClauses = sources.map((source) => {
    if (source === "GOOGLE_CONTACTS") {
      // Google Contacts are stored as source=GMAIL; distinguished by importChannels metadata
      return {
        AND: [
          { source: "GMAIL" as any },
          { metadata: { path: ["importChannels"], array_contains: "google_contacts" } },
        ],
      };
    }
    if (source === "GMAIL") {
      // All GMAIL-source clients (includes Google Contacts); deduplication in getTargetClients handles overlap
      return { AND: [{ source: "GMAIL" as any }] };
    }
    const srcClause: any[] = [{ source }];
    if (source === "INVOICE_SYSTEM" && serviceQueries.length > 0) {
      srcClause.push(serviceLogic === "AND" ? { AND: serviceQueries } : { OR: serviceQueries });
    }
    return { AND: srcClause };
  });

  clauses.push(sourceClauses.length === 1 ? sourceClauses[0] : { OR: sourceClauses });

  // isRoleBased at top level so the Prisma client extension (which auto-injects
  // isRoleBased on all Client reads) sees it as already set and does not override it.
  // { not: true } includes null (unset) contacts — Invoice/Zoho/Google Contacts clients
  // that were never explicitly flagged are treated as valid campaign targets.
  return { AND: clauses, isRoleBased: { not: true } };
}

export async function estimateCampaignAudience(
  audienceSource: AudienceSourceInput,
  type: CampaignType,
  serviceFilters: string[] = [],
  serviceLogic: 'AND' | 'OR' = 'OR',
  excludedIds: string[] = [],
  userId?: string,
) {
  const where: any = buildAudienceWhere(audienceSource, type, serviceFilters, serviceLogic, [], false);

  if (excludedIds.length > 0) {
    where.AND.push({ id: { notIn: excludedIds } });
  }

  const [count, industriesData] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.groupBy({ by: ["industry"], where, _count: { _all: true } }),
  ]);

  return {
    count,
    industries: industriesData.map((i) => i.industry),
  };
}

export interface CampaignHistoryFilter {
  limit?: number;
  search?: string;
  type?: string;
  ids?: string[];
  userId?: string;
  jobId?: string;
}

export async function listCampaignHistory(filter: CampaignHistoryFilter = {}) {
  const { limit = 50, search = "", type = "", ids = [], userId, jobId } = filter;

  const fetchingSpecific = ids.length > 0 || !!jobId;

  const where: any = {
    ...(!fetchingSpecific && {
      client: {
        isRoleBased: false,
      },
    }),
    ...(userId && { userId }),
  };

  if (ids.length > 0) {
    where.id = { in: ids };
  } else if (jobId) {
    where.jobId = jobId;
  }

  if (search) {
    where.OR = [
      { campaignTopic: { contains: search, mode: "insensitive" } },
      { generatedOutput: { contains: search, mode: "insensitive" } },
      { client: { clientName: { contains: search, mode: "insensitive" } } },
      { client: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  if (type && type !== "All") {
    where.campaignType = type;
  }

  let history = await prisma.campaignHistory.findMany({
    where,
    take: ids.length > 0 ? undefined : limit,
    orderBy: {
      dateCreated: "desc",
    },
    include: {
      client: true,
    },
  });

  // RAW FALLBACK: If standard query returned nothing but jobId was provided, 
  // it might be because the PrismaClient is stale and stripped the unknown 'jobId' field.
  if (history.length === 0 && jobId && !search && (!ids || ids.length === 0)) {
    try {
      const rawResults: any[] = await (prisma as any).$queryRawUnsafe(
        `SELECT id FROM "CampaignHistory" WHERE "jobId" = '${jobId}' ORDER BY "dateCreated" DESC LIMIT ${limit}`
      );
      if (rawResults.length > 0) {
        history = await prisma.campaignHistory.findMany({
          where: { id: { in: rawResults.map(r => r.id) } },
          include: { client: true },
          orderBy: { dateCreated: "desc" }
        });
      }
    } catch (e) {
      console.warn("[listCampaignHistory] Raw fallback failed:", e);
    }
  }

  if (ids.length === 0) {
    return history;
  }

  const orderMap = new Map(ids.map((id, index) => [id, index]));
  return history.sort((a, b) => {
    const aIndex = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return aIndex - bIndex;
  });
}

export async function getTargetClients(
  audienceSource: AudienceSourceInput,
  type: CampaignType,
  serviceFilters: string[] = [],
  serviceLogic: 'AND' | 'OR' = 'OR',
  excludedIds: string[] = [],
  includeExclusions: boolean = false,
  userId?: string,
) {
  const where: any = buildAudienceWhere(audienceSource, type, serviceFilters, serviceLogic, [], includeExclusions);

  if (excludedIds.length > 0 && !includeExclusions) {
    const excludedEmails = await prisma.client.findMany({
      where: { id: { in: excludedIds } },
      select: { email: true }
    }).then(l => l.map(c => c.email).filter((e): e is string => !!e));

    where.AND.push({
      NOT: {
        OR: [
          { id: { in: excludedIds } },
          { email: { in: excludedEmails } }
        ]
      }
    });
  }

  const clients = await prisma.client.findMany({
    where,
    select: {
      id: true,
      clientName: true,
      email: true,
      industry: true,
      contactPerson: true,
      relationshipLevel: true,
      clientAddedOn: true,
      lastInvoiceDate: true,
      invoiceServiceNames: true,
      source: true,
    },
    // Source priority for dedup: INVOICE_SYSTEM > ZOHO_BIGIN > GMAIL (Google Contacts fall under GMAIL)
    orderBy: [
      { source: "asc" },
      { clientName: "asc" },
    ],
  });

  // Deduplicate by email — each unique email receives exactly one campaign.
  // When the same email exists in multiple sources, the record with the richest
  // source is kept (INVOICE_SYSTEM > ZOHO_BIGIN > GMAIL/GOOGLE_CONTACTS).
  const SOURCE_PRIORITY: Record<string, number> = {
    INVOICE_SYSTEM: 0,
    ZOHO_BIGIN: 1,
    GMAIL: 2,
    MANUAL: 3,
  };
  const seen = new Map<string, typeof clients[number]>();
  for (const c of clients) {
    const key = String(c.email || "").toLowerCase().trim();
    if (!key) continue;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, c);
    } else {
      const existingPriority = SOURCE_PRIORITY[existing.source] ?? 99;
      const currentPriority = SOURCE_PRIORITY[c.source] ?? 99;
      if (currentPriority < existingPriority) seen.set(key, c);
    }
  }
  return Array.from(seen.values()).sort((a, b) =>
    String(a.clientName).localeCompare(String(b.clientName))
  );
}


