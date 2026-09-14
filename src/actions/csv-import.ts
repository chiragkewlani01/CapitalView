"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { createAuditLog } from "@/lib/audit";
import { AuditAction, TransactionType, TransactionStatus, UserRole } from "@prisma/client";
import { parseCsv } from "@/lib/csv";
import type { CsvParseResult, ParsedTransaction } from "@/lib/csv";
import { revalidatePath } from "next/cache";

export interface CsvImportPreview {
  parseResult: {
    totalRows: number;
    validCount: number;
    errorCount: number;
    errors: Array<{ row: number; column: string; value: string; message: string }>;
    preview: Array<{
      rowIndex: number;
      date: string;
      description: string;
      amount: string;
      type: string;
      reference?: string;
      categoryName?: string;
    }>;
  };
  batchId: string;
}

// In-memory batch store (in production, use Redis or DB)
const importBatches = new Map<string, ParsedTransaction[]>();

export async function parseCsvForPreviewAction(
  csvText: string
): Promise<{ success: boolean; data?: CsvImportPreview; error?: string }> {
  const user = await requireAuth();
  await requireRole(user, UserRole.OWNER, UserRole.ADMIN, UserRole.FINANCE_MANAGER);

  if (!csvText || csvText.trim().length === 0) {
    return { success: false, error: "CSV content is empty." };
  }

  const result: CsvParseResult = parseCsv(csvText);

  const batchId = `${user.companyId}-${Date.now()}`;
  importBatches.set(batchId, result.valid);

  // Auto-clean old batches
  setTimeout(() => importBatches.delete(batchId), 30 * 60 * 1000);

  return {
    success: true,
    data: {
      parseResult: {
        totalRows: result.totalRows,
        validCount: result.valid.length,
        errorCount: result.errors.length,
        errors: result.errors,
        preview: result.valid.slice(0, 20).map((t) => ({
          rowIndex: t.rowIndex,
          date: t.date.toISOString().split("T")[0],
          description: t.description,
          amount: (Number(t.amount) / 100).toFixed(2),
          type: t.type,
          reference: t.reference,
          categoryName: t.categoryName,
        })),
      },
      batchId,
    },
  };
}

export async function confirmCsvImportAction(
  batchId: string,
  accountId: string
): Promise<{ success: boolean; importedCount?: number; error?: string }> {
  const user = await requireAuth();
  await requireRole(user, UserRole.OWNER, UserRole.ADMIN, UserRole.FINANCE_MANAGER);

  const transactions = importBatches.get(batchId);
  if (!transactions || transactions.length === 0) {
    return { success: false, error: "Import session expired or not found. Please re-upload your CSV." };
  }

  // Verify account belongs to this company
  const account = await prisma.financialAccount.findFirst({
    where: { id: accountId, companyId: user.companyId },
  });
  if (!account) return { success: false, error: "Account not found." };

  // Pre-load categories for this company
  const categories = await prisma.category.findMany({
    where: { companyId: user.companyId },
  });
  const catMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

  let importedCount = 0;
  let balanceDelta = 0n;

  await prisma.$transaction(async (db) => {
    for (const t of transactions) {
      const categoryId = t.categoryName
        ? (catMap.get(t.categoryName.toLowerCase()) ?? null)
        : null;

      await db.transaction.create({
        data: {
          companyId: user.companyId,
          accountId,
          categoryId,
          type: t.type,
          status: TransactionStatus.CLEARED,
          amount: t.amount,
          description: t.description,
          reference: t.reference ?? null,
          date: t.date,
          notes: t.notes ?? null,
          importedFrom: batchId,
          createdById: user.id,
        },
      });

      balanceDelta += t.type === TransactionType.INFLOW ? t.amount : -t.amount;
      importedCount++;
    }

    // Update account balance
    await db.financialAccount.update({
      where: { id: accountId },
      data: { balance: { increment: balanceDelta } },
    });
  });

  importBatches.delete(batchId);

  await createAuditLog({
    companyId: user.companyId,
    userId: user.id,
    action: AuditAction.CSV_IMPORT,
    entity: "Transaction",
    metadata: { importedCount, batchId, accountId },
  });

  revalidatePath("/financials/transactions");
  revalidatePath("/overview");

  return { success: true, importedCount };
}
