"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { createAuditLog } from "@/lib/audit";
import { AuditAction, TransactionType, TransactionStatus, UserRole } from "@prisma/client";
import { toMinorUnits } from "@/lib/calculations";
import { revalidatePath } from "next/cache";
import type { PaginatedResult } from "@/types";

const transactionSchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  categoryId: z.string().optional(),
  type: z.nativeEnum(TransactionType),
  status: z.nativeEnum(TransactionStatus).default(TransactionStatus.CLEARED),
  amount: z.string().min(1, "Amount is required"),
  description: z.string().min(1, "Description is required"),
  reference: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
});

export async function createTransactionAction(data: {
  accountId: string;
  categoryId?: string;
  type: TransactionType;
  status?: TransactionStatus;
  amount: string;
  description: string;
  reference?: string;
  date: string;
  notes?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const user = await requireAuth();
  await requireRole(user, UserRole.OWNER, UserRole.ADMIN, UserRole.FINANCE_MANAGER);

  const parsed = transactionSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  // Verify account belongs to this company
  const account = await prisma.financialAccount.findFirst({
    where: { id: parsed.data.accountId, companyId: user.companyId },
  });
  if (!account) return { success: false, error: "Account not found." };

  // Verify category if provided
  if (parsed.data.categoryId) {
    const cat = await prisma.category.findFirst({
      where: { id: parsed.data.categoryId, companyId: user.companyId },
    });
    if (!cat) return { success: false, error: "Category not found." };
  }

  const amount = toMinorUnits(parsed.data.amount);
  const date = new Date(parsed.data.date);

  const tx = await prisma.$transaction(async (db) => {
    const transaction = await db.transaction.create({
      data: {
        companyId: user.companyId,
        accountId: parsed.data.accountId,
        categoryId: parsed.data.categoryId || null,
        type: parsed.data.type,
        status: parsed.data.status,
        amount,
        description: parsed.data.description,
        reference: parsed.data.reference || null,
        date,
        notes: parsed.data.notes || null,
        createdById: user.id,
      },
    });

    // Update account balance
    const balanceDelta = parsed.data.type === TransactionType.INFLOW ? amount : -amount;
    await db.financialAccount.update({
      where: { id: parsed.data.accountId },
      data: { balance: { increment: balanceDelta } },
    });

    return transaction;
  });

  await createAuditLog({
    companyId: user.companyId,
    userId: user.id,
    action: AuditAction.CREATE,
    entity: "Transaction",
    entityId: tx.id,
    newValues: { type: tx.type, amount: tx.amount.toString(), description: tx.description },
  });

  revalidatePath("/financials/transactions");
  revalidatePath("/overview");
  return { success: true, id: tx.id };
}

export async function updateTransactionAction(
  id: string,
  data: Partial<{
    accountId: string;
    categoryId: string;
    type: TransactionType;
    status: TransactionStatus;
    amount: string;
    description: string;
    reference: string;
    date: string;
    notes: string;
  }>
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();
  await requireRole(user, UserRole.OWNER, UserRole.ADMIN, UserRole.FINANCE_MANAGER);

  const existing = await prisma.transaction.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!existing) return { success: false, error: "Transaction not found." };

  const updateData: Record<string, unknown> = {};
  let newAmount: bigint | undefined;
  let newType: TransactionType | undefined;

  if (data.description !== undefined) updateData.description = data.description;
  if (data.reference !== undefined) updateData.reference = data.reference;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId || null;
  if (data.date !== undefined) updateData.date = new Date(data.date);
  if (data.amount !== undefined) {
    newAmount = toMinorUnits(data.amount);
    updateData.amount = newAmount;
  }
  if (data.type !== undefined) {
    newType = data.type;
    updateData.type = data.type;
  }

  await prisma.$transaction(async (db) => {
    // Reverse old balance effect
    const oldDelta = existing.type === TransactionType.INFLOW ? -existing.amount : existing.amount;
    await db.financialAccount.update({
      where: { id: existing.accountId },
      data: { balance: { increment: oldDelta } },
    });

    await db.transaction.update({ where: { id }, data: updateData });

    // Apply new balance effect
    const resolvedAmount = newAmount ?? existing.amount;
    const resolvedType = newType ?? existing.type;
    const newDelta = resolvedType === TransactionType.INFLOW ? resolvedAmount : -resolvedAmount;
    await db.financialAccount.update({
      where: { id: existing.accountId },
      data: { balance: { increment: newDelta } },
    });
  });

  await createAuditLog({
    companyId: user.companyId,
    userId: user.id,
    action: AuditAction.UPDATE,
    entity: "Transaction",
    entityId: id,
    oldValues: { amount: existing.amount.toString(), type: existing.type },
    newValues: updateData as Record<string, unknown>,
  });

  revalidatePath("/financials/transactions");
  revalidatePath("/overview");
  return { success: true };
}

export async function deleteTransactionAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();
  await requireRole(user, UserRole.OWNER, UserRole.ADMIN, UserRole.FINANCE_MANAGER);

  const existing = await prisma.transaction.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!existing) return { success: false, error: "Transaction not found." };

  await prisma.$transaction(async (db) => {
    // Reverse the balance effect
    const delta = existing.type === TransactionType.INFLOW ? -existing.amount : existing.amount;
    await db.financialAccount.update({
      where: { id: existing.accountId },
      data: { balance: { increment: delta } },
    });
    await db.transaction.delete({ where: { id } });
  });

  await createAuditLog({
    companyId: user.companyId,
    userId: user.id,
    action: AuditAction.DELETE,
    entity: "Transaction",
    entityId: id,
    oldValues: { amount: existing.amount.toString(), type: existing.type, description: existing.description },
  });

  revalidatePath("/financials/transactions");
  revalidatePath("/overview");
  return { success: true };
}

export interface TransactionFilters {
  search?: string;
  type?: TransactionType;
  categoryId?: string;
  accountId?: string;
  status?: TransactionStatus;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export async function getTransactionsAction(
  filters: TransactionFilters = {}
): Promise<PaginatedResult<Record<string, unknown>>> {
  const user = await requireAuth();

  const {
    search,
    type,
    categoryId,
    accountId,
    status,
    dateFrom,
    dateTo,
    page = 1,
    pageSize = 25,
    sortBy = "date",
    sortDir = "desc",
  } = filters;

  const where: Record<string, unknown> = { companyId: user.companyId };

  if (search) {
    where.OR = [
      { description: { contains: search, mode: "insensitive" } },
      { reference: { contains: search, mode: "insensitive" } },
    ];
  }
  if (type) where.type = type;
  if (categoryId) where.categoryId = categoryId;
  if (accountId) where.accountId = accountId;
  if (status) where.status = status;
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) (where.date as Record<string, unknown>).gte = new Date(dateFrom);
    if (dateTo) (where.date as Record<string, unknown>).lte = new Date(dateTo);
  }

  const [data, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, color: true } },
        account: { select: { id: true, name: true, type: true } },
      },
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    data: data as unknown as Record<string, unknown>[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
