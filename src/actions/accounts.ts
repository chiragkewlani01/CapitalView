"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { createAuditLog } from "@/lib/audit";
import { AuditAction, AccountType, UserRole } from "@prisma/client";
import { toMinorUnits } from "@/lib/calculations";
import { revalidatePath } from "next/cache";

const accountSchema = z.object({
  name: z.string().min(1, "Account name is required"),
  type: z.nativeEnum(AccountType),
  bankName: z.string().optional(),
  accountNumber: z.string().max(4).optional(),
  balance: z.string().default("0"),
  description: z.string().optional(),
});

export async function createAccountAction(data: {
  name: string;
  type: AccountType;
  bankName?: string;
  accountNumber?: string;
  balance?: string;
  description?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const user = await requireAuth();
  await requireRole(user, UserRole.OWNER, UserRole.ADMIN, UserRole.FINANCE_MANAGER);

  const parsed = accountSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const account = await prisma.financialAccount.create({
    data: {
      companyId: user.companyId,
      name: parsed.data.name,
      type: parsed.data.type,
      bankName: parsed.data.bankName,
      accountNumber: parsed.data.accountNumber,
      balance: toMinorUnits(parsed.data.balance || "0"),
      description: parsed.data.description,
    },
  });

  await createAuditLog({
    companyId: user.companyId,
    userId: user.id,
    action: AuditAction.CREATE,
    entity: "FinancialAccount",
    entityId: account.id,
    newValues: { name: account.name, type: account.type },
  });

  revalidatePath("/settings");
  return { success: true, id: account.id };
}

export async function updateAccountAction(
  id: string,
  data: Partial<{
    name: string;
    type: AccountType;
    bankName: string;
    balance: string;
    description: string;
    isActive: boolean;
  }>
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();
  await requireRole(user, UserRole.OWNER, UserRole.ADMIN, UserRole.FINANCE_MANAGER);

  // Verify account belongs to this company
  const existing = await prisma.financialAccount.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!existing) return { success: false, error: "Account not found." };

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.bankName !== undefined) updateData.bankName = data.bankName;
  if (data.balance !== undefined) updateData.balance = toMinorUnits(data.balance);
  if (data.description !== undefined) updateData.description = data.description;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  await prisma.financialAccount.update({
    where: { id },
    data: updateData,
  });

  await createAuditLog({
    companyId: user.companyId,
    userId: user.id,
    action: AuditAction.UPDATE,
    entity: "FinancialAccount",
    entityId: id,
    oldValues: { name: existing.name, isActive: existing.isActive },
    newValues: updateData,
  });

  revalidatePath("/settings");
  return { success: true };
}

export async function deleteAccountAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();
  await requireRole(user, UserRole.OWNER, UserRole.ADMIN);

  const existing = await prisma.financialAccount.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!existing) return { success: false, error: "Account not found." };

  const txCount = await prisma.transaction.count({ where: { accountId: id } });
  if (txCount > 0) {
    // Deactivate instead of delete to preserve transaction history
    await prisma.financialAccount.update({ where: { id }, data: { isActive: false } });
  } else {
    await prisma.financialAccount.delete({ where: { id } });
  }

  revalidatePath("/settings");
  return { success: true };
}
