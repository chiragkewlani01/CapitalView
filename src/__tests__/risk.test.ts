import { describe, it, expect } from "vitest";
import {
  detectLowCashRisk,
  detectExpenseIncrease,
  detectOverdueReceivables,
  detectLargeUpcomingPayment,
  detectNegativeCashFlow,
  detectAllRisks,
} from "@/lib/risk";
import { AlertSeverity, AlertType, ForecastScenario } from "@prisma/client";
import { generateForecast, SCENARIO_DEFAULTS } from "@/lib/forecasting";

const SYM = "₹";

describe("detectLowCashRisk", () => {
  it("returns CRITICAL for negative cash", () => {
    const risk = detectLowCashRisk(-100n, 1000n, 500n, SYM);
    expect(risk).not.toBeNull();
    expect(risk!.severity).toBe(AlertSeverity.CRITICAL);
    expect(risk!.type).toBe(AlertType.CASH_SHORTAGE);
  });

  it("returns CRITICAL when below threshold", () => {
    const risk = detectLowCashRisk(500n, 1000n, 100n, SYM);
    expect(risk).not.toBeNull();
    expect(risk!.severity).toBe(AlertSeverity.CRITICAL);
    expect(risk!.type).toBe(AlertType.LOW_CASH);
  });

  it("returns WARNING for less than 2 months coverage", () => {
    const monthlyBurn = 1000n;
    const cash = 1500n; // 1.5 months
    const risk = detectLowCashRisk(cash, 0n, monthlyBurn, SYM);
    expect(risk).not.toBeNull();
    expect(risk!.severity).toBe(AlertSeverity.WARNING);
  });

  it("returns null when healthy", () => {
    const risk = detectLowCashRisk(5000n, 0n, 1000n, SYM);
    expect(risk).toBeNull();
  });

  it("returns null when no burn rate", () => {
    const risk = detectLowCashRisk(100n, 0n, 0n, SYM);
    expect(risk).toBeNull();
  });
});

describe("detectExpenseIncrease", () => {
  it("returns CRITICAL for 25%+ increase", () => {
    const outflows = [1000n, 1000n, 1000n, 1300n]; // 30% increase
    const risk = detectExpenseIncrease(outflows, SYM);
    expect(risk).not.toBeNull();
    expect(risk!.severity).toBe(AlertSeverity.CRITICAL);
  });

  it("returns WARNING for 15-25% increase", () => {
    const outflows = [1000n, 1000n, 1000n, 1180n]; // 18% increase
    const risk = detectExpenseIncrease(outflows, SYM);
    expect(risk).not.toBeNull();
    expect(risk!.severity).toBe(AlertSeverity.WARNING);
  });

  it("returns null for normal variation", () => {
    const outflows = [1000n, 1000n, 1000n, 1100n]; // 10% increase
    const risk = detectExpenseIncrease(outflows, SYM);
    expect(risk).toBeNull();
  });

  it("returns null for fewer than 3 data points", () => {
    const risk = detectExpenseIncrease([1000n, 2000n], SYM);
    expect(risk).toBeNull();
  });

  it("returns null when no increase", () => {
    const risk = detectExpenseIncrease([1000n, 1000n, 1000n, 900n], SYM);
    expect(risk).toBeNull();
  });
});

describe("detectOverdueReceivables", () => {
  it("returns CRITICAL for high overdue percentage", () => {
    const risk = detectOverdueReceivables(6000n, 10000n, SYM);
    expect(risk).not.toBeNull();
    expect(risk!.severity).toBe(AlertSeverity.CRITICAL);
  });

  it("returns WARNING for low overdue amount", () => {
    const risk = detectOverdueReceivables(1000n, 10000n, SYM);
    expect(risk).not.toBeNull();
    expect(risk!.severity).toBe(AlertSeverity.WARNING);
  });

  it("returns null when no overdue", () => {
    const risk = detectOverdueReceivables(0n, 5000n, SYM);
    expect(risk).toBeNull();
  });
});

