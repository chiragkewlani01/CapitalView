import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config — no Prisma, no Node.js-only modules.
 * Used by middleware to protect routes without touching the DB.
 * The JWT callback here only reads what's already in the token;
 * company data is populated by the full config in index.ts.
 */
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnAuth =
        nextUrl.pathname.startsWith("/login") ||
        nextUrl.pathname.startsWith("/signup");
      const isOnboarding = nextUrl.pathname.startsWith("/onboarding");
      const isApi = nextUrl.pathname.startsWith("/api");

      if (isApi) return true;
      if (isOnAuth) return true;
      if (isOnboarding) return isLoggedIn;
      if (!isLoggedIn) return false;

      return true;
    },
  },
  providers: [], // providers are only needed on the Node.js side
};
