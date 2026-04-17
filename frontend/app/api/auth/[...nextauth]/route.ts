import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
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

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
