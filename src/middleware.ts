import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/auth.config";

// Use the edge-safe config here — no Prisma, no Node.js-only modules.
// Route protection is handled by the `authorized` callback in authConfig.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
