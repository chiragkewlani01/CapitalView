/**
 * Forecast Engine
 * Generates daily projected cash balance for 30/60/90 day horizons.
 * Uses: current cash + historical averages + known receivables/payables + assumptions.
 */

import { addDays, startOfDay, format } from "date-fns";
import { applyBps, calculateProjectedCash } from "@/lib/calculations";
import type {
  ForecastResult,
  ForecastDayItem,
  ScenarioAssumptions,
} from "@/types";
import { ForecastScenario } from "@prisma/client";

export interface ForecastInput {
  scenario: ForecastScenario;
  startDate: Date;
  horizonDays: number; // 30, 60, 90
  startingCash: bigint;
  // Historical monthly averages
  avgMonthlyInflows: bigint;
  avgMonthlyOutflows: bigint;
  // Known future items (receivables/payables by date)
  receivablesByDate: Map<string, bigint>; // "YYYY-MM-DD" -> amount
  payablesByDate: Map<string, bigint>;
  assumptions: ScenarioAssumptions;
  minCashThreshold: bigint;
}

export const SCENARIO_DEFAULTS: Record<ForecastScenario, ScenarioAssumptions> = {
  BASE: {
    revenueGrowthBps: 0,
    expenseGrowthBps: 0,
    collectionDelayDays: 0,
    paymentDelayDays: 0,
  },
  OPTIMISTIC: {
    revenueGrowthBps: 1000, // +10%
    expenseGrowthBps: -500, // -5%
    collectionDelayDays: -7, // receive 7 days earlier
    paymentDelayDays: 7, // pay 7 days later
  },
  PESSIMISTIC: {
    revenueGrowthBps: -1500, // -15%
    expenseGrowthBps: 1000, // +10%
    collectionDelayDays: 14, // receive 14 days later
    paymentDelayDays: -7, // forced to pay 7 days earlier
  },
  CUSTOM: {
    revenueGrowthBps: 0,
    expenseGrowthBps: 0,
    collectionDelayDays: 0,
    paymentDelayDays: 0,
  },
};

export function generateForecast(input: ForecastInput): ForecastResult {
  const {
    scenario,
    startDate,
    horizonDays,
    startingCash,
    avgMonthlyInflows,
    avgMonthlyOutflows,
    assumptions,
    minCashThreshold,
  } = input;

  // Adjust daily averages based on scenario assumptions
  const avgDailyInflows =
    applyBps(avgMonthlyInflows, assumptions.revenueGrowthBps) / 30n;
  const avgDailyOutflows =
    applyBps(avgMonthlyOutflows, assumptions.expenseGrowthBps) / 30n;

  const items: ForecastDayItem[] = [];
  let runningBalance = startingCash;

  let minBalance = startingCash;
  let minBalanceDate = startDate;
  let cashShortageDate: Date | undefined;
  let cashShortageAmount: bigint | undefined;

  for (let i = 0; i < horizonDays; i++) {
    const date = startOfDay(addDays(startDate, i));
    const dateKey = format(date, "yyyy-MM-dd");

    const openingBalance = runningBalance;

    // Base daily amounts from historical averages
    let dayInflows = avgDailyInflows;
    let dayOutflows = avgDailyOutflows;

    // Add known receivables for this date (with collection delay adjustment)
    const adjustedReceivableDate = format(
      addDays(date, -assumptions.collectionDelayDays),
      "yyyy-MM-dd"
    );
    const receivableAmount = input.receivablesByDate.get(adjustedReceivableDate) ?? 0n;
    dayInflows = dayInflows + applyBps(receivableAmount, assumptions.revenueGrowthBps);

    // Add known payables for this date (with payment delay adjustment)
    const adjustedPayableDate = format(
      addDays(date, -assumptions.paymentDelayDays),
      "yyyy-MM-dd"
    );
    const payableAmount = input.payablesByDate.get(adjustedPayableDate) ?? 0n;
    dayOutflows = dayOutflows + applyBps(payableAmount, assumptions.expenseGrowthBps);

    const netCashFlow = dayInflows - dayOutflows;
    const closingBalance = calculateProjectedCash(openingBalance, dayInflows, dayOutflows);

    const isShortagePeriod = closingBalance < minCashThreshold;

    if (closingBalance < minBalance) {
      minBalance = closingBalance;
      minBalanceDate = date;
    }

    if (!cashShortageDate && closingBalance < 0n) {
      cashShortageDate = date;
      cashShortageAmount = -closingBalance;
    }

    items.push({
      date,
      openingBalance,
      inflows: dayInflows,
      outflows: dayOutflows,
      netCashFlow,
      closingBalance,
      isShortagePeriod,
    });

    runningBalance = closingBalance;
  }

  // Calculate cash runway: days until cash hits zero
  let cashRunwayDays: number | undefined;
  const shortagePeriod = items.findIndex((item) => item.closingBalance <= 0n);
  if (shortagePeriod !== -1) {
    cashRunwayDays = shortagePeriod;
  }

  return {
    scenario,
    startDate,
    endDate: addDays(startDate, horizonDays - 1),
    startingCash,
    projectedEndingCash: runningBalance,
    minProjectedBalance: minBalance,
    minBalanceDate,
    cashShortageDate,
    cashShortageAmount,
    cashRunwayDays,
    items,
  };
}

/**
 * Compare two scenario forecasts and return summary differences
 */
export function compareScenarios(
  base: ForecastResult,
  other: ForecastResult
): {
  endingCashDiff: bigint;
  endingCashDiffPct: number;
  earlierShortage: boolean;
  runwayDiffDays: number;
} {
  const endingCashDiff = other.projectedEndingCash - base.projectedEndingCash;
  const endingCashDiffPct =
    base.projectedEndingCash !== 0n
      ? (Number(endingCashDiff) / Number(base.projectedEndingCash)) * 100
      : 0;

  const baseRunway = base.cashRunwayDays ?? Infinity;
  const otherRunway = other.cashRunwayDays ?? Infinity;
  const earlierShortage = otherRunway < baseRunway;
  const runwayDiffDays =
    baseRunway === Infinity || otherRunway === Infinity
      ? 0
      : otherRunway - baseRunway;

  return {
    endingCashDiff,
    endingCashDiffPct,
    earlierShortage,
    runwayDiffDays,
  };
}
