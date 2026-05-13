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
  const clauses: any[] = [{ isBlocked: false }, { isRoleBased: false }];
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
      // Google Contacts are stored as source=GMAIL with importChannels containing "google_contacts"
      return {
        AND: [
          { source: "GMAIL" },
          { metadata: { path: ["importChannels"], array_contains: "google_contacts" } },
          { email: { not: null } },
          { email: { not: "" } },
        ],
      };
    }
    if (source === "GMAIL") {
      // Plain Gmail — exclude pure Google Contacts directory entries to avoid double-count
      // when both GMAIL and GOOGLE_CONTACTS are selected simultaneously
      const gmailClause: any[] = [
        { source: "GMAIL" },
        { email: { not: null } },
        { email: { not: "" } },
      ];
      // If GOOGLE_CONTACTS is also selected, don't restrict further — dedup handles overlap
      return { AND: gmailClause };
    }
    const srcClause: any[] = [{ source }];
    if (source === "INVOICE_SYSTEM" && serviceQueries.length > 0) {
      srcClause.push(serviceLogic === "AND" ? { AND: serviceQueries } : { OR: serviceQueries });
    }
    return { AND: srcClause };
  });

  clauses.push(sourceClauses.length === 1 ? sourceClauses[0] : { OR: sourceClauses });
  return { AND: clauses };
}

export async function estimateCampaignAudience(
  audienceSource: AudienceSourceInput,
  type: CampaignType,
  serviceFilters: string[] = [],
  serviceLogic: 'AND' | 'OR' = 'OR',
  excludedIds: string[] = [],
  userId?: string,
) {
  const where: any = buildAudienceWhere(audienceSource, type, serviceFilters, serviceLogic, excludedIds, false);
  if (userId) where.userId = userId;

  // Sequentialize to avoid PgBouncer/Transaction mode concurrency hangs
  const count = await prisma.client.count({ where });
  const industriesData = await prisma.client.groupBy({
    by: ["industry"],
    where,
    _count: { _all: true },
  });

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
}

export async function listCampaignHistory(filter: CampaignHistoryFilter = {}) {
  const { limit = 50, search = "", type = "", ids = [], userId } = filter;

  const where: any = {
    client: {
      isRoleBased: false,
    },
    ...(userId && { userId }),
  };

  if (ids.length > 0) {
    where.id = { in: ids };
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

  const history = await prisma.campaignHistory.findMany({
    where,
    take: ids.length > 0 ? undefined : limit,
    orderBy: {
      dateCreated: "desc",
    },
    include: {
      client: true,
    },
  });

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
  const where: any = buildAudienceWhere(audienceSource, type, serviceFilters, serviceLogic, excludedIds, includeExclusions);
  if (userId) where.userId = userId;

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


