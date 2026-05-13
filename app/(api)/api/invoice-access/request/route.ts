import prisma from "@/lib/prisma";
import { ok, error } from "@/services/api-response";
import { getBackendSession } from "@/services/auth";

const REQUEST_FLAG = "invoice_access_requested";

export async function POST(request: Request) {
    try {
        const session = await getBackendSession(request);
        const userId = session?.user?.id;
        if (!userId) {
            return error("FORBIDDEN", "Unauthorized access.", { status: 403 });
        }

        if (session.user.role === "ADMIN" || session.user.invoiceAccess) {
            return ok({ requested: false, alreadyGranted: true });
        }

        let current: { onboardingSkippedSteps: string[] } | null = null;
        try {
            current = await prisma.user.findUnique({
                where: { id: userId },
                select: { onboardingSkippedSteps: true },
            }) as any;
        } catch (schemaErr) {
            console.warn("Invoice Access Request: onboardingSkippedSteps unavailable.", schemaErr);
            return ok({ requested: false, unsupported: true });
        }
        if (!current) {
            return error("NOT_FOUND", "User not found.");
        }

        const existing = new Set(current.onboardingSkippedSteps || []);
        existing.add(REQUEST_FLAG);

        await prisma.user.update({
            where: { id: userId },
            data: { onboardingSkippedSteps: Array.from(existing) },
        });

        return ok({ requested: true });
    } catch (err) {
        console.error("Invoice Access Request POST Error:", err);
        return error("INTERNAL_ERROR", "Failed to submit access request.");
    }
}
