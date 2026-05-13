import prisma from "@/lib/prisma";
import { isRoleBasedEmail } from "@/services/email-utils";

export type RelationshipLevel = "Active" | "Warm Lead" | "Past Client" | "Not Active";

export interface ListClientsParams {
  industries?: string[];
  levels?: RelationshipLevel[] | string[];
  serviceIds?: string[];
  sources?: string[];
  showRoleBased?: boolean;
  search?: string;
  sortField?: "lastInvoiceDate" | "createdAt" | "clientName" | "relationshipLevel" | "lastContacted";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  userId?: string;
  googleContactsOnly?: boolean;
}

const DEFAULT_PAGE_SIZE = 25;
const MIN_PAGE_SIZE = 5;
const MAX_PAGE_SIZE = 500;

export async function listClients(params: ListClientsParams) {
  const {
    industries = [],
    levels = [],
    serviceIds = [],
    sources = [],
    showRoleBased = false,
    search = "",
    sortField = "lastInvoiceDate",
    sortDir = "desc",
    page = 1,
    pageSize: rawPageSize = DEFAULT_PAGE_SIZE,
    userId,
    googleContactsOnly = false,
  } = params;

  const pageSize = Math.min(Math.max(rawPageSize || DEFAULT_PAGE_SIZE, MIN_PAGE_SIZE), MAX_PAGE_SIZE);
  const safePage = Math.max(page || 1, 1);

  const where: any = {
    ...(userId && { userId }),
    ...(industries.length > 0 && { industry: { in: industries } }),
    ...(levels.length > 0 && { relationshipLevel: { in: levels } }),
    ...(sources.length > 0 && { source: { in: sources as any } }),
    ...(googleContactsOnly && {
      metadata: { path: ["importChannels"], array_contains: "google_contacts" as any },
    }),
    isRoleBased: showRoleBased,
    ...(serviceIds.length > 0 && {
      services: {
        some: { id: { in: serviceIds } },
      },
    }),
    ...(search && {
      OR: [
        { clientName: { contains: search, mode: "insensitive" } },
        { contactPerson: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { industry: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  const orderBy =
    sortField === "clientName"
      ? [{ clientName: sortDir }]
      : sortField === "relationshipLevel"
      ? [{ relationshipLevel: sortDir }]
      : sortField === "lastContacted"
      ? [{ lastContacted: sortDir }]
      : sortField === "createdAt"
      ? [{ createdAt: sortDir }]
      : [
          { lastInvoiceDate: sortDir },
          { createdAt: "desc" as const },
        ];

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      select: {
        id: true,
        clientName: true,
        contactPerson: true,
        email: true,
        industry: true,
        relationshipLevel: true,
        source: true,
        isBlocked: true,
        isRoleBased: true,
        zohoTags: true,
        gmailSourceAccount: true,
        lastContacted: true,
        phone: true,
        mobile: true,
        gstin: true,
        clientSize: true,
        poc: true,
        lastInvoiceDate: true,
        address: true,
        clientAddedOn: true,
        invoiceServiceNames: true,
        externalId: true,
        services: {
          select: {
            id: true,
            serviceName: true,
          },
        },
      },
      orderBy,
      skip: (safePage - 1) * pageSize,
      take: pageSize,
    }),
    prisma.client.count({ where }),
  ]);

  return {
    data: clients,
    total,
    page: safePage,
    pageSize,
  };
}

export interface CreateClientInput {
  clientName: string;
  contactPerson?: string;
  email: string;
  industry?: string;
  relationshipLevel: RelationshipLevel;
  serviceIds: string[];
  userId?: string;
}

export async function createClient(input: CreateClientInput) {
  const { clientName, contactPerson, email, industry, relationshipLevel, serviceIds, userId } = input;

  return prisma.client.create({
    data: {
      clientName,
      contactPerson,
      email,
      industry: industry || "Other",
      relationshipLevel,
      isRoleBased: isRoleBasedEmail(email),
      ...(userId && { userId }),
      services: {
        connect: serviceIds.map((id) => ({ id })),
      },
    },
  });
}


