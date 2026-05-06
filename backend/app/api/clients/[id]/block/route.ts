import { ok, error } from "@/backend/lib/api-response";
import prisma from "@/backend/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // Await params for Next.js 15 compatibility
) {
  try {
    const { id } = await params;
    console.log("TRACE: Path ID:", id);
    const body = await request.json();
    const { isBlocked } = body;

    const updatedClient = await prisma.client.update({
      where: { id },
      data: { isBlocked },
    });

    return ok(updatedClient);
  } catch (err: any) {
    console.error("BLOCK UPDATE ERROR:", err);
    return error("INTERNAL_ERROR", `Block Update Failed: ${err.message || 'Unknown Error'}`, {
      details: {
        name: err.name,
        stack: err.stack,
        prismaCode: err.code,
        prismaMeta: err.meta
      }
    });
  }
}
