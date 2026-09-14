import { requireAuth } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { ReceivableStatus } from "@prisma/client";
import { formatCompact } from "@/lib/calculations";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { canWrite } from "@/lib/auth/guards";
import { ReceivableDialog } from "@/components/forms/receivable-dialog";
import { MarkPaidButton } from "@/components/forms/mark-paid-button";

interface PageProps {
  searchParams: { page?: string; status?: string; search?: string };
}

const PAGE_SIZE = 25;

export default async function ReceivablesPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const writeable = canWrite(user.role);
  const sym = user.companyCurrencySymbol;
  const now = new Date();
  const page = parseInt(searchParams.page ?? "1");

  const where: Record<string, unknown> = { companyId: user.companyId };
  if (searchParams.status) where.status = searchParams.status;
  if (searchParams.search) {
    where.OR = [
      { customerName: { contains: searchParams.search, mode: "insensitive" } },
      { description: { contains: searchParams.search, mode: "insensitive" } },
      { invoiceNumber: { contains: searchParams.search, mode: "insensitive" } },
    ];
  }

  const [receivables, total] = await Promise.all([
    prisma.receivable.findMany({
      where,
      orderBy: { dueDate: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.receivable.count({ where }),
  ]);

  // Summary stats (all, not filtered)
  const all = await prisma.receivable.findMany({
    where: { companyId: user.companyId, status: { notIn: [ReceivableStatus.CANCELLED] } },
  });
  const outstanding = all.filter((r) => r.status !== ReceivableStatus.PAID);
  const overdue = outstanding.filter((r) => r.dueDate < now);
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const dueThisWeek = outstanding.filter((r) => r.dueDate >= now && r.dueDate <= weekEnd);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Receivables</h1>
          <p className="text-sm text-muted-foreground">Customer invoices and expected inflows</p>
        </div>
        {writeable && (
          <ReceivableDialog>
            <Button size="sm"><Plus className="h-4 w-4" />New Invoice</Button>
          </ReceivableDialog>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className="text-lg font-bold tabular-nums">
            {formatCompact(outstanding.reduce((s, r) => s + r.amount - r.amountPaid, 0n), sym)}
          </p>
          <p className="text-xs text-muted-foreground">{outstanding.length} invoices</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground text-red-600">Overdue</p>
          <p className="text-lg font-bold tabular-nums text-red-600">
            {formatCompact(overdue.reduce((s, r) => s + r.amount - r.amountPaid, 0n), sym)}
          </p>
          <p className="text-xs text-muted-foreground">{overdue.length} invoices</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Due This Week</p>
          <p className="text-lg font-bold tabular-nums">
            {formatCompact(dueThisWeek.reduce((s, r) => s + r.amount - r.amountPaid, 0n), sym)}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Total Invoices</p>
          <p className="text-lg font-bold">{all.length}</p>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                {writeable && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {receivables.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    No receivables found. Create your first invoice.
                  </TableCell>
                </TableRow>
              ) : (
                receivables.map((r) => {
                  const isOverdue = r.status !== ReceivableStatus.PAID && r.dueDate < now;
                  const daysOverdue = isOverdue
                    ? Math.floor((now.getTime() - r.dueDate.getTime()) / 86400000)
                    : 0;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{r.customerName}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[180px]">{r.description}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.invoiceNumber ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className={`text-sm ${isOverdue ? "text-red-600 font-medium" : ""}`}>
                            {format(r.dueDate, "dd MMM yyyy")}
                          </p>
                          {isOverdue && (
                            <p className="text-xs text-red-500">{daysOverdue}d overdue</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <ReceivableStatusBadge status={isOverdue ? ReceivableStatus.OVERDUE : r.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <p className="text-sm font-semibold tabular-nums">
                          {formatCompact(r.amount - r.amountPaid, sym)}
                        </p>
                        {r.amountPaid > 0n && (
                          <p className="text-xs text-muted-foreground">
                            of {formatCompact(r.amount, sym)}
                          </p>
                        )}
                      </TableCell>
                      {writeable && (
                        <TableCell className="text-right">
                          {r.status !== ReceivableStatus.PAID && r.status !== ReceivableStatus.CANCELLED && (
                            <MarkPaidButton id={r.id} entity="receivable" />
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

function ReceivableStatusBadge({ status }: { status: ReceivableStatus }) {
  const map: Record<ReceivableStatus, { label: string; variant: "success" | "warning" | "critical" | "info" | "secondary" | "outline" }> = {
    PAID: { label: "Paid", variant: "success" },
    SENT: { label: "Sent", variant: "info" },
    DRAFT: { label: "Draft", variant: "secondary" },
    PARTIALLY_PAID: { label: "Partial", variant: "warning" },
    OVERDUE: { label: "Overdue", variant: "critical" },
    CANCELLED: { label: "Cancelled", variant: "outline" },
  };
  const { label, variant } = map[status];
  return <Badge variant={variant} className="text-xs">{label}</Badge>;
}
