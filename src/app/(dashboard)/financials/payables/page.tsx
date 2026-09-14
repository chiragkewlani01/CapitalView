import { requireAuth } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { PayableStatus } from "@prisma/client";
import { formatCompact } from "@/lib/calculations";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { canWrite } from "@/lib/auth/guards";
import { PayableDialog } from "@/components/forms/payable-dialog";
import { MarkPaidButton } from "@/components/forms/mark-paid-button";

export default async function PayablesPage() {
  const user = await requireAuth();
  const writeable = canWrite(user.role);
  const sym = user.companyCurrencySymbol;
  const now = new Date();

  const payables = await prisma.payable.findMany({
    where: { companyId: user.companyId },
    orderBy: { dueDate: "asc" },
  });

  const outstanding = payables.filter((p) => p.status !== PayableStatus.PAID && p.status !== PayableStatus.CANCELLED);
  const overdue = outstanding.filter((p) => p.dueDate < now);
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const dueThisWeek = outstanding.filter((p) => p.dueDate >= now && p.dueDate <= weekEnd);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Payables</h1>
          <p className="text-sm text-muted-foreground">Vendor bills and upcoming obligations</p>
        </div>
        {writeable && (
          <PayableDialog>
            <Button size="sm"><Plus className="h-4 w-4" />New Bill</Button>
          </PayableDialog>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className="text-lg font-bold tabular-nums">
            {formatCompact(outstanding.reduce((s, p) => s + p.amount - p.amountPaid, 0n), sym)}
          </p>
          <p className="text-xs text-muted-foreground">{outstanding.length} bills</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground text-red-600">Overdue</p>
          <p className="text-lg font-bold tabular-nums text-red-600">
            {formatCompact(overdue.reduce((s, p) => s + p.amount - p.amountPaid, 0n), sym)}
          </p>
          <p className="text-xs text-muted-foreground">{overdue.length} bills</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Due This Week</p>
          <p className="text-lg font-bold tabular-nums">
            {formatCompact(dueThisWeek.reduce((s, p) => s + p.amount - p.amountPaid, 0n), sym)}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Total Bills</p>
          <p className="text-lg font-bold">{payables.length}</p>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Bill #</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                {writeable && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {payables.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    No payables found. Create your first bill.
                  </TableCell>
                </TableRow>
              ) : (
                payables.map((p) => {
                  const isOverdue = p.status !== PayableStatus.PAID && p.dueDate < now;
                  const daysOverdue = isOverdue
                    ? Math.floor((now.getTime() - p.dueDate.getTime()) / 86400000)
                    : 0;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{p.vendorName}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[180px]">{p.description}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.billNumber ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className={`text-sm ${isOverdue ? "text-red-600 font-medium" : ""}`}>
                            {format(p.dueDate, "dd MMM yyyy")}
                          </p>
                          {isOverdue && <p className="text-xs text-red-500">{daysOverdue}d overdue</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <PayableStatusBadge status={isOverdue ? PayableStatus.OVERDUE : p.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <p className="text-sm font-semibold tabular-nums">
                          {formatCompact(p.amount - p.amountPaid, sym)}
                        </p>
                      </TableCell>
                      {writeable && (
                        <TableCell className="text-right">
                          {p.status !== PayableStatus.PAID && p.status !== PayableStatus.CANCELLED && (
                            <MarkPaidButton id={p.id} entity="payable" />
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function PayableStatusBadge({ status }: { status: PayableStatus }) {
  const map: Record<PayableStatus, { label: string; variant: "success" | "warning" | "critical" | "info" | "secondary" | "outline" }> = {
    PAID: { label: "Paid", variant: "success" },
    APPROVED: { label: "Approved", variant: "info" },
    DRAFT: { label: "Draft", variant: "secondary" },
    PARTIALLY_PAID: { label: "Partial", variant: "warning" },
    OVERDUE: { label: "Overdue", variant: "critical" },
    CANCELLED: { label: "Cancelled", variant: "outline" },
  };
  const { label, variant } = map[status];
  return <Badge variant={variant} className="text-xs">{label}</Badge>;
}
