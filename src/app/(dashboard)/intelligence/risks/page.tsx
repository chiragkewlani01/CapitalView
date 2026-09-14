import { requireAuth } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import {
  ForecastScenario, TransactionType, ReceivableStatus, PayableStatus,
} from "@prisma/client";
import { formatCompact, monthlyAverage } from "@/lib/calculations";
import { generateForecast, SCENARIO_DEFAULTS } from "@/lib/forecasting";
import { detectAllRisks } from "@/lib/risk";
import { startOfDay, startOfMonth, subMonths, endOfMonth, format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { AlertSeverity } from "@prisma/client";

export default async function RisksPage() {
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

  const monthlyOutflowMap = new Map<string, bigint>();
  const monthlyInflowMap = new Map<string, bigint>();
  for (const t of transactions) {
    const key = format(t.date, "yyyy-MM");
    if (t.type === TransactionType.OUTFLOW) {
      monthlyOutflowMap.set(key, (monthlyOutflowMap.get(key) ?? 0n) + t.amount);
    } else {
      monthlyInflowMap.set(key, (monthlyInflowMap.get(key) ?? 0n) + t.amount);
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

  const outstanding = receivables.filter((r) => r.status !== ReceivableStatus.PAID);
  const overdueR = outstanding.filter((r) => r.dueDate < now);
  const overduePay = payables.filter((p) => p.status !== PayableStatus.PAID && p.dueDate < now);

  const largePayables = payables
    .filter((p) => p.status !== PayableStatus.PAID && p.status !== PayableStatus.CANCELLED)
    .sort((a, b) => (b.amount > a.amount ? 1 : -1))
    .slice(0, 3)
    .map((p) => ({ id: p.id, description: p.description, amount: p.amount - p.amountPaid, dueDate: p.dueDate }));

  const risks = detectAllRisks({
    currentCash,
    minCashThreshold: company.minCashThreshold,
    monthlyAvgOutflows: avgMonthlyOutflows,
    receivablesSummary: {
      total: outstanding.reduce((s, r) => s + r.amount - r.amountPaid, 0n),
      overdue: overdueR.reduce((s, r) => s + r.amount - r.amountPaid, 0n),
      dueThisWeek: 0n,
      dueThisMonth: 0n,
      collected: 0n,
    },
    payablesSummary: {
      total: payables.reduce((s, p) => s + p.amount - p.amountPaid, 0n),
      overdue: overduePay.reduce((s, p) => s + p.amount - p.amountPaid, 0n),
      dueThisWeek: 0n,
      dueThisMonth: 0n,
      paid: 0n,
    },
    forecast30,
    recentMonthOutflows: [...monthlyOutflowMap.values()].slice(-4),
    largePayables,
    currencySymbol: sym,
  });

  const criticalRisks = risks.filter((r) => r.severity === AlertSeverity.CRITICAL);
  const warningRisks = risks.filter((r) => r.severity === AlertSeverity.WARNING);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Risk Analysis</h1>
        <p className="text-sm text-muted-foreground">Deterministic financial risk detection</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Total Risks</p>
          <p className="text-lg font-bold">{risks.length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground text-red-600">Critical</p>
          <p className="text-lg font-bold text-red-600">{criticalRisks.length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground text-amber-600">Warnings</p>
          <p className="text-lg font-bold text-amber-600">{warningRisks.length}</p>
        </Card>
      </div>

      {risks.length === 0 ? (
        <Card className="p-10 flex flex-col items-center gap-3">
          <ShieldCheck className="h-12 w-12 text-green-500" />
          <div className="text-center">
            <p className="font-semibold text-lg">No active risks detected</p>
            <p className="text-sm text-muted-foreground mt-1">Your cash position appears healthy based on current data.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {risks.map((risk, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-start gap-3">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                  risk.severity === AlertSeverity.CRITICAL
                    ? "bg-red-100 text-red-600"
                    : risk.severity === AlertSeverity.WARNING
                    ? "bg-amber-100 text-amber-600"
                    : "bg-blue-100 text-blue-600"
                }`}>
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-sm">{risk.title}</p>
                    <Badge
                      variant={
                        risk.severity === AlertSeverity.CRITICAL ? "critical"
                          : risk.severity === AlertSeverity.WARNING ? "warning"
                          : "info"
                      }
                      className="text-[10px]"
                    >
                      {risk.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{risk.description}</p>
                  {risk.amount !== undefined && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Amount: <span className="font-medium">{formatCompact(risk.amount, sym)}</span>
                    </p>
                  )}
                  {risk.date && (
                    <p className="text-xs text-muted-foreground">
                      Date: <span className="font-medium">{format(risk.date, "dd MMM yyyy")}</span>
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
