import NextAuth from "next-auth";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const requiredEnvVars = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "NEXTAUTH_SECRET",
] as const;

const missingEnvVars = requiredEnvVars.filter((key) => {
  const value = process.env[key];
  return !value || value.trim().length === 0 || value.includes("replace-with-");
});

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const nextAuthSecret = process.env.NEXTAUTH_SECRET;
const appInternalUrl = process.env.NEXTAUTH_URL?.trim().replace(/\/+$/, "");

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: googleClientId!,
      clientSecret: googleClientSecret!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://mail.google.com/",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  secret: nextAuthSecret,
  debug: process.env.NEXTAUTH_DEBUG === "true",
  callbacks: {
    async signIn({ user }) {
      const email = (user.email || "").trim().toLowerCase();
      if (!email) return false;
      const res = await fetch(`${appInternalUrl}/api/auth/claims`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: user.name || null }),
      });
      const payload = await res.json();
      const status = payload?.data?.user?.status;
      // Keep sign-in successful for known statuses so JWT/session can be created.
      // Route gating for PENDING/BANNED is handled in middleware and app pages.
      if (status === "PENDING" || status === "BANNED" || status === "APPROVED") {
        return true;
      }
      return false;
    },
    async jwt({ token, account, profile }) {
      // 1) Handle initial login: capture tokens and email
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token; // Only available on first login or prompt: consent
        token.scope = account.scope;
      }
      if (profile?.email) {
        token.email = profile.email;
      }

      const email = (token.email || "").trim().toLowerCase();
      if (email) {
        try {
          const res = await fetch(`${appInternalUrl}/api/auth/claims`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, name: (profile as any)?.name || null }),
          });
          const payload = await res.json();
          const user = payload?.data?.user;
          if (user) {
            token.sub = user.id;
            (token as any).role = user.role;
            (token as any).status = user.status;
            (token as any).invoiceAccess = Boolean(user.canAccessInvoiceData);
          } else {
            throw new Error("Claims API returned no user.");
          }
        } catch (err) {
          throw new Error(`JWT claims sync failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      (session.user as any).email = token.email;
      (session.user as any).role = token.role;
      (session.user as any).status = (token as any).status || "PENDING";
      (session.user as any).invoiceAccess = Boolean((token as any).invoiceAccess);
      (session.user as any).accessToken = token.accessToken;
      (session.user as any).refreshToken = token.refreshToken;
      (session.user as any).scope = token.scope;
      return session;
    },
  },
};

const authHandler = NextAuth(authOptions);

function missingEnvResponse() {
  return Response.json(
    {
      success: false,
      error: {
        code: "AUTH_CONFIG_MISSING",
        message: `Missing required auth env vars: ${missingEnvVars.join(", ")}.`,
      },
    },
    { status: 500 }
  );
}

export async function GET(req: Request, ctx: any) {
  if (!appInternalUrl) {
    return Response.json(
      { success: false, error: { code: "AUTH_CONFIG_MISSING", message: "Missing NEXTAUTH_URL." } },
      { status: 500 }
    );
  }
  if (missingEnvVars.length > 0) return missingEnvResponse();
  return authHandler(req as any, ctx);
}

export async function POST(req: Request, ctx: any) {
  if (!appInternalUrl) {
    return Response.json(
      { success: false, error: { code: "AUTH_CONFIG_MISSING", message: "Missing NEXTAUTH_URL." } },
      { status: 500 }
    );
  }
  if (missingEnvVars.length > 0) return missingEnvResponse();
  return authHandler(req as any, ctx);
}
