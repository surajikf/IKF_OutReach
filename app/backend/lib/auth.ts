import { getToken } from "next-auth/jwt";
import { type NextRequest } from "next/server";

const AUTH_DEBUG = process.env.AUTH_DEBUG === "true";

export async function getBackendSession(req: NextRequest | Request) {
    const method = req.method;
    const url = req.url;
    if (AUTH_DEBUG) {
        console.log(`[AUTH_DEBUG] [${method}] ${url} - Checking session...`);
    }
    const token = await getToken({
        req: req as any,
        secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
        if (AUTH_DEBUG) {
            console.warn(`[AUTH_DEBUG] [${method}] ${url} - No token found.`);
        }
        return null;
    }

    if (AUTH_DEBUG) {
        console.log(`[AUTH_DEBUG] [${method}] ${url} - Valid token for:`, token.email, "Role:", (token as any).role);
    }

    return {
        user: {
            id: token.sub,
            email: token.email,
            role: (token as any).role || "USER",
            status: (token as any).status || "PENDING",
            invoiceAccess: Boolean((token as any).invoiceAccess),
        },
    };
}

export async function isAdmin(req: NextRequest | Request) {
    const session = await getBackendSession(req);
    return session?.user?.role === "ADMIN";
}

export async function isApprovedUser(req: NextRequest | Request) {
    const session = await getBackendSession(req);
    return session?.user?.status === "APPROVED";
}

export async function hasInvoiceAccess(req: NextRequest | Request) {
    const session = await getBackendSession(req);
    if (!session?.user) return false;
    return session.user.role === "ADMIN" || Boolean(session.user.invoiceAccess);
}
