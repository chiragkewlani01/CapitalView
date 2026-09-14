/**
 * Financial Context Builder for AI
 * Builds structured, controlled context from computed financial data.
 * AI never gets raw DB access — it receives structured summaries only.
 */

import { prisma } from "@/lib/prisma";
import {
  toMajorUnits,
  formatCompact,
  monthlyAverage,
} from "@/lib/calculations";
import { generateForecast, SCENARIO_DEFAULTS } from "@/lib/forecasting";
import { detectAllRisks } from "@/lib/risk";
import { ForecastScenario, TransactionType, ReceivableStatus, PayableStatus } from "@prisma/client";
import { startOfMonth, subMonths, endOfMonth, startOfDay, format } from "date-fns";
import type { FinancialContext } from "@/types";

export async function buildFinancialContext(companyId: string): Promise<FinancialContext> {
  const now = new Date();
  const periodEnd = endOfMonth(now);
  const periodStart = startOfMonth(subMonths(now, 5)); // last 6 months

  const [company, accounts, transactions, receivables, payables] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
    prisma.financialAccount.findMany({ where: { companyId, isActive: true } }),
    prisma.transaction.findMany({
      where: { companyId, date: { gte: periodStart, lte: periodEnd } },
      include: { category: true },
      orderBy: { date: "asc" },
    }),
    prisma.receivable.findMany({
      where: {
        companyId,
        status: { notIn: ["PAID", "CANCELLED"] },
      },
    }),
    prisma.payable.findMany({
      where: {
        companyId,
        status: { notIn: ["PAID", "CANCELLED"] },
      },
    }),
  ]);

  const currentCash = accounts.reduce((sum, a) => sum + a.balance, 0n);
  const sym = company.currencySymbol;

  const inflows = transactions.filter((t) => t.type === TransactionType.INFLOW);
  const outflows = transactions.filter((t) => t.type === TransactionType.OUTFLOW);

  const totalInflows = inflows.reduce((s, t) => s + t.amount, 0n);
  const totalOutflows = outflows.reduce((s, t) => s + t.amount, 0n);

  // Monthly aggregates
  const monthlyInflowMap = new Map<string, bigint>();
  const monthlyOutflowMap = new Map<string, bigint>();

  for (const t of inflows) {
    const key = format(t.date, "yyyy-MM");
    monthlyInflowMap.set(key, (monthlyInflowMap.get(key) ?? 0n) + t.amount);
  }
  for (const t of outflows) {
    const key = format(t.date, "yyyy-MM");
    monthlyOutflowMap.set(key, (monthlyOutflowMap.get(key) ?? 0n) + t.amount);
  }

  const avgMonthlyInflows = monthlyAverage([...monthlyInflowMap.values()]);
  const avgMonthlyOutflows = monthlyAverage([...monthlyOutflowMap.values()]);

  // Receivables summary
  const overdueReceivables = receivables.filter(
    (r) => r.status === ReceivableStatus.OVERDUE || (r.dueDate < now && r.status !== ReceivableStatus.PAID)
  );
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const monthEndDate = endOfMonth(now);

  const receivablesSummary = {
    total: receivables.reduce((s, r) => s + r.amount - r.amountPaid, 0n),
    overdue: overdueReceivables.reduce((s, r) => s + r.amount - r.amountPaid, 0n),
    dueThisWeek: receivables.filter((r) => r.dueDate <= weekEnd && r.dueDate >= now)
      .reduce((s, r) => s + r.amount - r.amountPaid, 0n),
    dueThisMonth: receivables.filter((r) => r.dueDate <= monthEndDate)
      .reduce((s, r) => s + r.amount - r.amountPaid, 0n),
    collected: receivables.filter((r) => r.status === ReceivableStatus.PAID)
      .reduce((s, r) => s + r.amount, 0n),
  };

  const overduePayables = payables.filter(
    (p) => p.status === PayableStatus.OVERDUE || (p.dueDate < now && p.status !== PayableStatus.PAID)
  );
  const payablesSummary = {
    total: payables.reduce((s, p) => s + p.amount - p.amountPaid, 0n),
    overdue: overduePayables.reduce((s, p) => s + p.amount - p.amountPaid, 0n),
    dueThisWeek: payables.filter((p) => p.dueDate <= weekEnd && p.dueDate >= now)
      .reduce((s, p) => s + p.amount - p.amountPaid, 0n),
    dueThisMonth: payables.filter((p) => p.dueDate <= monthEndDate)
      .reduce((s, p) => s + p.amount - p.amountPaid, 0n),
    paid: payables.filter((p) => p.status === PayableStatus.PAID)
      .reduce((s, p) => s + p.amount, 0n),
  };

  // Build receivables/payables by date maps
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

  // Generate 30-day base forecast
  const forecast30 = generateForecast({
    scenario: ForecastScenario.BASE,
    startDate: startOfDay(now),
    horizonDays: 30,
    startingCash: currentCash,
    avgMonthlyInflows,
    avgMonthlyOutflows,
    receivablesByDate,
    payablesByDate,
    assumptions: SCENARIO_DEFAULTS.BASE,
    minCashThreshold: company.minCashThreshold,
  });

  // Top expense categories
  const categoryTotals = new Map<string, bigint>();
  for (const t of outflows) {
    const name = t.category?.name ?? "Uncategorized";
    categoryTotals.set(name, (categoryTotals.get(name) ?? 0n) + t.amount);
  }
  const topExpenseCategories = [...categoryTotals.entries()]
    .sort((a, b) => (b[1] > a[1] ? 1 : -1))
    .slice(0, 5)
    .map(([name, amount]) => ({ name, amount }));

  // Risks
  const recentMonthOutflows = [...monthlyOutflowMap.values()].slice(-4);
  const largePayables = payables
    .filter((p) => p.status !== PayableStatus.PAID && p.status !== PayableStatus.CANCELLED)
    .sort((a, b) => (b.amount > a.amount ? 1 : -1))
    .slice(0, 3)
    .map((p) => ({
      id: p.id,
      description: p.description,
      amount: p.amount - p.amountPaid,
      dueDate: p.dueDate,
    }));

  const topRisks = detectAllRisks({
    currentCash,
    minCashThreshold: company.minCashThreshold,
    monthlyAvgOutflows: avgMonthlyOutflows,
    receivablesSummary,
    payablesSummary,
    forecast30,
    recentMonthOutflows,
    largePayables,
    currencySymbol: sym,
  });

  return {
    company: {
      name: company.name,
      currency: company.currency,
      currencySymbol: sym,
      minCashThreshold: company.minCashThreshold,
    },
    cashPosition: {
      currentCash,
      totalInflows,
      totalOutflows,
      netCashFlow: totalInflows - totalOutflows,
    },
    currentCash,
    receivablesSummary,
    payablesSummary,
    forecast30,
    topExpenseCategories,
    topRisks,
    recentTransactionCount: transactions.length,
    periodStart,
    periodEnd,
  };
}

