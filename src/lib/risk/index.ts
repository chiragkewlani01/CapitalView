/**
 * Risk Detection Engine
 * Deterministic, rule-based risk detection. No AI involved here.
 * All financial rules produce structured RiskItem objects.
 */

import { AlertSeverity, AlertType } from "@prisma/client";
import type {
  RiskItem,
  ForecastResult,
  ReceivablesSummary,
  PayablesSummary,
} from "@/types";
import { toMajorUnits } from "@/lib/calculations";

export interface RiskDetectionInput {
  currentCash: bigint;
  minCashThreshold: bigint;
  monthlyAvgOutflows: bigint;
  receivablesSummary: ReceivablesSummary;
  payablesSummary: PayablesSummary;
  forecast30?: ForecastResult;
  recentMonthOutflows: bigint[];
  largePayables: Array<{ description: string; amount: bigint; dueDate: Date; id: string }>;
  currencySymbol: string;
}

function fmt(amount: bigint, symbol: string): string {
  const major = toMajorUnits(amount);
  if (major >= 10_000_000) return `${symbol}${(major / 10_000_000).toFixed(2)}Cr`;
  if (major >= 100_000) return `${symbol}${(major / 100_000).toFixed(2)}L`;
  if (major >= 1_000) return `${symbol}${(major / 1_000).toFixed(1)}K`;
  return `${symbol}${major.toFixed(0)}`;
}

export function detectLowCashRisk(
  currentCash: bigint,
  minCashThreshold: bigint,
  monthlyAvgOutflows: bigint,
  symbol: string
): RiskItem | null {
  if (currentCash <= 0n) {
    return {
      type: AlertType.CASH_SHORTAGE,
      severity: AlertSeverity.CRITICAL,
      title: "Negative Cash Position",
      description: `Current cash balance is negative at ${fmt(currentCash, symbol)}. Immediate action required.`,
      amount: currentCash,
    };
  }

  if (minCashThreshold > 0n && currentCash < minCashThreshold) {
    return {
      type: AlertType.LOW_CASH,
      severity: AlertSeverity.CRITICAL,
      title: "Cash Below Minimum Threshold",
      description: `Current cash ${fmt(currentCash, symbol)} is below the minimum threshold of ${fmt(minCashThreshold, symbol)}.`,
      amount: currentCash,
    };
  }

  // Warn if cash covers less than 2 months of outflows
  if (monthlyAvgOutflows > 0n) {
    const coverageMonths = Number(currentCash) / Number(monthlyAvgOutflows);
    if (coverageMonths < 2) {
      return {
        type: AlertType.LOW_CASH,
        severity: AlertSeverity.WARNING,
        title: "Low Cash — Less Than 2 Months Coverage",
        description: `Current cash ${fmt(currentCash, symbol)} covers only ${coverageMonths.toFixed(1)} months of average expenses.`,
        amount: currentCash,
      };
    }
  }

  return null;
}

export function detectExpenseIncrease(
  recentMonthOutflows: bigint[],
  symbol: string
): RiskItem | null {
  if (recentMonthOutflows.length < 3) return null;

  const recent = recentMonthOutflows.slice(-1)[0];
  const prev3Avg =
    recentMonthOutflows.slice(-4, -1).reduce((a, b) => a + b, 0n) /
    BigInt(recentMonthOutflows.slice(-4, -1).length);

  if (prev3Avg === 0n) return null;

  const pctIncrease = ((Number(recent) - Number(prev3Avg)) / Number(prev3Avg)) * 100;

  if (pctIncrease >= 25) {
    return {
      type: AlertType.EXPENSE_INCREASE,
      severity: AlertSeverity.CRITICAL,
      title: "Significant Expense Increase",
      description: `Expenses this month (${fmt(recent, symbol)}) are ${pctIncrease.toFixed(0)}% higher than the 3-month average (${fmt(prev3Avg, symbol)}).`,
      amount: recent - prev3Avg,
    };
  }

  if (pctIncrease >= 15) {
    return {
      type: AlertType.EXPENSE_INCREASE,
      severity: AlertSeverity.WARNING,
      title: "Rising Expenses",
      description: `Expenses this month (${fmt(recent, symbol)}) are ${pctIncrease.toFixed(0)}% higher than the 3-month average (${fmt(prev3Avg, symbol)}).`,
      amount: recent - prev3Avg,
    };
  }

  return null;
}

