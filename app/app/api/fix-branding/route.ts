import prisma from "@/backend/lib/prisma";
import { ok, error } from "@/backend/lib/api-response";

export async function GET() {
    try {
        const db = prisma as any;
        const result = await db.globalSettings.upsert({
            where: { id: "singleton" },
            update: { projectName: "IKF Outreach" },
            create: {
                id: "singleton",
                projectName: "IKF Outreach",
                aiProvider: "Groq",
                aiModel: "llama-3.3-70b-versatile"
            },
        });
        return ok({ message: "Branding updated in database", data: result });
    } catch (err: any) {
        console.error("Failed to update branding:", err);
        return error("INTERNAL_ERROR", err.message);
    }
}
