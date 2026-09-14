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
import { GenerateForecastButton } from "@/components/forecasting/generate-forecast-button";

export default async function ForecastPage() {
  const user = await requireAuth();
  const now = new Date();
  const periodStart = startOfMonth(subMonths(now, 5));
  const periodEnd = endOfMonth(now);
  const sym = user.companyCurrencySymbol;

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

  const forecast90 = generateForecast({
    scenario: ForecastScenario.BASE,
    startDate: startOfDay(now),
    horizonDays: 90,
    startingCash: currentCash,
    avgMonthlyInflows,
    avgMonthlyOutflows,
    receivablesByDate,
    payablesByDate,
    assumptions: SCENARIO_DEFAULTS.BASE,
    minCashThreshold: company.minCashThreshold,
  });

  const chartData = forecast90.items.map((item) => ({
    date: format(item.date, "MMM d"),
    balance: Number(item.closingBalance) / 100,
    inflows: Number(item.inflows) / 100,
    outflows: Number(item.outflows) / 100,
    threshold: Number(company.minCashThreshold) / 100,
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">90-Day Forecast</h1>
          <p className="text-sm text-muted-foreground">Base scenario projection</p>
        </div>
        <GenerateForecastButton />
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Starting Cash</p>
          <p className="text-lg font-bold tabular-nums">{formatCompact(currentCash, sym)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Projected Ending Cash (90d)</p>
          <p className={`text-lg font-bold tabular-nums ${forecast90.projectedEndingCash >= 0n ? "" : "text-red-600"}`}>
            {formatCompact(forecast90.projectedEndingCash, sym)}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Min Projected Balance</p>
          <p className={`text-lg font-bold tabular-nums ${forecast90.minProjectedBalance < company.minCashThreshold ? "text-red-600" : ""}`}>
            {formatCompact(forecast90.minProjectedBalance, sym)}
          </p>
          <p className="text-xs text-muted-foreground">{format(forecast90.minBalanceDate, "dd MMM")}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Cash Runway</p>
          <p className="text-lg font-bold">
            {forecast90.cashRunwayDays !== undefined
              ? `${forecast90.cashRunwayDays}d`
              : "90d+"}
          </p>
          {forecast90.cashShortageDate && (
            <Badge variant="critical" className="text-[10px] mt-0.5">
              Shortage {format(forecast90.cashShortageDate, "dd MMM")}
            </Badge>
          )}
        </Card>
      </div>

      {/* Forecast chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Projected Cash Balance — 90 Days</CardTitle>
            {company.minCashThreshold > 0n && (
              <p className="text-xs text-muted-foreground">
                Threshold: {formatCompact(company.minCashThreshold, sym)}
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ForecastChart data={chartData} currencySymbol={sym} showThreshold={company.minCashThreshold > 0n} />
        </CardContent>
      </Card>

      {/* Assumptions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Forecast Assumptions (Base Scenario)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Avg Monthly Inflow</p>
              <p className="font-semibold">{formatCompact(avgMonthlyInflows, sym)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg Monthly Outflow</p>
              <p className="font-semibold">{formatCompact(avgMonthlyOutflows, sym)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Known Receivables</p>
              <p className="font-semibold">
                {formatCompact(receivables.reduce((s, r) => s + r.amount - r.amountPaid, 0n), sym)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Known Payables</p>
              <p className="font-semibold">
                {formatCompact(payables.reduce((s, p) => s + p.amount - p.amountPaid, 0n), sym)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
