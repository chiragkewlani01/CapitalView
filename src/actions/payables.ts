"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { createAuditLog } from "@/lib/audit";
import { AuditAction, PayableStatus, UserRole } from "@prisma/client";
import { toMinorUnits } from "@/lib/calculations";
import { revalidatePath } from "next/cache";

const payableSchema = z.object({
  vendorName: z.string().min(1, "Vendor name is required"),
  vendorEmail: z.string().email().optional().or(z.literal("")),
  billNumber: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  amount: z.string().min(1, "Amount is required"),
  issueDate: z.string().min(1, "Issue date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  notes: z.string().optional(),
  categoryId: z.string().optional(),
});

export async function createPayableAction(data: {
  vendorName: string;
  vendorEmail?: string;
  billNumber?: string;
  description: string;
  amount: string;
  issueDate: string;
  dueDate: string;
  notes?: string;
  categoryId?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const user = await requireAuth();
  await requireRole(user, UserRole.OWNER, UserRole.ADMIN, UserRole.FINANCE_MANAGER);

  const parsed = payableSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const amount = toMinorUnits(parsed.data.amount);
  const dueDate = new Date(parsed.data.dueDate);
  const now = new Date();

  const status = dueDate < now ? PayableStatus.OVERDUE : PayableStatus.APPROVED;

  const payable = await prisma.payable.create({
    data: {
      companyId: user.companyId,
      vendorName: parsed.data.vendorName,
      vendorEmail: parsed.data.vendorEmail || null,
      billNumber: parsed.data.billNumber || null,
      description: parsed.data.description,
      amount,
      currency: user.companyCurrency,
      status,
      issueDate: new Date(parsed.data.issueDate),
      dueDate,
      notes: parsed.data.notes || null,
      categoryId: parsed.data.categoryId || null,
    },
  });

  await createAuditLog({
    companyId: user.companyId,
    userId: user.id,
    action: AuditAction.CREATE,
    entity: "Payable",
    entityId: payable.id,
    newValues: { vendorName: payable.vendorName, amount: payable.amount.toString() },
  });

  revalidatePath("/financials/payables");
  return { success: true, id: payable.id };
}

export async function updatePayableAction(
  id: string,
  data: Partial<{
    vendorName: string;
    vendorEmail: string;
    billNumber: string;
    description: string;
    amount: string;
    issueDate: string;
    dueDate: string;
    notes: string;
    categoryId: string;
    status: PayableStatus;
  }>
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();
  await requireRole(user, UserRole.OWNER, UserRole.ADMIN, UserRole.FINANCE_MANAGER);

  const existing = await prisma.payable.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!existing) return { success: false, error: "Payable not found." };

  const updateData: Record<string, unknown> = {};
  if (data.vendorName !== undefined) updateData.vendorName = data.vendorName;
  if (data.vendorEmail !== undefined) updateData.vendorEmail = data.vendorEmail || null;
  if (data.billNumber !== undefined) updateData.billNumber = data.billNumber || null;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.amount !== undefined) updateData.amount = toMinorUnits(data.amount);
  if (data.issueDate !== undefined) updateData.issueDate = new Date(data.issueDate);
  if (data.dueDate !== undefined) updateData.dueDate = new Date(data.dueDate);
  if (data.notes !== undefined) updateData.notes = data.notes || null;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId || null;
  if (data.status !== undefined) updateData.status = data.status;

  await prisma.payable.update({ where: { id }, data: updateData });
  revalidatePath("/financials/payables");
  return { success: true };
}

export async function markPayablePaidAction(
  id: string,
  amountPaid?: string
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();
  await requireRole(user, UserRole.OWNER, UserRole.ADMIN, UserRole.FINANCE_MANAGER);

  const existing = await prisma.payable.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!existing) return { success: false, error: "Payable not found." };

  const paidAmount = amountPaid ? toMinorUnits(amountPaid) : existing.amount;
  const isPartial = paidAmount < existing.amount;

  await prisma.payable.update({
    where: { id },
    data: {
      amountPaid: paidAmount,
      status: isPartial ? PayableStatus.PARTIALLY_PAID : PayableStatus.PAID,
      paidDate: new Date(),
    },
  });

  revalidatePath("/financials/payables");
  return { success: true };
}

export async function deletePayableAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();
  await requireRole(user, UserRole.OWNER, UserRole.ADMIN, UserRole.FINANCE_MANAGER);

  const existing = await prisma.payable.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!existing) return { success: false, error: "Payable not found." };

  await prisma.payable.delete({ where: { id } });
  revalidatePath("/financials/payables");
  return { success: true };
}

export async function getPayablesSummaryAction() {
  const user = await requireAuth();
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const payables = await prisma.payable.findMany({
    where: { companyId: user.companyId, status: { notIn: [PayableStatus.CANCELLED] } },
  });

  const outstanding = payables.filter((p) => p.status !== PayableStatus.PAID);
  const overdue = outstanding.filter((p) => p.dueDate < now);
  const dueThisWeek = outstanding.filter((p) => p.dueDate >= now && p.dueDate <= weekEnd);
  const dueThisMonth = outstanding.filter((p) => p.dueDate <= monthEnd);

  return {
    total: outstanding.reduce((s, p) => s + p.amount - p.amountPaid, 0n),
    overdue: overdue.reduce((s, p) => s + p.amount - p.amountPaid, 0n),
    dueThisWeek: dueThisWeek.reduce((s, p) => s + p.amount - p.amountPaid, 0n),
    dueThisMonth: dueThisMonth.reduce((s, p) => s + p.amount - p.amountPaid, 0n),
    count: outstanding.length,
    overdueCount: overdue.length,
  };
}
