import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

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
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      // On update trigger, refresh session data
      if (trigger === "update" && session) {
        return { ...token, ...session };
      }
      // Attach company data to token
      if (token.id) {
        const membership = await prisma.companyMember.findFirst({
          where: { userId: token.id as string, isActive: true },
          include: { company: true },
          orderBy: { joinedAt: "asc" },
        });
        if (membership) {
          token.companyId = membership.companyId;
          token.companyName = membership.company.name;
          token.companyCurrency = membership.company.currency;
          token.companyCurrencySymbol = membership.company.currencySymbol;
          token.role = membership.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as Record<string, unknown>).companyId = token.companyId;
        (session.user as Record<string, unknown>).companyName = token.companyName;
        (session.user as Record<string, unknown>).companyCurrency = token.companyCurrency;
        (session.user as Record<string, unknown>).companyCurrencySymbol = token.companyCurrencySymbol;
        (session.user as Record<string, unknown>).role = token.role;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnAuth = nextUrl.pathname.startsWith("/login") || nextUrl.pathname.startsWith("/signup");
      const isOnboarding = nextUrl.pathname.startsWith("/onboarding");
      const isApi = nextUrl.pathname.startsWith("/api");

      if (isApi) return true;
      if (isOnAuth) return true;
      if (isOnboarding) return isLoggedIn;
      if (!isLoggedIn) return false;

      return true;
    },
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });

        if (!user || !user.passwordHash) return null;

        const isValid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
};
