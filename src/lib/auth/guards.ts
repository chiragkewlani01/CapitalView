import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import type { SessionUser } from "@/types";

export async function requireAuth(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = session.user as unknown as SessionUser;
  if (!user.companyId) {
    redirect("/onboarding");
  }

  return user;
}

export async function requireAuthNoCompany(): Promise<SessionUser & { id: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session.user as unknown as SessionUser & { id: string };
}

export async function requireRole(
  user: SessionUser,
  ...roles: UserRole[]
): Promise<void> {
  if (!roles.includes(user.role)) {
    throw new Error("Insufficient permissions");
  }
}

export async function requireCompanyAccess(
  user: SessionUser,
  companyId: string
): Promise<void> {
  if (user.companyId !== companyId) {
    throw new Error("Access denied");
  }
}

const ROLE_HIERARCHY: Record<UserRole, number> = {
  OWNER: 5,
  ADMIN: 4,
  FINANCE_MANAGER: 3,
  ANALYST: 2,
  VIEWER: 1,
};

export function hasMinRole(userRole: UserRole, minRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

export function canWrite(role: UserRole): boolean {
  return hasMinRole(role, UserRole.FINANCE_MANAGER);
}

export function canAdmin(role: UserRole): boolean {
  return hasMinRole(role, UserRole.ADMIN);
}

export function canManage(role: UserRole): boolean {
  return hasMinRole(role, UserRole.OWNER);
}