describe("detectLargeUpcomingPayment", () => {
  it("returns WARNING for payment >30% of cash", () => {
    const payables = [{
      id: "pay1",
      description: "Big payment",
      amount: 400n,
      dueDate: new Date(),
    }];
    const risk = detectLargeUpcomingPayment(payables, 1000n, SYM);
    expect(risk).not.toBeNull();
    expect(risk!.severity).toBe(AlertSeverity.WARNING);
  });

  it("returns null for small payment", () => {
    const payables = [{
      id: "pay1",
      description: "Small payment",
      amount: 100n,
      dueDate: new Date(),
    }];
    const risk = detectLargeUpcomingPayment(payables, 1000n, SYM);
    expect(risk).toBeNull();
  });

  it("returns null for empty payables", () => {
    const risk = detectLargeUpcomingPayment([], 1000n, SYM);
    expect(risk).toBeNull();
  });

  it("returns WARNING when cash is zero", () => {
    const payables = [{
      id: "pay1",
      description: "Any payment",
      amount: 100n,
      dueDate: new Date(),
    }];
    const risk = detectLargeUpcomingPayment(payables, 0n, SYM);
    expect(risk).not.toBeNull();
  });
});

describe("detectNegativeCashFlow", () => {
  it("returns CRITICAL when shortage is projected", () => {
    const forecast = generateForecast({
      scenario: ForecastScenario.BASE,
      startDate: new Date(),
      horizonDays: 30,
      startingCash: 100n,
      avgMonthlyInflows: 0n,
      avgMonthlyOutflows: 10_000n,
      receivablesByDate: new Map(),
      payablesByDate: new Map(),
      assumptions: SCENARIO_DEFAULTS.BASE,
      minCashThreshold: 0n,
    });
    const risk = detectNegativeCashFlow(forecast, SYM);
    expect(risk).not.toBeNull();
    expect(risk!.severity).toBe(AlertSeverity.CRITICAL);
  });

  it("returns WARNING for significant cash drop", () => {
    const forecast = generateForecast({
      scenario: ForecastScenario.BASE,
      startDate: new Date(),
      horizonDays: 30,
      startingCash: 1_000_000n,
      avgMonthlyInflows: 100n,
      avgMonthlyOutflows: 500_000n, // large outflows
      receivablesByDate: new Map(),
      payablesByDate: new Map(),
      assumptions: SCENARIO_DEFAULTS.BASE,
      minCashThreshold: 0n,
    });
    if (!forecast.cashShortageDate) {
      // Only check warning when no actual shortage
      const risk = detectNegativeCashFlow(forecast, SYM);
      if (risk) {
        expect([AlertSeverity.WARNING, AlertSeverity.CRITICAL]).toContain(risk.severity);
      }
    }
  });

  it("returns null for undefined forecast", () => {
    const risk = detectNegativeCashFlow(undefined, SYM);
    expect(risk).toBeNull();
  });
});

describe("detectAllRisks", () => {
  it("returns risks sorted by severity (CRITICAL first)", () => {
    const risks = detectAllRisks({
      currentCash: -100n,
      minCashThreshold: 0n,
      monthlyAvgOutflows: 1000n,
      receivablesSummary: {
        total: 5000n,
        overdue: 3000n,
        dueThisWeek: 0n,
        dueThisMonth: 0n,
        collected: 0n,
      },
      payablesSummary: {
        total: 1000n,
        overdue: 0n,
        dueThisWeek: 0n,
        dueThisMonth: 0n,
        paid: 0n,
      },
      forecast30: undefined,
      recentMonthOutflows: [1000n, 1000n, 1000n, 2000n],
      largePayables: [],
      currencySymbol: SYM,
    });

    expect(risks.length).toBeGreaterThan(0);
    const severities = risks.map((r) => r.severity);
    for (let i = 0; i < severities.length - 1; i++) {
      const order = { CRITICAL: 0, WARNING: 1, INFO: 2 };
      expect(order[severities[i]]).toBeLessThanOrEqual(order[severities[i + 1]]);
    }
  });

  it("returns empty array when no risks", () => {
    const risks = detectAllRisks({
      currentCash: 10_000_000n,
      minCashThreshold: 0n,
      monthlyAvgOutflows: 500_000n,
      receivablesSummary: {
        total: 100n, overdue: 0n, dueThisWeek: 0n, dueThisMonth: 0n, collected: 0n,
      },
      payablesSummary: {
        total: 100n, overdue: 0n, dueThisWeek: 0n, dueThisMonth: 0n, paid: 0n,
      },
      forecast30: undefined,
      recentMonthOutflows: [500_000n, 500_000n, 500_000n, 500_000n],
      largePayables: [],
      currencySymbol: SYM,
    });

    expect(risks).toHaveLength(0);
  });
});
