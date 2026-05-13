import prisma from "@/lib/prisma";
import { isPrimaryAdminEmail } from "@/services/auth-primary";
import crypto from "crypto";

const SELECT_CLAIMS = {
  id: true,
  email: true,
  role: true,
  status: true,
  canAccessInvoiceData: true,
} as const;

/**
 * Called only during signIn — creates the user if they don't exist yet.
 * Never called during JWT refresh so deleted users can't self-resurrect.
 */
export async function resolveUserClaims(email: string, name: string | null = null) {
  const normalizedEmail = email.trim().toLowerCase();
  const superAdmin = isPrimaryAdminEmail(normalizedEmail);

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      ...(name ? { name } : {}),
      ...(superAdmin ? { role: "ADMIN", status: "APPROVED", canAccessInvoiceData: true } : {}),
    },
    create: {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      name,
      role: superAdmin ? "ADMIN" : "USER",
      status: superAdmin ? "APPROVED" : "PENDING",
      canAccessInvoiceData: superAdmin,
    },
    select: SELECT_CLAIMS,
  });

  return user;
}

/**
 * Called during JWT refresh — read-only, never creates.
 * Returns null if user was deleted, which triggers force sign-out.
 */
export async function lookupUserClaims(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: SELECT_CLAIMS,
  });

  return user ?? null;
}
