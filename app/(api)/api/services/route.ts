import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ok, error } from "@/services/api-response";
import { hasInvoiceAccess } from "@/services/auth";
import { Prisma } from "@prisma/client";

// Simple in-memory cache for services to prevent pool exhaustion
let servicesCache: any[] | null = null;
let lastCacheUpdate = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(request: Request) {
    try {
        console.time("fetchServicesAPI");
        
        // Return cached services if available and not expired
        const now = Date.now();
        if (servicesCache && (now - lastCacheUpdate < CACHE_TTL)) {
            console.log("[Services API] Returning cached results");
            console.timeEnd("fetchServicesAPI");
            return ok(servicesCache);
        }

        const canUseInvoice = await hasInvoiceAccess(request);
        const services = await prisma.service.findMany({
            orderBy: {
                serviceName: "asc",
            },
        });
        if (services.length > 0) {
            servicesCache = services;
            lastCacheUpdate = now;
            console.timeEnd("fetchServicesAPI");
            return ok(services);
        }
        if (!canUseInvoice) {
            console.timeEnd("fetchServicesAPI");
            return ok([]);
        }

        // Fallback: derive service list from imported client invoice services when Service table is empty.
        const clients = await prisma.client.findMany({
            select: { invoiceServiceNames: true },
            where: { invoiceServiceNames: { not: null } },
        });

        const seen = new Set<string>();
        const inferred = [] as Array<{ id: string; serviceName: string; category: string | null; description: string | null }>;
        let idx = 0;

        for (const c of clients) {
            const raw = c.invoiceServiceNames || "";
            if (!raw) continue;

            for (const part of raw.split(/[,\n;|]+/)) {
                const name = part.trim();
                if (!name) continue;
                const key = name.toLowerCase();
                if (seen.has(key)) continue;
                seen.add(key);
                idx += 1;
                inferred.push({
                    id: `inferred-${idx}`,
                    serviceName: name,
                    category: "Imported",
                    description: null,
                });
            }
        }

        inferred.sort((a, b) => a.serviceName.localeCompare(b.serviceName));
        
        // Cache the inferred results too
        servicesCache = inferred;
        lastCacheUpdate = now;
        
        console.timeEnd("fetchServicesAPI");
        return ok(inferred);
    } catch (err) {
        console.error("Failed to fetch services:", err);
        return error("INTERNAL_ERROR", "Failed to fetch services");
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { serviceName, category, description } = body;

        if (!serviceName) {
            return error("BAD_REQUEST", "Service name is required.");
        }

        const newService = await prisma.service.create({
            data: {
                serviceName,
                category,
                description,
            },
        });

        // Invalidate cache on new service creation
        servicesCache = null;
        lastCacheUpdate = 0;

        return ok(newService);
    } catch (err: any) {
        if (err.code === 'P2002') {
            return error("CONFLICT", "A service with this name already exists in the matrix.");
        }
        console.error("Failed to create service:", err);
        return error("INTERNAL_ERROR", "Failed to create service");
    }
}

