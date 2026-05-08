import prisma from "@/backend/lib/prisma";
import { getBackendSession } from "@/backend/lib/auth";
import { ok, error } from "@/backend/lib/api-response";
import { z } from "zod";

function decodeContext(raw: string) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

const upsertSchema = z.object({
  subject: z.string().optional().default(""),
  bodyHtml: z.string().optional().default(""),
  metadata: z.unknown().optional(),
});

async function ensurePrismaUserFromSession(user: { id: string, email: string, role: string }) {
  // Ensure we have a matching Prisma row for this NextAuth user.
  const { id, email, role } = user;

  // Try best-effort upsert. If the email is already taken by another Prisma row,
  // we still want drafts to work, so we avoid throwing and fall back to a safe placeholder.
  try {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        role: role === "ADMIN" ? "ADMIN" : "USER",
      },
        create: {
          id: id,
          email: email || `unknown+${id}@local`,
          name: null,
          role: role === "ADMIN" ? "ADMIN" : "USER",
          status: "PENDING",
        },
      });
  } catch (err: any) {
    // P2002: Unique constraint failed (email). Keep the FK row alive by ensuring an id row exists.
    if (err?.code === "P2002") {
      await prisma.user.upsert({
        where: { id: id },
        update: {
          role: role === "ADMIN" ? "ADMIN" : "USER",
        },
        create: {
          id: id,
          email: `unknown+${id}@local`,
          name: null,
          role: role === "ADMIN" ? "ADMIN" : "USER",
          status: "PENDING",
        },
      });
      return;
    }
    throw err;
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ context: string }> }
) {
  try {
    const session = await getBackendSession(_req);
    const user = session?.user;

    if (!user || !user.id || !user.email) {
      return error("UNAUTHORIZED", "Authentication required.", { status: 401 });
    }

    await ensurePrismaUserFromSession(user as any);

    const { context } = await params;
    const decoded = decodeContext(context);

    const draft = await prisma.emailDraft.findUnique({
      where: {
        userId_context: {
          userId: user.id,
          context: decoded,
        },
      },
      select: {
        context: true,
        subject: true,
        bodyHtml: true,
        metadata: true,
        updatedAt: true,
      },
    });

    return ok({ draft });
  } catch (err) {
    console.error("Draft GET error:", err);
    return error("INTERNAL_ERROR", "Failed to fetch draft.");
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ context: string }> }
) {
  try {
    const session = await getBackendSession(req);
    const user = session?.user;

    if (!user || !user.id || !user.email) {
      return error("UNAUTHORIZED", "Authentication required.", { status: 401 });
    }

    await ensurePrismaUserFromSession(user as any);

    const json = await req.json();
    const parsed = upsertSchema.safeParse(json);
    if (!parsed.success) {
      return error("VALIDATION_ERROR", "Invalid draft payload.", {
        status: 400,
        details: parsed.error.flatten(),
      });
    }

    const { context } = await params;
    const decoded = decodeContext(context);

    const { subject, bodyHtml, metadata } = parsed.data;

    const draft = await prisma.emailDraft.upsert({
      where: {
        userId_context: {
          userId: user.id,
          context: decoded,
        },
      },
      update: {
        subject,
        bodyHtml,
        ...(metadata !== undefined ? { metadata: metadata as any } : {}),
      },
      create: {
        userId: user.id,
        context: decoded,
        subject,
        bodyHtml,
        metadata: (metadata ?? {}) as any,
      },
      select: {
        context: true,
        subject: true,
        bodyHtml: true,
        metadata: true,
        updatedAt: true,
      },
    });

    return ok({ draft });
  } catch (err) {
    console.error("Draft PUT error:", err);
    return error("INTERNAL_ERROR", "Failed to save draft.");
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ context: string }> }
) {
  try {
    const session = await getBackendSession(_req);
    const user = session?.user;

    if (!user || !user.id) {
      return error("UNAUTHORIZED", "Authentication required.", { status: 401 });
    }

    await ensurePrismaUserFromSession(user as any);

    const { context } = await params;
    const decoded = decodeContext(context);

    await prisma.emailDraft.deleteMany({
      where: { userId: user.id, context: decoded },
    });

    return ok({ deleted: true });
  } catch (err) {
    console.error("Draft DELETE error:", err);
    return error("INTERNAL_ERROR", "Failed to delete draft.");
  }
}
