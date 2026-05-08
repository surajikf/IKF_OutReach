import prisma from "@/backend/lib/prisma";
import { ok, error } from "@/backend/lib/api-response";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const job = await (prisma as any).job.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        status: true,
        progress: true,
        result: true,
        error: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!job) {
      return error("NOT_FOUND", "Job not found", { status: 404 });
    }

    return ok({ job });
  } catch (err: any) {
    console.error("Job status error:", err);
    return error("INTERNAL_ERROR", "Internal Server Error");
  }
}

