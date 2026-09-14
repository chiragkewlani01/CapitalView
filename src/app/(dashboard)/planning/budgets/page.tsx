import { requireAuth } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { formatCompact } from "@/lib/calculations";
import { getBudgetsWithActualAction } from "@/actions/budgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { canWrite } from "@/lib/auth/guards";
import { BudgetDialog } from "@/components/forms/budget-dialog";
import { cn } from "@/lib/utils";

export default async function BudgetsPage() {
  const user = await requireAuth();
  const writeable = canWrite(user.role);
  const sym = user.companyCurrencySymbol;
  const now = new Date();

  const [budgets, categories] = await Promise.all([
    getBudgetsWithActualAction(now.getFullYear(), now.getMonth() + 1),
    prisma.category.findMany({
      where: { companyId: user.companyId },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalBudgeted = budgets.reduce((s, b) => s + b.budgetedAmount, 0n);
  const totalActual = budgets.reduce((s, b) => s + b.actualAmount, 0n);
  const overBudget = budgets.filter((b) => b.variance > 0n);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Budgets</h1>
          <p className="text-sm text-muted-foreground">
            {now.toLocaleString("en-IN", { month: "long", year: "numeric" })} budget vs actual
          </p>
        </div>
        {writeable && (
          <BudgetDialog categories={categories} year={now.getFullYear()} month={now.getMonth() + 1}>
            <Button size="sm"><Plus className="h-4 w-4" />New Budget</Button>
          </BudgetDialog>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Total Budgeted</p>
          <p className="text-lg font-bold tabular-nums">{formatCompact(totalBudgeted, sym)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Total Actual</p>
          <p className={`text-lg font-bold tabular-nums ${totalActual > totalBudgeted ? "text-red-600" : ""}`}>
            {formatCompact(totalActual, sym)}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Over Budget</p>
          <p className="text-lg font-bold">{overBudget.length} categories</p>
        </Card>
      </div>

      {budgets.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground text-sm">No budgets set for this month.</p>
          {writeable && (
            <BudgetDialog categories={categories} year={now.getFullYear()} month={now.getMonth() + 1}>
              <Button className="mt-4" size="sm"><Plus className="h-4 w-4" />Create first budget</Button>
            </BudgetDialog>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {budgets.map((b) => {
            const usedPct = b.budgetedAmount > 0n
              ? Math.min(100, (Number(b.actualAmount) / Number(b.budgetedAmount)) * 100)
              : 0;
            const isOver = b.variance > 0n;
            const isWarn = usedPct > 80 && !isOver;

            return (
              <Card key={b.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ background: b.categoryColor ?? "#9ca3af" }}
                    />
                    <span className="text-sm font-medium">{b.categoryName}</span>
                    {isOver && <Badge variant="critical" className="text-[10px]">Over budget</Badge>}
                    {isWarn && <Badge variant="warning" className="text-[10px]">Near limit</Badge>}
                  </div>
                  <div className="text-right text-sm">
                    <span className={cn("font-semibold tabular-nums", isOver ? "text-red-600" : "")}>
                      {formatCompact(b.actualAmount, sym)}
                    </span>
                    <span className="text-muted-foreground"> / {formatCompact(b.budgetedAmount, sym)}</span>
                  </div>
                </div>
                <Progress
                  value={usedPct}
                  className={cn("h-1.5", isOver ? "[&>*]:bg-red-500" : isWarn ? "[&>*]:bg-amber-500" : "")}
                />
                <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                  <span>{usedPct.toFixed(0)}% used</span>
                  <span className={isOver ? "text-red-600 font-medium" : "text-green-600"}>
                    {isOver ? "+" : "-"}
                    {formatCompact(isOver ? b.variance : -b.variance, sym)} {isOver ? "over" : "remaining"}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
