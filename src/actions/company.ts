"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { createAuditLog } from "@/lib/audit";
import { AuditAction, UserRole } from "@prisma/client";
import { toMinorUnits } from "@/lib/calculations";
import { revalidatePath } from "next/cache";

const createCompanySchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters"),
  industry: z.string().optional(),
  currency: z.string().default("INR"),
  minCashThreshold: z.string().optional(),
});

export async function createCompanyAction(data: {
  name: string;
  industry?: string;
  currency?: string;
  minCashThreshold?: string;
}): Promise<{ success: boolean; companyId?: string; error?: string }> {
  const user = await requireAuth().catch(() => null);
  if (!user) {
    // On onboarding, user is logged in but no company yet
    const { auth } = await import("@/lib/auth");
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Not authenticated." };

    const parsed = createCompanySchema.safeParse(data);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const { name, industry, currency = "INR", minCashThreshold } = parsed.data;
    const currencySymbols: Record<string, string> = {
      INR: "₹", USD: "$", EUR: "€", GBP: "£", SGD: "S$", AED: "AED",
    };

    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now().toString(36);

    const company = await prisma.company.create({
      data: {
        name,
        slug,
        currency,
        currencySymbol: currencySymbols[currency] ?? currency,
        minCashThreshold: minCashThreshold ? toMinorUnits(minCashThreshold) : 0n,
        industry,
        members: {
          create: {
            userId: session.user.id,
            role: UserRole.OWNER,
          },
        },
      },
    });

    await seedDefaultCategories(company.id);

    await createAuditLog({
      companyId: company.id,
      userId: session.user.id,
      action: AuditAction.CREATE,
      entity: "Company",
      entityId: company.id,
      newValues: { name, currency, industry },
    });

    return { success: true, companyId: company.id };
  }

  const parsed = createCompanySchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const { name, industry, currency = "INR", minCashThreshold } = parsed.data;
  const currencySymbols: Record<string, string> = {
    INR: "₹", USD: "$", EUR: "€", GBP: "£", SGD: "S$", AED: "AED",
  };
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now().toString(36);

  const company = await prisma.company.create({
    data: {
      name,
      slug,
      currency,
      currencySymbol: currencySymbols[currency] ?? currency,
      minCashThreshold: minCashThreshold ? toMinorUnits(minCashThreshold) : 0n,
      industry,
      members: {
        create: {
          userId: user.id,
          role: UserRole.OWNER,
        },
      },
    },
  });

  await seedDefaultCategories(company.id);
  return { success: true, companyId: company.id };
}

const updateSettingsSchema = z.object({
  name: z.string().min(2).optional(),
  minCashThreshold: z.string().optional(),
  currency: z.string().optional(),
  industry: z.string().optional(),
});

export async function updateCompanySettingsAction(data: {
  name?: string;
  minCashThreshold?: string;
  currency?: string;
  industry?: string;
}): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();
  await requireRole(user, UserRole.OWNER, UserRole.ADMIN);

  const parsed = updateSettingsSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name) updateData.name = parsed.data.name;
  if (parsed.data.currency) {
    const currencySymbols: Record<string, string> = {
      INR: "₹", USD: "$", EUR: "€", GBP: "£", SGD: "S$", AED: "AED",
    };
    updateData.currency = parsed.data.currency;
    updateData.currencySymbol = currencySymbols[parsed.data.currency] ?? parsed.data.currency;
  }
  if (parsed.data.minCashThreshold !== undefined) {
    updateData.minCashThreshold = toMinorUnits(parsed.data.minCashThreshold || "0");
  }
  if (parsed.data.industry !== undefined) updateData.industry = parsed.data.industry;

  await prisma.company.update({
    where: { id: user.companyId },
    data: updateData,
  });

  await createAuditLog({
    companyId: user.companyId,
    userId: user.id,
    action: AuditAction.SETTINGS_CHANGED,
    entity: "Company",
    entityId: user.companyId,
    newValues: parsed.data as Record<string, unknown>,
  });

  revalidatePath("/settings");
  return { success: true };
}

async function seedDefaultCategories(companyId: string): Promise<void> {
  const defaults = [
    { name: "Sales Revenue", type: "INCOME" as const, color: "#22c55e" },
    { name: "Service Revenue", type: "INCOME" as const, color: "#10b981" },
    { name: "Other Income", type: "INCOME" as const, color: "#84cc16" },
    { name: "Cost of Goods Sold", type: "EXPENSE" as const, color: "#ef4444" },
    { name: "Salaries & Wages", type: "EXPENSE" as const, color: "#f97316" },
    { name: "Rent & Utilities", type: "EXPENSE" as const, color: "#8b5cf6" },
    { name: "Marketing", type: "EXPENSE" as const, color: "#ec4899" },
    { name: "Travel & Transport", type: "EXPENSE" as const, color: "#6366f1" },
    { name: "Office Supplies", type: "EXPENSE" as const, color: "#14b8a6" },
    { name: "Professional Services", type: "EXPENSE" as const, color: "#f59e0b" },
    { name: "Loan Repayment", type: "EXPENSE" as const, color: "#ef4444" },
    { name: "Tax & Compliance", type: "EXPENSE" as const, color: "#dc2626" },
    { name: "Miscellaneous", type: "EXPENSE" as const, color: "#9ca3af" },
  ];

  await prisma.category.createMany({
    data: defaults.map((d) => ({
      companyId,
      name: d.name,
      type: d.type,
      color: d.color,
      isSystem: true,
    })),
    skipDuplicates: true,
  });
}
