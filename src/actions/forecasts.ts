"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guards";
import { createAuditLog } from "@/lib/audit";
import { AuditAction, ForecastScenario, TransactionType, ReceivableStatus, PayableStatus } from "@prisma/client";
import { generateForecast, SCENARIO_DEFAULTS } from "@/lib/forecasting";
import { monthlyAverage } from "@/lib/calculations";
import { startOfDay, startOfMonth, subMonths, endOfMonth, format } from "date-fns";
import type { ScenarioAssumptions } from "@/types";
import { revalidatePath } from "next/cache";

export async function generateForecastAction(
  scenario: ForecastScenario,
  horizonDays: 30 | 60 | 90,
  customAssumptions?: Partial<ScenarioAssumptions>
) {
  const user = await requireAuth();

  const now = new Date();
  const periodStart = startOfMonth(subMonths(now, 5));
  const periodEnd = endOfMonth(now);

  const [company, accounts, transactions, receivables, payables] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: user.companyId } }),
    prisma.financialAccount.findMany({ where: { companyId: user.companyId, isActive: true } }),
    prisma.transaction.findMany({
      where: { companyId: user.companyId, date: { gte: periodStart, lte: periodEnd } },
      orderBy: { date: "asc" },
    }),
    prisma.receivable.findMany({
      where: { companyId: user.companyId, status: { notIn: [ReceivableStatus.PAID, ReceivableStatus.CANCELLED] } },
    }),
    prisma.payable.findMany({
      where: { companyId: user.companyId, status: { notIn: [PayableStatus.PAID, PayableStatus.CANCELLED] } },
    }),
  ]);

  const currentCash = accounts.reduce((s, a) => s + a.balance, 0n);

  // Monthly averages
  const monthlyInflowMap = new Map<string, bigint>();
  const monthlyOutflowMap = new Map<string, bigint>();
  for (const t of transactions) {
    const key = format(t.date, "yyyy-MM");
    if (t.type === TransactionType.INFLOW) {
      monthlyInflowMap.set(key, (monthlyInflowMap.get(key) ?? 0n) + t.amount);
    } else {
      monthlyOutflowMap.set(key, (monthlyOutflowMap.get(key) ?? 0n) + t.amount);
    }
  }

  const avgMonthlyInflows = monthlyAverage([...monthlyInflowMap.values()]);
  const avgMonthlyOutflows = monthlyAverage([...monthlyOutflowMap.values()]);

  // Build receivables/payables date maps
  const receivablesByDate = new Map<string, bigint>();
  for (const r of receivables) {
    const key = format(r.dueDate, "yyyy-MM-dd");
    receivablesByDate.set(key, (receivablesByDate.get(key) ?? 0n) + r.amount - r.amountPaid);
  }

  const payablesByDate = new Map<string, bigint>();
  for (const p of payables) {
    const key = format(p.dueDate, "yyyy-MM-dd");
    payablesByDate.set(key, (payablesByDate.get(key) ?? 0n) + p.amount - p.amountPaid);
  }

  const baseAssumptions = SCENARIO_DEFAULTS[scenario];
  const assumptions: ScenarioAssumptions = {
    ...baseAssumptions,
    ...customAssumptions,
  };

  const result = generateForecast({
    scenario,
    startDate: startOfDay(now),
    horizonDays,
    startingCash: currentCash,
    avgMonthlyInflows,
    avgMonthlyOutflows,
    receivablesByDate,
    payablesByDate,
    assumptions,
    minCashThreshold: company.minCashThreshold,
  });

  // Persist forecast
  const forecast = await prisma.$transaction(async (db) => {
    const f = await db.forecast.create({
      data: {
        companyId: user.companyId,
        scenario,
        startDate: result.startDate,
        endDate: result.endDate,
        startingCash: result.startingCash,
        revenueGrowthBps: assumptions.revenueGrowthBps,
        expenseGrowthBps: assumptions.expenseGrowthBps,
        collectionDelayDays: assumptions.collectionDelayDays,
        paymentDelayDays: assumptions.paymentDelayDays,
        projectedEndingCash: result.projectedEndingCash,
        minProjectedBalance: result.minProjectedBalance,
        minBalanceDate: result.minBalanceDate,
        cashShortageDate: result.cashShortageDate ?? null,
        cashShortageAmount: result.cashShortageAmount ?? null,
        cashRunwayDays: result.cashRunwayDays ?? null,
      },
    });

    await db.forecastItem.createMany({
      data: result.items.map((item) => ({
        forecastId: f.id,
        date: item.date,
        openingBalance: item.openingBalance,
        inflows: item.inflows,
        outflows: item.outflows,
        netCashFlow: item.netCashFlow,
        closingBalance: item.closingBalance,
        isShortagePeriod: item.isShortagePeriod,
      })),
    });

    return f;
  });

  await createAuditLog({
    companyId: user.companyId,
    userId: user.id,
    action: AuditAction.FORECAST_GENERATED,
    entity: "Forecast",
    entityId: forecast.id,
    metadata: { scenario, horizonDays },
  });

  revalidatePath("/planning/forecast");
  revalidatePath("/planning/scenarios");

  return { success: true, forecastId: forecast.id, result };
}

export async function getLatestForecastAction(
  scenario: ForecastScenario = ForecastScenario.BASE
) {
  const user = await requireAuth();

  const forecast = await prisma.forecast.findFirst({
    where: { companyId: user.companyId, scenario },
    orderBy: { generatedAt: "desc" },
    include: {
      items: { orderBy: { date: "asc" } },
    },
  });

  return forecast;
}
