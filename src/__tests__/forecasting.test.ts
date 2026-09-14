import { describe, it, expect } from "vitest";
import { generateForecast, SCENARIO_DEFAULTS } from "@/lib/forecasting";
import { ForecastScenario } from "@prisma/client";

const BASE_INPUT = {
  scenario: ForecastScenario.BASE,
  startDate: new Date("2024-01-01"),
  horizonDays: 30,
  startingCash: 5_000_000n, // ₹50,000
  avgMonthlyInflows: 2_000_000n, // ₹20,000/month
  avgMonthlyOutflows: 1_500_000n, // ₹15,000/month
  receivablesByDate: new Map<string, bigint>(),
  payablesByDate: new Map<string, bigint>(),
  assumptions: SCENARIO_DEFAULTS.BASE,
  minCashThreshold: 1_000_000n,
};

describe("generateForecast", () => {
  it("returns correct number of forecast items", () => {
    const result = generateForecast(BASE_INPUT);
    expect(result.items).toHaveLength(30);
  });

  it("starts from starting cash", () => {
    const result = generateForecast(BASE_INPUT);
    expect(result.startingCash).toBe(5_000_000n);
    expect(result.items[0].openingBalance).toBe(5_000_000n);
  });

  it("projects positive ending cash when inflows exceed outflows", () => {
    const result = generateForecast(BASE_INPUT);
    expect(result.projectedEndingCash).toBeGreaterThan(BASE_INPUT.startingCash);
  });

  it("detects cash shortage when outflows exceed cash", () => {
    const input = {
      ...BASE_INPUT,
      startingCash: 500_000n, // Very low cash
      avgMonthlyInflows: 100_000n,
      avgMonthlyOutflows: 5_000_000n, // Much higher outflows
    };
    const result = generateForecast(input);
    expect(result.cashShortageDate).toBeDefined();
    expect(result.cashShortageAmount).toBeDefined();
    expect(result.cashRunwayDays).toBeDefined();
    expect(result.cashRunwayDays!).toBeLessThan(30);
  });

  it("marks shortage periods correctly", () => {
    const input = {
      ...BASE_INPUT,
      startingCash: 500_000n,
      avgMonthlyInflows: 0n,
      avgMonthlyOutflows: 5_000_000n,
      minCashThreshold: 1_000_000n,
    };
    const result = generateForecast(input);
    const shortageItems = result.items.filter((item) => item.isShortagePeriod);
    expect(shortageItems.length).toBeGreaterThan(0);
  });

  it("includes known receivables in forecast", () => {
    const receivablesByDate = new Map([["2024-01-10", 500_000n]]);
    const input = { ...BASE_INPUT, receivablesByDate };
    const result = generateForecast(input);

    // Day 9 (index 9 = Jan 10) should have higher inflows
    const jan10Item = result.items.find(
      (item) => item.date.toISOString().startsWith("2024-01-10")
    );
    expect(jan10Item).toBeDefined();
    expect(jan10Item!.inflows).toBeGreaterThan(0n);
  });

  it("includes known payables in forecast", () => {
    const payablesByDate = new Map([["2024-01-15", 1_000_000n]]);
    const input = { ...BASE_INPUT, payablesByDate };
    const result = generateForecast(input);

    const jan15Item = result.items.find(
      (item) => item.date.toISOString().startsWith("2024-01-15")
    );
    expect(jan15Item).toBeDefined();
    expect(jan15Item!.outflows).toBeGreaterThan(0n);
  });

  it("applies optimistic assumptions correctly", () => {
    const baseResult = generateForecast({
      ...BASE_INPUT,
      assumptions: SCENARIO_DEFAULTS.BASE,
      scenario: ForecastScenario.BASE,
    });
    const optimisticResult = generateForecast({
      ...BASE_INPUT,
      assumptions: SCENARIO_DEFAULTS.OPTIMISTIC,
      scenario: ForecastScenario.OPTIMISTIC,
    });
    // Optimistic should have higher ending cash
    expect(optimisticResult.projectedEndingCash).toBeGreaterThan(baseResult.projectedEndingCash);
  });

  it("applies pessimistic assumptions correctly", () => {
    const baseResult = generateForecast({
      ...BASE_INPUT,
      assumptions: SCENARIO_DEFAULTS.BASE,
      scenario: ForecastScenario.BASE,
    });
    const pessimisticResult = generateForecast({
      ...BASE_INPUT,
      assumptions: SCENARIO_DEFAULTS.PESSIMISTIC,
      scenario: ForecastScenario.PESSIMISTIC,
    });
    // Pessimistic should have lower ending cash
    expect(pessimisticResult.projectedEndingCash).toBeLessThan(baseResult.projectedEndingCash);
  });

  it("handles zero starting cash", () => {
    const input = { ...BASE_INPUT, startingCash: 0n };
    const result = generateForecast(input);
    expect(result.startingCash).toBe(0n);
    expect(result.items[0].openingBalance).toBe(0n);
  });

  it("handles 90-day horizon", () => {
    const input = { ...BASE_INPUT, horizonDays: 90 };
    const result = generateForecast(input);
    expect(result.items).toHaveLength(90);
  });

  it("minimum balance date corresponds to minimum balance", () => {
    const input = {
      ...BASE_INPUT,
      startingCash: 1_000_000n,
      avgMonthlyInflows: 0n,
      avgMonthlyOutflows: 2_000_000n,
    };
    const result = generateForecast(input);
    const actualMin = result.items.reduce(
      (min, item) => (item.closingBalance < min ? item.closingBalance : min),
      result.items[0].closingBalance
    );
    expect(result.minProjectedBalance).toBe(actualMin);
  });
});
