import prisma from "@/backend/lib/prisma";

export type CampaignType = "Broadcast" | "Targeted" | "Cross-Sell" | "Reactivation" | "Reactivate" | string;
export type AudienceSource = "INVOICE_SYSTEM" | "ZOHO_BIGIN" | "GMAIL";

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
  audienceSource: AudienceSource,
  type: CampaignType,
  serviceFilters: string[] = [],
  serviceLogic: "AND" | "OR" = "OR",
  excludedIds: string[] = [],
  includeExclusions = false,
) {
  const clauses: any[] = [
    { isBlocked: false },
    { isRoleBased: false },
    { source: audienceSource },
  ];
  const relationshipFilter = getRelationshipFilterForType(type);

  // Smart default: if the user hasn't selected any service segmentation,
  // target all clients regardless of relationship status.
  // Once service filters are chosen, we apply campaign-type relationship logic.
  const hasServiceSegmentation =
    serviceFilters.length > 0 && !serviceFilters.includes("All");

  if (hasServiceSegmentation && Object.keys(relationshipFilter).length > 0) {
    clauses.push(relationshipFilter);
  }

  if (excludedIds.length > 0 && !includeExclusions) {
    clauses.push({ id: { notIn: excludedIds } });
  }

  // Ultra-Smart Multi-Service Segmentation
  if (audienceSource === "INVOICE_SYSTEM" && serviceFilters.length > 0 && !serviceFilters.includes("All")) {
    const serviceQueries = serviceFilters.map((service) => ({
      invoiceServiceNames: { contains: service, mode: "insensitive" as const },
    }));

    clauses.push(serviceLogic === "AND" ? { AND: serviceQueries } : { OR: serviceQueries });
  }

  return clauses.length > 0 ? { AND: clauses } : {};
}

export async function estimateCampaignAudience(
  audienceSource: AudienceSource,
  type: CampaignType,
  serviceFilters: string[] = [],
  serviceLogic: 'AND' | 'OR' = 'OR',
  excludedIds: string[] = []
) {
  const where = buildAudienceWhere(audienceSource, type, serviceFilters, serviceLogic, excludedIds, false);

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
}

export async function listCampaignHistory(filter: CampaignHistoryFilter = {}) {
  const { limit = 50, search = "", type = "" } = filter;

  const where: any = {
    client: {
      isRoleBased: false,
    },
  };

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
    take: limit,
    orderBy: {
      dateCreated: "desc",
    },
    include: {
      client: true,
    },
  });

  return history;
}

export async function getTargetClients(
  audienceSource: AudienceSource,
  type: CampaignType,
  serviceFilters: string[] = [],
  serviceLogic: 'AND' | 'OR' = 'OR',
  excludedIds: string[] = [],
  includeExclusions: boolean = false
) {
  const where = buildAudienceWhere(audienceSource, type, serviceFilters, serviceLogic, excludedIds, includeExclusions);

  return await prisma.client.findMany({
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
    orderBy: { clientName: "asc" },
  });
}

