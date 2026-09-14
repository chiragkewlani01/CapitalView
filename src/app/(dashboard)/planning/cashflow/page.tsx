import { requireAuth } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { TransactionType } from "@prisma/client";
import { formatCompact } from "@/lib/calculations";
import { format, startOfMonth, subMonths, endOfMonth } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";

export default async function CashFlowPage() {
  const user = await requireAuth();
  const now = new Date();
  const sym = user.companyCurrencySymbol;

  // Get 12 months of data
  const periodStart = startOfMonth(subMonths(now, 11));
  const periodEnd = endOfMonth(now);

  const [accounts, transactions] = await Promise.all([
    prisma.financialAccount.findMany({ where: { companyId: user.companyId, isActive: true } }),
    prisma.transaction.findMany({
      where: { companyId: user.companyId, date: { gte: periodStart, lte: periodEnd } },
      orderBy: { date: "asc" },
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

  // Build 12-month timeline
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    months.push(format(subMonths(now, i), "yyyy-MM"));
  }

  // Reconstruct monthly closing balances
  const totalNet = months.reduce((s, m) => {
    const inflow = monthlyInflowMap.get(m) ?? 0n;
    const outflow = monthlyOutflowMap.get(m) ?? 0n;
    return s + inflow - outflow;
  }, 0n);
  let openBal = currentCash - totalNet;

  const monthlyData = months.map((m) => {
    const inflow = monthlyInflowMap.get(m) ?? 0n;
    const outflow = monthlyOutflowMap.get(m) ?? 0n;
    const closingBal = openBal + inflow - outflow;
    const data = {
      label: format(new Date(m + "-01"), "MMM yy"),
      inflow: Number(inflow) / 100,
      outflow: Number(outflow) / 100,
      balance: Number(closingBal) / 100,
      net: Number(inflow - outflow) / 100,
    };
    openBal = closingBal;
    return data;
  });

  const totalInflows = [...monthlyInflowMap.values()].reduce((s, v) => s + v, 0n);
  const totalOutflows = [...monthlyOutflowMap.values()].reduce((s, v) => s + v, 0n);
  const bestMonth = monthlyData.reduce((best, m) => (m.net > best.net ? m : best), monthlyData[0]);
  const worstMonth = monthlyData.reduce((worst, m) => (m.net < worst.net ? m : worst), monthlyData[0]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Cash Flow Analytics</h1>
        <p className="text-sm text-muted-foreground">12-month historical overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Total Inflows (12m)</p>
          <p className="text-lg font-bold text-green-600 tabular-nums">{formatCompact(totalInflows, sym)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Total Outflows (12m)</p>
          <p className="text-lg font-bold tabular-nums">{formatCompact(totalOutflows, sym)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Best Month</p>
          <p className="text-lg font-bold text-green-600 tabular-nums">+{sym}{bestMonth?.net.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-muted-foreground">{bestMonth?.label}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Worst Month</p>
          <p className="text-lg font-bold text-red-600 tabular-nums">{sym}{worstMonth?.net.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-muted-foreground">{worstMonth?.label}</p>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Monthly Cash Flow — 12 Months</CardTitle>
        </CardHeader>
        <CardContent>
          <CashFlowChart data={monthlyData} currencySymbol={sym} />
        </CardContent>
      </Card>

      {/* Monthly detail table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Monthly Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Month</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Inflows</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Outflows</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Net</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Closing Balance</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((m) => (
                <tr key={m.label} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{m.label}</td>
                  <td className="px-4 py-2.5 text-right text-green-600 tabular-nums">
                    {sym}{m.inflow.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {sym}{m.outflow.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-medium tabular-nums ${m.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {m.net >= 0 ? "+" : ""}{sym}{m.net.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {sym}{m.balance.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