export function formatContextForAI(ctx: FinancialContext): string {
  const s = ctx.company.currencySymbol;
  const fmt = (a: bigint) => formatCompact(a, s);

  return `
COMPANY FINANCIAL CONTEXT (as of ${new Date().toLocaleDateString("en-IN")})
Company: ${ctx.company.name} | Currency: ${ctx.company.currency}
Minimum Cash Threshold: ${fmt(ctx.company.minCashThreshold)}

CURRENT CASH POSITION:
- Current Cash Balance: ${fmt(ctx.currentCash)}
- Total Inflows (last 6 months): ${fmt(ctx.cashPosition.totalInflows)}
- Total Outflows (last 6 months): ${fmt(ctx.cashPosition.totalOutflows)}
- Net Cash Flow (last 6 months): ${fmt(ctx.cashPosition.netCashFlow)}

RECEIVABLES (Outstanding):
- Total Outstanding: ${fmt(ctx.receivablesSummary.total)}
- Overdue: ${fmt(ctx.receivablesSummary.overdue)}
- Due This Week: ${fmt(ctx.receivablesSummary.dueThisWeek)}
- Due This Month: ${fmt(ctx.receivablesSummary.dueThisMonth)}

PAYABLES (Outstanding):
- Total Outstanding: ${fmt(ctx.payablesSummary.total)}
- Overdue: ${fmt(ctx.payablesSummary.overdue)}
- Due This Week: ${fmt(ctx.payablesSummary.dueThisWeek)}
- Due This Month: ${fmt(ctx.payablesSummary.dueThisMonth)}

30-DAY FORECAST (BASE SCENARIO):
- Starting Cash: ${fmt(ctx.forecast30?.startingCash ?? 0n)}
- Projected Ending Cash: ${fmt(ctx.forecast30?.projectedEndingCash ?? 0n)}
- Minimum Projected Balance: ${fmt(ctx.forecast30?.minProjectedBalance ?? 0n)} on ${ctx.forecast30?.minBalanceDate?.toLocaleDateString("en-IN") ?? "N/A"}
${ctx.forecast30?.cashShortageDate ? `- ⚠️ CASH SHORTAGE: Projected on ${ctx.forecast30.cashShortageDate.toLocaleDateString("en-IN")} (${fmt(ctx.forecast30.cashShortageAmount ?? 0n)})` : "- No cash shortage projected in 30 days"}
${ctx.forecast30?.cashRunwayDays !== undefined ? `- Cash Runway: ${ctx.forecast30.cashRunwayDays} days` : ""}

TOP EXPENSE CATEGORIES (last 6 months):
${ctx.topExpenseCategories.map((c) => `- ${c.name}: ${fmt(c.amount)}`).join("\n")}

ACTIVE RISKS:
${ctx.topRisks.length === 0 ? "- No active risks detected" : ctx.topRisks.map((r) => `- [${r.severity}] ${r.title}: ${r.description}`).join("\n")}

IMPORTANT: This data is for decision-support only. All recommendations should be reviewed by qualified financial professionals before action.
`.trim();
}
