import NextAuth from "next-auth";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { resolveUserClaims, lookupUserClaims } from "@/services/auth-claims";

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
          scope: "openid email profile",
          access_type: "offline",
          // No prompt: "consent" — Google remembers previous approval.
          // Gmail scopes are requested separately via /api/auth/google
          // when the user explicitly connects a Gmail account in Settings.
          prompt: "select_account",
        },
      },
    }),
  ],
  secret: nextAuthSecret,
  debug: process.env.NODE_ENV === "development",
  callbacks: {
    async signIn({ user }) {
      const email = (user.email || "").trim().toLowerCase();
      if (!email) return false;
      
      try {
        const dbUser = await resolveUserClaims(email, user.name || null);
        const status = dbUser?.status;
        if (status === "PENDING" || status === "BANNED" || status === "APPROVED") {
          return true;
        }
      } catch (error) {
        console.error("SignIn claims error:", error);
      }
      return false;
    },
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.scope = account.scope;
      }
      if (profile?.email) {
        token.email = profile.email;
      }

      const email = (token.email || "").trim().toLowerCase();
      if (email) {
        try {
          // Use read-only lookup during JWT refresh — prevents deleted users from self-resurrecting.
          // resolveUserClaims (upsert) is only called during signIn above.
          const user = await lookupUserClaims(email);
          if (user) {
            token.sub = user.id;
            (token as any).role = user.role;
            (token as any).status = user.status;
            (token as any).invoiceAccess = Boolean(user.canAccessInvoiceData);
          } else {
            // User not found in DB (deleted by admin) — force sign-out
            (token as any).role = "USER";
            (token as any).status = "DELETED";
            (token as any).invoiceAccess = false;
          }
        } catch (error) {
          console.error("JWT claims error:", error);
          (token as any).role = "USER";
          (token as any).status = "PENDING";
          (token as any).invoiceAccess = false;
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      (session.user as any).id = token.sub;           // DB user id — required for scoping
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

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
