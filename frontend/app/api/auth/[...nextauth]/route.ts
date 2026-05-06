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

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: googleClientId || "",
      clientSecret: googleClientSecret || "",
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
  debug: process.env.NODE_ENV === "development",
  callbacks: {
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

      // 2) Assign role based on email (as per previous session preference)
      token.role = token.email === "suraj.sonnar@ikf.co.in" ? "ADMIN" : "USER";
      
      return token;
    },
    async session({ session, token }) {
      (session.user as any).email = token.email;
      (session.user as any).role = token.role;
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
  if (missingEnvVars.length > 0) return missingEnvResponse();
  return authHandler(req as any, ctx);
}

export async function POST(req: Request, ctx: any) {
  if (missingEnvVars.length > 0) return missingEnvResponse();
  return authHandler(req as any, ctx);
}
