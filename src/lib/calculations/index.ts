/**
 * Financial Calculation Engine
 * All amounts are in minor units (e.g., paise for INR).
 * We use BigInt throughout to avoid floating-point errors.
 */

import { Decimal } from "decimal.js";

// ============================================================
// CONVERSION UTILITIES
// ============================================================

/** Convert minor units (bigint) to major units (number) for display */
export function toMajorUnits(amount: bigint): number {
  return Number(amount) / 100;
}

/** Convert major units (number/string) to minor units (bigint) for storage */
export function toMinorUnits(amount: number | string): bigint {
  const d = new Decimal(String(amount));
  return BigInt(d.mul(100).toFixed(0));
}

/** Format amount in minor units to display string */
export function formatCurrency(
  amount: bigint,
  symbol: string = "₹",
  decimals: number = 2
): string {
  const major = toMajorUnits(amount);
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(major));
  const sign = amount < 0n ? "-" : "";
  return `${sign}${symbol}${formatted}`;
}

/** Format for display in thousands/lakhs */
export function formatCompact(amount: bigint, symbol: string = "₹"): string {
  const major = Math.abs(toMajorUnits(amount));
  const sign = amount < 0n ? "-" : "";
  if (major >= 10_000_000) {
    return `${sign}${symbol}${(major / 10_000_000).toFixed(2)}Cr`;
  } else if (major >= 100_000) {
    return `${sign}${symbol}${(major / 100_000).toFixed(2)}L`;
  } else if (major >= 1_000) {
    return `${sign}${symbol}${(major / 1_000).toFixed(1)}K`;
  }
  return `${sign}${symbol}${major.toFixed(0)}`;
}

// ============================================================
// CORE CALCULATIONS
// ============================================================

export function calculateNetCashFlow(inflows: bigint, outflows: bigint): bigint {
  return inflows - outflows;
}

export function calculateCurrentCash(
  accountBalances: bigint[]
): bigint {
  return accountBalances.reduce((sum, bal) => sum + bal, 0n);
}

export function calculateTotalInflows(amounts: bigint[]): bigint {
  return amounts.reduce((sum, a) => sum + a, 0n);
}

export function calculateTotalOutflows(amounts: bigint[]): bigint {
  return amounts.reduce((sum, a) => sum + a, 0n);
}

/**
 * Core forecast formula:
 * Projected Cash = Current Cash + Expected Inflows - Expected Outflows
 */
export function calculateProjectedCash(
  currentCash: bigint,
  expectedInflows: bigint,
  expectedOutflows: bigint
): bigint {
  return currentCash + expectedInflows - expectedOutflows;
}

/**
 * Cash runway: how many days cash will last at current burn rate
 */
export function calculateCashRunway(
  currentCash: bigint,
  monthlyBurnRate: bigint
): number {
  if (monthlyBurnRate <= 0n) return Infinity;
  if (currentCash <= 0n) return 0;
  // Daily burn = monthlyBurnRate / 30
  const dailyBurn = monthlyBurnRate / 30n;
  if (dailyBurn === 0n) return Infinity;
  return Number(currentCash / dailyBurn);
}

/**
 * Budget variance: actual vs budgeted
 * Returns { variance (absolute), variancePct }
 */
export function calculateBudgetVariance(
  budgeted: bigint,
  actual: bigint
): { variance: bigint; variancePct: number } {
  const variance = actual - budgeted;
  if (budgeted === 0n) {
    return { variance, variancePct: actual > 0n ? 100 : 0 };
  }
  const variancePct = (Number(variance) / Number(budgeted)) * 100;
  return { variance, variancePct };
}

/**
 * Apply basis-point multiplier to an amount.
 * E.g., applyBps(1000000n, 500) => 1050000n  (5% increase)
 */
export function applyBps(amount: bigint, bps: number): bigint {
  if (bps === 0) return amount;
  const factor = new Decimal(1).plus(new Decimal(bps).div(10000));
  return BigInt(new Decimal(amount.toString()).mul(factor).toFixed(0));
}

/**
 * Monthly average of an array of bigint values
 */
export function monthlyAverage(values: bigint[]): bigint {
  if (values.length === 0) return 0n;
  const sum = values.reduce((a, b) => a + b, 0n);
  return sum / BigInt(values.length);
}

/**
 * Calculate percentage change between two values
 */
export function percentageChange(from: bigint, to: bigint): number {
  if (from === 0n) return to > 0n ? 100 : 0;
  return (Number(to - from) / Number(from)) * 100;
}

/**
 * Sum amounts grouped by month key "YYYY-MM"
 */
export function groupByMonth<T extends { date: Date; amount: bigint }>(
  items: T[]
): Map<string, bigint> {
  const map = new Map<string, bigint>();
  for (const item of items) {
    const key = `${item.date.getFullYear()}-${String(item.date.getMonth() + 1).padStart(2, "0")}`;
    map.set(key, (map.get(key) ?? 0n) + item.amount);
  }
  return map;
}

/**
 * Safe division returning 0 if divisor is 0
 */
export function safeDivide(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) return 0n;
  return numerator / denominator;
}
