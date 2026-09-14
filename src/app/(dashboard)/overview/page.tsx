import { requireAuth } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import {
  TransactionType,
  ReceivableStatus,
  PayableStatus,
  AlertStatus,
  ForecastScenario,
} from "@prisma/client";
import {
  formatCurrency,
  formatCompact,
  monthlyAverage,
  calculateCashRunway,
} from "@/lib/calculations";
import { generateForecast, SCENARIO_DEFAULTS } from "@/lib/forecasting";
import { detectAllRisks } from "@/lib/risk";
import { startOfMonth, subMonths, endOfMonth, format, startOfDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { AlertSeverity } from "@prisma/client";

export default async function OverviewPage() {
  const user = await requireAuth();
  const now = new Date();
  const periodEnd = endOfMonth(now);
  const periodStart = startOfMonth(subMonths(now, 5));
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [company, accounts, transactions, receivables, payables, alerts] =
    await Promise.all([
      prisma.company.findUniqueOrThrow({ where: { id: user.companyId } }),
      prisma.financialAccount.findMany({
        where: { companyId: user.companyId, isActive: true },
      }),
      prisma.transaction.findMany({
        where: {
          companyId: user.companyId,
          date: { gte: periodStart, lte: periodEnd },
        },
        include: { category: true },
        orderBy: { date: "asc" },
      }),
      prisma.receivable.findMany({
        where: {
          companyId: user.companyId,
          status: { notIn: [ReceivableStatus.CANCELLED] },
        },
      }),
      prisma.payable.findMany({
        where: {
          companyId: user.companyId,
          status: { notIn: [PayableStatus.CANCELLED] },
        },
      }),
      prisma.alert.findMany({
        where: { companyId: user.companyId, status: AlertStatus.ACTIVE },
        orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
        take: 5,
      }),
    ]);

  const sym = company.currencySymbol;
  const currentCash = accounts.reduce((s, a) => s + a.balance, 0n);

  // Monthly cash flow breakdown
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

  // Current month
  const thisMonthKey = format(now, "yyyy-MM");
  const thisMonthInflows = monthlyInflowMap.get(thisMonthKey) ?? 0n;
  const thisMonthOutflows = monthlyOutflowMap.get(thisMonthKey) ?? 0n;

  // Receivable/Payable summaries
  const outstandingReceivables = receivables.filter(
    (r) => r.status !== ReceivableStatus.PAID
  );
  const overdueReceivables = outstandingReceivables.filter(
    (r) => r.dueDate < now
  );
  const totalReceivable = outstandingReceivables.reduce(
    (s, r) => s + r.amount - r.amountPaid,
    0n
  );
  const overdueReceivable = overdueReceivables.reduce(
    (s, r) => s + r.amount - r.amountPaid,
    0n
  );

  const outstandingPayables = payables.filter(
    (p) => p.status !== PayableStatus.PAID
  );
  const totalPayable = outstandingPayables.reduce(
    (s, p) => s + p.amount - p.amountPaid,
    0n
  );
  const dueThisWeekPayable = outstandingPayables
    .filter((p) => p.dueDate >= now && p.dueDate <= weekEnd)
    .reduce((s, p) => s + p.amount - p.amountPaid, 0n);

  // Forecast
  const receivablesByDate = new Map<string, bigint>();
  for (const r of outstandingReceivables) {
    const key = format(r.dueDate, "yyyy-MM-dd");
    receivablesByDate.set(
      key,
      (receivablesByDate.get(key) ?? 0n) + r.amount - r.amountPaid
    );
  }
  const payablesByDate = new Map<string, bigint>();
  for (const p of outstandingPayables) {
    const key = format(p.dueDate, "yyyy-MM-dd");
    payablesByDate.set(
      key,
      (payablesByDate.get(key) ?? 0n) + p.amount - p.amountPaid
    );
  }

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

  // Cash runway
  const cashRunwayDays = calculateCashRunway(currentCash, avgMonthlyOutflows);

  // Risk detection
  const recentMonthOutflows = [...monthlyOutflowMap.values()].slice(-4);
  const largePayables = outstandingPayables
    .sort((a, b) => (b.amount > a.amount ? 1 : -1))
    .slice(0, 3)
    .map((p) => ({
      id: p.id,
      description: p.description,
      amount: p.amount - p.amountPaid,
      dueDate: p.dueDate,
    }));

  const risks = detectAllRisks({
    currentCash,
    minCashThreshold: company.minCashThreshold,
    monthlyAvgOutflows: avgMonthlyOutflows,
    receivablesSummary: {
      total: totalReceivable,
      overdue: overdueReceivable,
      dueThisWeek: 0n,
      dueThisMonth: 0n,
      collected: 0n,
    },
    payablesSummary: {
      total: totalPayable,
      overdue: 0n,
      dueThisWeek: dueThisWeekPayable,
      dueThisMonth: 0n,
      paid: 0n,
    },
    forecast30,
    recentMonthOutflows,
    largePayables,
    currencySymbol: sym,
  });

  // Cash health
  const cashHealth =
    risks.some((r) => r.severity === "CRITICAL")
      ? "critical"
      : risks.some((r) => r.severity === "WARNING")
      ? "watch"
      : "healthy";

  // Build chart data (last 6 months actual + 30-day forecast)
  const chartMonths: string[] = [];
  for (let i = 5; i >= 0; i--) {
    chartMonths.push(format(subMonths(now, i), "yyyy-MM"));
  }

  let runningBalance = currentCash;
  // Approximate starting balance by unwinding current month
  const monthlyNetFlows = chartMonths.map((m) => {
    const inflow = monthlyInflowMap.get(m) ?? 0n;
    const outflow = monthlyOutflowMap.get(m) ?? 0n;
    return { month: m, inflow, outflow, net: inflow - outflow };
  });

  // Reconstruct opening balance for first month
  const totalNet = monthlyNetFlows.reduce((s, m) => s + m.net, 0n);
  let openBal = currentCash - totalNet;

  const historicalChartData = monthlyNetFlows.map((m) => {
    const label = format(new Date(m.month + "-01"), "MMM yy");
    const data = {
      label,
      inflow: Number(m.inflow) / 100,
      outflow: Number(m.outflow) / 100,
      balance: Number(openBal + m.net) / 100,
    };
    openBal = openBal + m.net;
    return data;
  });

  // Recent transactions
  const recentTx = await prisma.transaction.findMany({
    where: { companyId: user.companyId },
    include: { category: true, account: true },
    orderBy: { date: "desc" },
    take: 8,
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Overview</h1>
          <p className="text-sm text-muted-foreground">
            {company.name} · {format(now, "MMMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              cashHealth === "healthy"
                ? "success"
                : cashHealth === "watch"
                ? "warning"
                : "critical"
            }
            className="capitalize text-xs px-2.5 py-1"
          >
            {cashHealth === "healthy"
              ? "Cash Healthy"
              : cashHealth === "watch"
              ? "Watch"
              : "Critical"}
          </Badge>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard
          title="Current Cash"
          value={formatCompact(currentCash, sym)}
          sub={`${accounts.length} account${accounts.length !== 1 ? "s" : ""}`}
          icon={<Zap className="h-4 w-4" />}
          accent="blue"
        />
        <KpiCard
          title="Expected Inflow"
          value={formatCompact(totalReceivable, sym)}
          sub={`${outstandingReceivables.length} invoices`}
          icon={<ArrowUpRight className="h-4 w-4" />}
          accent="green"
        />
        <KpiCard
          title="Expected Outflow"
          value={formatCompact(totalPayable, sym)}
          sub={`${outstandingPayables.length} bills`}
          icon={<ArrowDownRight className="h-4 w-4" />}
          accent="red"
        />
        <KpiCard
          title="30-Day Forecast"
          value={formatCompact(forecast30.projectedEndingCash, sym)}
          sub={
            forecast30.cashShortageDate
              ? "⚠ Shortage projected"
              : "No shortage"
          }
          icon={<TrendingUp className="h-4 w-4" />}
          accent={forecast30.cashShortageDate ? "red" : "green"}
        />
        <KpiCard
          title="Cash Runway"
          value={
            cashRunwayDays === Infinity
              ? "∞"
              : `${Math.round(cashRunwayDays)}d`
          }
          sub="at current burn rate"
          icon={<Clock className="h-4 w-4" />}
          accent={cashRunwayDays < 60 ? "red" : cashRunwayDays < 90 ? "amber" : "green"}
        />
      </div>

      {/* Main content grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Cash flow chart */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Cash Flow — Last 6 Months</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CashFlowChart data={historicalChartData} currencySymbol={sym} />
            </CardContent>
          </Card>
        </div>

        {/* Risks */}
        <div>
          <Card className="h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Active Risks</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs h-7" asChild>
                  <Link href="/intelligence/risks">View all</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {risks.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center mb-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <p className="text-sm font-medium">No active risks</p>
                  <p className="text-xs text-muted-foreground">Your cash position looks healthy.</p>
                </div>
              ) : (
                risks.slice(0, 4).map((risk, i) => (
                  <div key={i} className="flex items-start gap-2.5 rounded-md border p-2.5">
                    <AlertTriangle
                      className={`h-4 w-4 mt-0.5 shrink-0 ${
                        risk.severity === AlertSeverity.CRITICAL
                          ? "text-red-500"
                          : risk.severity === AlertSeverity.WARNING
                          ? "text-amber-500"
                          : "text-blue-500"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium leading-tight">{risk.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {risk.description}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Overdue receivables */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Overdue Receivables</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs h-7" asChild>
                <Link href="/financials/receivables">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {overdueReceivables.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No overdue receivables</p>
            ) : (
              <div className="space-y-2">
                {overdueReceivables.slice(0, 4).map((r) => {
                  const days = Math.floor((now.getTime() - r.dueDate.getTime()) / 86400000);
                  return (
                    <div key={r.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                      <div className="min-w-0 mr-4">
                        <p className="font-medium truncate">{r.customerName}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold tabular-nums">
                          {formatCompact(r.amount - r.amountPaid, sym)}
                        </p>
                        <p className="text-xs text-red-500">{days}d overdue</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent transactions */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Recent Transactions</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs h-7" asChild>
                <Link href="/financials/transactions">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentTx.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No transactions yet</p>
            ) : (
              <div className="space-y-0">
                {recentTx.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-2.5 min-w-0 mr-4">
                      <div
                        className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                          t.type === TransactionType.INFLOW
                            ? "bg-green-100"
                            : "bg-red-100"
                        }`}
                      >
                        {t.type === TransactionType.INFLOW ? (
                          <ArrowUpRight className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <ArrowDownRight className="h-3.5 w-3.5 text-red-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{t.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(t.date, "MMM d")} · {t.category?.name ?? "Uncategorized"}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-sm font-semibold tabular-nums shrink-0 ${
                        t.type === TransactionType.INFLOW ? "text-green-600" : "text-foreground"
                      }`}
                    >
                      {t.type === TransactionType.INFLOW ? "+" : "-"}
                      {formatCompact(t.amount, sym)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  sub,
  icon,
  accent,
}: {
  title: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  accent: "blue" | "green" | "red" | "amber";
}) {
  const accentClasses = {
    blue: "text-blue-600 bg-blue-50",
    green: "text-green-600 bg-green-50",
    red: "text-red-600 bg-red-50",
    amber: "text-amber-600 bg-amber-50",
  };
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-muted-foreground font-medium">{title}</p>
        <div className={`h-6 w-6 rounded-md flex items-center justify-center ${accentClasses[accent]}`}>
          {icon}
        </div>
      </div>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>
    </Card>
  );
}
