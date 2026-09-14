"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { createAuditLog } from "@/lib/audit";
import { AuditAction, ReceivableStatus, UserRole } from "@prisma/client";
import { toMinorUnits } from "@/lib/calculations";
import { revalidatePath } from "next/cache";

const receivableSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email().optional().or(z.literal("")),
  invoiceNumber: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  amount: z.string().min(1, "Amount is required"),
  issueDate: z.string().min(1, "Issue date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  notes: z.string().optional(),
  categoryId: z.string().optional(),
});

export async function createReceivableAction(data: {
  customerName: string;
  customerEmail?: string;
  invoiceNumber?: string;
  description: string;
  amount: string;
  issueDate: string;
  dueDate: string;
  notes?: string;
  categoryId?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const user = await requireAuth();
  await requireRole(user, UserRole.OWNER, UserRole.ADMIN, UserRole.FINANCE_MANAGER);

  const parsed = receivableSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const amount = toMinorUnits(parsed.data.amount);
  const issueDate = new Date(parsed.data.issueDate);
  const dueDate = new Date(parsed.data.dueDate);
  const now = new Date();

  let status = ReceivableStatus.DRAFT;
  if (dueDate < now) status = ReceivableStatus.OVERDUE;
  else status = ReceivableStatus.SENT;

  const receivable = await prisma.receivable.create({
    data: {
      companyId: user.companyId,
      customerName: parsed.data.customerName,
      customerEmail: parsed.data.customerEmail || null,
      invoiceNumber: parsed.data.invoiceNumber || null,
      description: parsed.data.description,
      amount,
      currency: user.companyCurrency,
      status,
      issueDate,
      dueDate,
      notes: parsed.data.notes || null,
      categoryId: parsed.data.categoryId || null,
    },
  });

  await createAuditLog({
    companyId: user.companyId,
    userId: user.id,
    action: AuditAction.CREATE,
    entity: "Receivable",
    entityId: receivable.id,
    newValues: { customerName: receivable.customerName, amount: receivable.amount.toString() },
  });

  revalidatePath("/financials/receivables");
  return { success: true, id: receivable.id };
}

export async function updateReceivableAction(
  id: string,
  data: Partial<{
    customerName: string;
    customerEmail: string;
    invoiceNumber: string;
    description: string;
    amount: string;
    issueDate: string;
    dueDate: string;
    notes: string;
    categoryId: string;
    status: ReceivableStatus;
  }>
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();
  await requireRole(user, UserRole.OWNER, UserRole.ADMIN, UserRole.FINANCE_MANAGER);

  const existing = await prisma.receivable.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!existing) return { success: false, error: "Receivable not found." };

  const updateData: Record<string, unknown> = {};
  if (data.customerName !== undefined) updateData.customerName = data.customerName;
  if (data.customerEmail !== undefined) updateData.customerEmail = data.customerEmail || null;
  if (data.invoiceNumber !== undefined) updateData.invoiceNumber = data.invoiceNumber || null;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.amount !== undefined) updateData.amount = toMinorUnits(data.amount);
  if (data.issueDate !== undefined) updateData.issueDate = new Date(data.issueDate);
  if (data.dueDate !== undefined) updateData.dueDate = new Date(data.dueDate);
  if (data.notes !== undefined) updateData.notes = data.notes || null;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId || null;
  if (data.status !== undefined) updateData.status = data.status;

  await prisma.receivable.update({ where: { id }, data: updateData });

  await createAuditLog({
    companyId: user.companyId,
    userId: user.id,
    action: AuditAction.UPDATE,
    entity: "Receivable",
    entityId: id,
    newValues: updateData,
  });

  revalidatePath("/financials/receivables");
  return { success: true };
}

export async function markReceivablePaidAction(
  id: string,
  amountPaid?: string
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();
  await requireRole(user, UserRole.OWNER, UserRole.ADMIN, UserRole.FINANCE_MANAGER);

  const existing = await prisma.receivable.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!existing) return { success: false, error: "Receivable not found." };

  const paidAmount = amountPaid ? toMinorUnits(amountPaid) : existing.amount;
  const isPartial = paidAmount < existing.amount;

  await prisma.receivable.update({
    where: { id },
    data: {
      amountPaid: paidAmount,
      status: isPartial ? ReceivableStatus.PARTIALLY_PAID : ReceivableStatus.PAID,
      paidDate: new Date(),
    },
  });

  revalidatePath("/financials/receivables");
  return { success: true };
}

export async function deleteReceivableAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();
  await requireRole(user, UserRole.OWNER, UserRole.ADMIN, UserRole.FINANCE_MANAGER);

  const existing = await prisma.receivable.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!existing) return { success: false, error: "Receivable not found." };

  await prisma.receivable.delete({ where: { id } });
  revalidatePath("/financials/receivables");
  return { success: true };
}

export async function getReceivablesSummaryAction() {
  const user = await requireAuth();
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const receivables = await prisma.receivable.findMany({
    where: { companyId: user.companyId, status: { notIn: [ReceivableStatus.CANCELLED] } },
  });

  const outstanding = receivables.filter((r) => r.status !== ReceivableStatus.PAID);
  const overdue = outstanding.filter((r) => r.dueDate < now);
  const dueThisWeek = outstanding.filter((r) => r.dueDate >= now && r.dueDate <= weekEnd);
  const dueThisMonth = outstanding.filter((r) => r.dueDate <= monthEnd);

  return {
    total: outstanding.reduce((s, r) => s + r.amount - r.amountPaid, 0n),
    overdue: overdue.reduce((s, r) => s + r.amount - r.amountPaid, 0n),
    dueThisWeek: dueThisWeek.reduce((s, r) => s + r.amount - r.amountPaid, 0n),
    dueThisMonth: dueThisMonth.reduce((s, r) => s + r.amount - r.amountPaid, 0n),
    count: outstanding.length,
    overdueCount: overdue.length,
  };
}
