import { getToken } from "next-auth/jwt";
import { type NextRequest } from "next/server";

export async function getBackendSession(req: NextRequest | Request) {
    const method = req.method;
    const url = req.url;
    console.log(`[AUTH_DEBUG] [${method}] ${url} - Checking session...`);
    const token = await getToken({
        req: req as any,
        secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
        console.warn(`[AUTH_DEBUG] [${method}] ${url} - No token found.`);
        return null;
    }

    console.log(`[AUTH_DEBUG] [${method}] ${url} - Valid token for:`, token.email, "Role:", (token as any).role);

    return {
        user: {
            id: token.sub,
            email: token.email,
            role: (token as any).role || "USER",
        },
    };
}

export async function isAdmin(req: NextRequest | Request) {
    const session = await getBackendSession(req);
    return session?.user?.role === "ADMIN";
}
