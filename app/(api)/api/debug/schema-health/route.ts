import prisma from "@/lib/prisma";
import { ok, error } from "@/services/api-response";
import { isAdmin } from "@/services/auth";

export async function GET(request: Request) {
    try {
        if (!(await isAdmin(request))) {
            return error("FORBIDDEN", "Unauthorized access.", { status: 403 });
        }

        let onboardingSkippedStepsAvailable = true;
        let detail: string | null = null;

        try {
            await prisma.user.findFirst({
                select: { onboardingSkippedSteps: true },
            });
        } catch (err: any) {
            onboardingSkippedStepsAvailable = false;
            detail = err?.message || "Unknown schema error";
        }

        return ok({
            onboardingSkippedStepsAvailable,
            detail,
            checkedAt: new Date().toISOString(),
        });
    } catch (err: any) {
        console.error("Schema Health GET Error:", err);
        return error("INTERNAL_ERROR", "Failed to check schema health.");
    }
}

