import { requireAuth } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import {
  ForecastScenario,
  TransactionType,
  ReceivableStatus,
  PayableStatus,
} from "@prisma/client";
import { formatCompact, monthlyAverage } from "@/lib/calculations";
import { generateForecast, SCENARIO_DEFAULTS } from "@/lib/forecasting";
import { startOfDay, startOfMonth, subMonths, endOfMonth, format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ForecastChart } from "@/components/charts/forecast-chart";

export default async function ScenariosPage() {
  const user = await requireAuth();
  const now = new Date();
  const sym = user.companyCurrencySymbol;

  const [company, accounts, transactions, receivables, payables] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: user.companyId } }),
    prisma.financialAccount.findMany({ where: { companyId: user.companyId, isActive: true } }),
    prisma.transaction.findMany({
      where: {
        companyId: user.companyId,
        date: { gte: startOfMonth(subMonths(now, 5)), lte: endOfMonth(now) },
      },
    }),
    prisma.receivable.findMany({
      where: { companyId: user.companyId, status: { notIn: [ReceivableStatus.PAID, ReceivableStatus.CANCELLED] } },
    }),
    prisma.payable.findMany({
      where: { companyId: user.companyId, status: { notIn: [PayableStatus.PAID, PayableStatus.CANCELLED] } },
    }),
  ]);

  const currentCash = accounts.reduce((s, a) => s + a.balance, 0n);

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

  const scenarios = [ForecastScenario.BASE, ForecastScenario.OPTIMISTIC, ForecastScenario.PESSIMISTIC];
  const forecasts = scenarios.map((s) =>
    generateForecast({
      scenario: s,
      startDate: startOfDay(now),
      horizonDays: 90,
      startingCash: currentCash,
      avgMonthlyInflows,
      avgMonthlyOutflows,
      receivablesByDate,
      payablesByDate,
      assumptions: SCENARIO_DEFAULTS[s],
      minCashThreshold: company.minCashThreshold,
    })
  );

  const scenarioMeta = [
    { scenario: ForecastScenario.BASE, label: "Base", color: "#3b82f6", desc: "Historical averages, no adjustments" },
    { scenario: ForecastScenario.OPTIMISTIC, label: "Optimistic", color: "#22c55e", desc: "+10% revenue, -5% costs, faster collections" },
    { scenario: ForecastScenario.PESSIMISTIC, label: "Pessimistic", color: "#ef4444", desc: "-15% revenue, +10% costs, delayed collections" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Scenario Analysis</h1>
        <p className="text-sm text-muted-foreground">Compare Base, Optimistic, and Pessimistic projections over 90 days</p>
      </div>

      {/* Scenario comparison cards */}
      <div className="grid lg:grid-cols-3 gap-4">
        {forecasts.map((fc, i) => {
          const meta = scenarioMeta[i];
          const change = Number(fc.projectedEndingCash - currentCash) / 100;
          const changePct = currentCash !== 0n
            ? ((Number(fc.projectedEndingCash) - Number(currentCash)) / Number(currentCash)) * 100
            : 0;

          return (
            <Card key={meta.scenario} className="relative overflow-hidden">
              <div className="h-1 w-full absolute top-0" style={{ background: meta.color }} />
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm">{meta.label}</CardTitle>
                  {meta.scenario === ForecastScenario.BASE && (
                    <Badge variant="secondary" className="text-[10px]">Default</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{meta.desc}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">90-Day Ending Cash</p>
                  <p className="text-2xl font-bold tabular-nums" style={{ color: meta.color }}>
                    {formatCompact(fc.projectedEndingCash, sym)}
                  </p>
                  <p className={`text-xs ${changePct >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {changePct >= 0 ? "+" : ""}{changePct.toFixed(1)}% vs today
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Min Balance</p>
                    <p className="font-semibold text-sm tabular-nums">{formatCompact(fc.minProjectedBalance, sym)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Shortage</p>
                    <p className="font-semibold text-sm">
                      {fc.cashShortageDate
                        ? <span className="text-red-600">{format(fc.cashShortageDate, "dd MMM")}</span>
                        : <span className="text-green-600">None</span>
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts per scenario */}
      {forecasts.map((fc, i) => {
        const meta = scenarioMeta[i];
        const chartData = fc.items.map((item) => ({
          date: format(item.date, "MMM d"),
          balance: Number(item.closingBalance) / 100,
          inflows: Number(item.inflows) / 100,
          outflows: Number(item.outflows) / 100,
          threshold: Number(company.minCashThreshold) / 100,
        }));

        return (
          <Card key={meta.scenario}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{meta.label} Scenario — 90-Day Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <ForecastChart
                data={chartData}
                currencySymbol={sym}
                showThreshold={company.minCashThreshold > 0n}
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
