"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { createAuditLog } from "@/lib/audit";
import { AuditAction, BudgetPeriod, TransactionType, UserRole } from "@prisma/client";
import { toMinorUnits, calculateBudgetVariance } from "@/lib/calculations";
import { revalidatePath } from "next/cache";
import type { BudgetWithActual } from "@/types";

const budgetSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  budgetedAmount: z.string().min(1, "Budget amount is required"),
  period: z.nativeEnum(BudgetPeriod).default(BudgetPeriod.MONTHLY),
  periodYear: z.number().int(),
  periodMonth: z.number().int().min(1).max(12).optional(),
  periodQuarter: z.number().int().min(1).max(4).optional(),
  name: z.string().optional(),
  notes: z.string().optional(),
});

export async function createBudgetAction(data: {
  categoryId: string;
  budgetedAmount: string;
  period?: BudgetPeriod;
  periodYear: number;
  periodMonth?: number;
  periodQuarter?: number;
  name?: string;
  notes?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const user = await requireAuth();
  await requireRole(user, UserRole.OWNER, UserRole.ADMIN, UserRole.FINANCE_MANAGER);

  const parsed = budgetSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  // Verify category belongs to company
  const category = await prisma.category.findFirst({
    where: { id: parsed.data.categoryId, companyId: user.companyId },
  });
  if (!category) return { success: false, error: "Category not found." };

  const budget = await prisma.budget.create({
    data: {
      companyId: user.companyId,
      categoryId: parsed.data.categoryId,
      budgetedAmount: toMinorUnits(parsed.data.budgetedAmount),
      period: parsed.data.period,
      periodYear: parsed.data.periodYear,
      periodMonth: parsed.data.periodMonth,
      periodQuarter: parsed.data.periodQuarter,
      name: parsed.data.name,
      notes: parsed.data.notes,
    },
  });

  await createAuditLog({
    companyId: user.companyId,
    userId: user.id,
    action: AuditAction.CREATE,
    entity: "Budget",
    entityId: budget.id,
    newValues: { categoryId: budget.categoryId, amount: budget.budgetedAmount.toString() },
  });

  revalidatePath("/planning/budgets");
  return { success: true, id: budget.id };
}

export async function updateBudgetAction(
  id: string,
  data: Partial<{ budgetedAmount: string; name: string; notes: string }>
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();
  await requireRole(user, UserRole.OWNER, UserRole.ADMIN, UserRole.FINANCE_MANAGER);

  const existing = await prisma.budget.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!existing) return { success: false, error: "Budget not found." };

  const updateData: Record<string, unknown> = {};
  if (data.budgetedAmount !== undefined) updateData.budgetedAmount = toMinorUnits(data.budgetedAmount);
  if (data.name !== undefined) updateData.name = data.name;
  if (data.notes !== undefined) updateData.notes = data.notes;

  await prisma.budget.update({ where: { id }, data: updateData });

  revalidatePath("/planning/budgets");
  return { success: true };
}

export async function deleteBudgetAction(id: string): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();
  await requireRole(user, UserRole.OWNER, UserRole.ADMIN, UserRole.FINANCE_MANAGER);

  const existing = await prisma.budget.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) return { success: false, error: "Budget not found." };

  await prisma.budget.delete({ where: { id } });
  revalidatePath("/planning/budgets");
  return { success: true };
}

export async function getBudgetsWithActualAction(
  year: number,
  month?: number
): Promise<BudgetWithActual[]> {
  const user = await requireAuth();

  const budgets = await prisma.budget.findMany({
    where: {
      companyId: user.companyId,
      periodYear: year,
      ...(month !== undefined ? { periodMonth: month } : {}),
    },
    include: { category: true },
  });

  const results: BudgetWithActual[] = [];

  for (const budget of budgets) {
    // Calculate actual spending for this category/period
    let dateFrom: Date, dateTo: Date;
    if (budget.period === BudgetPeriod.MONTHLY && budget.periodMonth) {
      dateFrom = new Date(year, budget.periodMonth - 1, 1);
      dateTo = new Date(year, budget.periodMonth, 0, 23, 59, 59);
    } else {
      dateFrom = new Date(year, 0, 1);
      dateTo = new Date(year, 11, 31, 23, 59, 59);
    }

    const actual = await prisma.transaction.aggregate({
      where: {
        companyId: user.companyId,
        categoryId: budget.categoryId,
        type: TransactionType.OUTFLOW,
        date: { gte: dateFrom, lte: dateTo },
      },
      _sum: { amount: true },
    });

    const actualAmount = actual._sum.amount ?? 0n;
    const { variance, variancePct } = calculateBudgetVariance(budget.budgetedAmount, actualAmount);

    results.push({
      id: budget.id,
      categoryId: budget.categoryId,
      categoryName: budget.category.name,
      categoryColor: budget.category.color,
      period: budget.period,
      periodYear: budget.periodYear,
      periodMonth: budget.periodMonth,
      budgetedAmount: budget.budgetedAmount,
      actualAmount,
      variance,
      variancePct,
    });
  }

  return results;
}