export function detectOverdueReceivables(
  overdueAmount: bigint,
  totalReceivables: bigint,
  symbol: string
): RiskItem | null {
  if (overdueAmount <= 0n) return null;

  const overduePct =
    totalReceivables > 0n
      ? (Number(overdueAmount) / Number(totalReceivables)) * 100
      : 0;

  if (overduePct >= 50 || overdueAmount > 5_000_000_00n /* >50L */) {
    return {
      type: AlertType.OVERDUE_RECEIVABLE,
      severity: AlertSeverity.CRITICAL,
      title: "High Overdue Receivables",
      description: `${fmt(overdueAmount, symbol)} (${overduePct.toFixed(0)}% of total) in receivables is overdue. This significantly impacts your projected cash flow.`,
      amount: overdueAmount,
    };
  }

  return {
    type: AlertType.OVERDUE_RECEIVABLE,
    severity: AlertSeverity.WARNING,
    title: "Overdue Receivables",
    description: `${fmt(overdueAmount, symbol)} in receivables is overdue (${overduePct.toFixed(0)}% of total receivables).`,
    amount: overdueAmount,
  };
}

export function detectLargeUpcomingPayment(
  payables: Array<{ description: string; amount: bigint; dueDate: Date; id: string }>,
  currentCash: bigint,
  symbol: string
): RiskItem | null {
  if (payables.length === 0) return null;

  // Flag any single payable > 30% of current cash
  for (const payable of payables) {
    const pct = currentCash > 0n ? (Number(payable.amount) / Number(currentCash)) * 100 : 100;
    if (pct >= 30) {
      return {
        type: AlertType.LARGE_UPCOMING_PAYMENT,
        severity: AlertSeverity.WARNING,
        title: "Large Upcoming Payment",
        description: `${payable.description} (${fmt(payable.amount, symbol)}) due on ${payable.dueDate.toLocaleDateString("en-IN")} represents ${pct.toFixed(0)}% of current cash.`,
        amount: payable.amount,
        date: payable.dueDate,
        relatedEntity: "payable",
        relatedId: payable.id,
      };
    }
  }

  return null;
}

export function detectNegativeCashFlow(
  forecast30: ForecastResult | undefined,
  symbol: string
): RiskItem | null {
  if (!forecast30) return null;

  if (forecast30.cashShortageDate) {
    return {
      type: AlertType.NEGATIVE_CASH_FLOW,
      severity: AlertSeverity.CRITICAL,
      title: "Projected Cash Shortage",
      description: `Cash is projected to run out on ${forecast30.cashShortageDate.toLocaleDateString("en-IN")} with a shortage of ${fmt(forecast30.cashShortageAmount ?? 0n, symbol)}.`,
      amount: forecast30.cashShortageAmount,
      date: forecast30.cashShortageDate,
    };
  }

  // Warn if projected balance falls more than 40% in 30 days
  const drop = forecast30.startingCash - forecast30.projectedEndingCash;
  if (forecast30.startingCash > 0n) {
    const dropPct = (Number(drop) / Number(forecast30.startingCash)) * 100;
    if (dropPct >= 40) {
      return {
        type: AlertType.NEGATIVE_CASH_FLOW,
        severity: AlertSeverity.WARNING,
        title: "Significant Cash Decline Forecast",
        description: `Cash is projected to drop ${dropPct.toFixed(0)}% over 30 days from ${fmt(forecast30.startingCash, symbol)} to ${fmt(forecast30.projectedEndingCash, symbol)}.`,
        amount: drop,
      };
    }
  }

  return null;
}

/**
 * Run all risk detectors and return structured risks sorted by severity.
 */
export function detectAllRisks(input: RiskDetectionInput): RiskItem[] {
  const risks: RiskItem[] = [];

  const low = detectLowCashRisk(
    input.currentCash,
    input.minCashThreshold,
    input.monthlyAvgOutflows,
    input.currencySymbol
  );
  if (low) risks.push(low);

  const expIncrease = detectExpenseIncrease(
    input.recentMonthOutflows,
    input.currencySymbol
  );
  if (expIncrease) risks.push(expIncrease);

  const overdue = detectOverdueReceivables(
    input.receivablesSummary.overdue,
    input.receivablesSummary.total,
    input.currencySymbol
  );
  if (overdue) risks.push(overdue);

  const largePayment = detectLargeUpcomingPayment(
    input.largePayables,
    input.currentCash,
    input.currencySymbol
  );
  if (largePayment) risks.push(largePayment);

  const negativeCF = detectNegativeCashFlow(input.forecast30, input.currencySymbol);
  if (negativeCF) risks.push(negativeCF);

  // Sort: CRITICAL first, then WARNING, then INFO
  const severityOrder: Record<AlertSeverity, number> = {
    CRITICAL: 0,
    WARNING: 1,
    INFO: 2,
  };

  return risks.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );
}
