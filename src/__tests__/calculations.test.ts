import { describe, it, expect } from "vitest";
import {
  toMajorUnits,
  toMinorUnits,
  calculateNetCashFlow,
  calculateCurrentCash,
  calculateProjectedCash,
  calculateCashRunway,
  calculateBudgetVariance,
  applyBps,
  monthlyAverage,
  percentageChange,
  formatCurrency,
  formatCompact,
} from "@/lib/calculations";

describe("toMajorUnits", () => {
  it("converts minor to major", () => {
    expect(toMajorUnits(100n)).toBe(1);
    expect(toMajorUnits(12345n)).toBe(123.45);
    expect(toMajorUnits(0n)).toBe(0);
  });

  it("handles negative values", () => {
    expect(toMajorUnits(-100n)).toBe(-1);
  });
});

describe("toMinorUnits", () => {
  it("converts major to minor", () => {
    expect(toMinorUnits(1)).toBe(100n);
    expect(toMinorUnits("123.45")).toBe(12345n);
    expect(toMinorUnits(0)).toBe(0n);
  });

  it("handles large amounts", () => {
    expect(toMinorUnits(1000000)).toBe(100000000n);
  });

  it("rounds correctly", () => {
    expect(toMinorUnits("0.005")).toBe(1n);
  });
});

describe("calculateNetCashFlow", () => {
  it("returns inflows minus outflows", () => {
    expect(calculateNetCashFlow(1000n, 700n)).toBe(300n);
  });

  it("returns negative when outflows exceed inflows", () => {
    expect(calculateNetCashFlow(500n, 800n)).toBe(-300n);
  });

  it("returns zero for equal flows", () => {
    expect(calculateNetCashFlow(500n, 500n)).toBe(0n);
  });
});

describe("calculateCurrentCash", () => {
  it("sums account balances", () => {
    expect(calculateCurrentCash([100n, 200n, 300n])).toBe(600n);
  });

  it("handles empty accounts", () => {
    expect(calculateCurrentCash([])).toBe(0n);
  });

  it("handles negative balances (credit accounts)", () => {
    expect(calculateCurrentCash([500n, -100n])).toBe(400n);
  });
});

describe("calculateProjectedCash", () => {
  it("adds inflows and subtracts outflows from current cash", () => {
    expect(calculateProjectedCash(1000n, 500n, 200n)).toBe(1300n);
  });

  it("can go negative", () => {
    expect(calculateProjectedCash(100n, 0n, 500n)).toBe(-400n);
  });

  it("zero case", () => {
    expect(calculateProjectedCash(0n, 0n, 0n)).toBe(0n);
  });
});

describe("calculateCashRunway", () => {
  it("returns days at current burn rate", () => {
    // 3000 cash / 100 daily burn = 30 days
    const runway = calculateCashRunway(3000n, 3000n); // 3000 monthly = 100/day
    expect(runway).toBeCloseTo(30, 0);
  });

  it("returns Infinity when no burn rate", () => {
    expect(calculateCashRunway(5000n, 0n)).toBe(Infinity);
  });

  it("returns 0 when no cash", () => {
    expect(calculateCashRunway(0n, 1000n)).toBe(0);
  });
});

describe("calculateBudgetVariance", () => {
  it("positive variance when over budget", () => {
    const { variance, variancePct } = calculateBudgetVariance(1000n, 1200n);
    expect(variance).toBe(200n);
    expect(variancePct).toBeCloseTo(20);
  });

  it("negative variance when under budget", () => {
    const { variance, variancePct } = calculateBudgetVariance(1000n, 800n);
    expect(variance).toBe(-200n);
    expect(variancePct).toBeCloseTo(-20);
  });

  it("handles zero budget", () => {
    const { variance, variancePct } = calculateBudgetVariance(0n, 500n);
    expect(variance).toBe(500n);
    expect(variancePct).toBe(100);
  });

  it("zero variance for exact match", () => {
    const { variance, variancePct } = calculateBudgetVariance(500n, 500n);
    expect(variance).toBe(0n);
    expect(variancePct).toBe(0);
  });
});

describe("applyBps", () => {
  it("applies 10% increase", () => {
    expect(applyBps(1000n, 1000)).toBe(1100n); // +10%
  });

  it("applies 15% decrease", () => {
    expect(applyBps(1000n, -1500)).toBe(850n); // -15%
  });

  it("returns same for 0 bps", () => {
    expect(applyBps(1000n, 0)).toBe(1000n);
  });

  it("handles large amounts", () => {
    expect(applyBps(100_000_000n, 500)).toBe(105_000_000n); // +5%
  });
});

describe("monthlyAverage", () => {
  it("averages correctly", () => {
    expect(monthlyAverage([100n, 200n, 300n])).toBe(200n);
  });

  it("returns 0 for empty array", () => {
    expect(monthlyAverage([])).toBe(0n);
  });

  it("handles single value", () => {
    expect(monthlyAverage([500n])).toBe(500n);
  });
});

describe("percentageChange", () => {
  it("returns positive for increase", () => {
    expect(percentageChange(100n, 150n)).toBeCloseTo(50);
  });

  it("returns negative for decrease", () => {
    expect(percentageChange(200n, 100n)).toBeCloseTo(-50);
  });

  it("handles zero from", () => {
    expect(percentageChange(0n, 100n)).toBe(100);
    expect(percentageChange(0n, 0n)).toBe(0);
  });
});

describe("formatCurrency", () => {
  it("formats basic amount", () => {
    expect(formatCurrency(100000n, "₹")).toBe("₹1,000.00");
  });

  it("formats negative amount", () => {
    const result = formatCurrency(-50000n, "₹");
    expect(result).toContain("-");
    expect(result).toContain("500");
  });

  it("formats zero", () => {
    expect(formatCurrency(0n, "₹")).toBe("₹0.00");
  });
});

describe("formatCompact", () => {
  it("formats crores", () => {
    expect(formatCompact(1_000_000_000n, "₹")).toContain("Cr");
  });

  it("formats lakhs", () => {
    expect(formatCompact(10_000_000n, "₹")).toContain("L");
  });

  it("formats thousands", () => {
    expect(formatCompact(100_000n, "₹")).toContain("K");
  });
});
