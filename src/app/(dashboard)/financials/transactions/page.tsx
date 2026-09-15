import { requireAuth } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { formatCompact } from "@/lib/calculations";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowUpRight, ArrowDownRight, Plus } from "lucide-react";
import { TransactionDialog } from "@/components/transactions/transaction-dialog";
import { CsvImportDialog } from "@/components/transactions/csv-import-dialog";
import { TransactionFiltersBar } from "@/components/transactions/transaction-filters";
import { Pagination } from "@/components/ui/pagination-bar";
import { canWrite } from "@/lib/auth/guards";

interface PageProps {
  searchParams: {
    page?: string;
    search?: string;
    type?: string;
    categoryId?: string;
    accountId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

const PAGE_SIZE = 25;

export default async function TransactionsPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const writeable = canWrite(user.role);

  const page = parseInt(searchParams.page ?? "1");
  const { search, type, categoryId, accountId, status, dateFrom, dateTo } = searchParams;

  const where: Record<string, unknown> = { companyId: user.companyId };

  if (search) {
    where.OR = [
      { description: { contains: search, mode: "insensitive" } },
      { reference: { contains: search, mode: "insensitive" } },
    ];
  }
  if (type && (type === "INFLOW" || type === "OUTFLOW")) where.type = type;
  if (categoryId) where.categoryId = categoryId;
  if (accountId) where.accountId = accountId;
  if (status) where.status = status;
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) (where.date as Record<string, unknown>).gte = new Date(dateFrom);
    if (dateTo) (where.date as Record<string, unknown>).lte = new Date(dateTo + "T23:59:59");
  }

  const [transactions, total, accounts, categories] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, color: true } },
        account: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.transaction.count({ where }),
    prisma.financialAccount.findMany({
      where: { companyId: user.companyId, isActive: true },
      select: { id: true, name: true },
    }),
    prisma.category.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.transaction.aggregate({
      where,
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const inflowTotal = await prisma.transaction.aggregate({
    where: { ...where, type: TransactionType.INFLOW },
    _sum: { amount: true },
  });
  const outflowTotal = await prisma.transaction.aggregate({
    where: { ...where, type: TransactionType.OUTFLOW },
    _sum: { amount: true },
  });

  const sym = user.companyCurrencySymbol;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString()} transaction{total !== 1 ? "s" : ""}
          </p>
        </div>
        {writeable && (
          <div className="flex gap-2">
            <CsvImportDialog accounts={accounts} />
            <TransactionDialog accounts={accounts} categories={categories}>
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </TransactionDialog>
          </div>
        )}
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Total Inflows</p>
          <p className="text-lg font-bold text-green-600 tabular-nums">
            {formatCompact(inflowTotal._sum.amount ?? 0n, sym)}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Total Outflows</p>
          <p className="text-lg font-bold tabular-nums">
            {formatCompact(outflowTotal._sum.amount ?? 0n, sym)}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Net</p>
          <p className={`text-lg font-bold tabular-nums ${
            (inflowTotal._sum.amount ?? 0n) >= (outflowTotal._sum.amount ?? 0n)
              ? "text-green-600"
              : "text-red-600"
          }`}>
            {formatCompact(
              (inflowTotal._sum.amount ?? 0n) - (outflowTotal._sum.amount ?? 0n),
              sym
            )}
          </p>
        </Card>
      </div>

      {/* Filters */}
      <TransactionFiltersBar
        accounts={accounts}
        categories={categories}
        currentFilters={searchParams}
      />

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    No transactions found. Add one or import from CSV.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm tabular-nums whitespace-nowrap">
                      {format(t.date, "dd MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{t.description}</p>
                        {t.reference && (
                          <p className="text-xs text-muted-foreground">{t.reference}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {t.category ? (
                        <Badge variant="outline" className="text-xs gap-1">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: t.category.color ?? "#9ca3af" }}
                          />
                          {t.category.name}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t.account.name}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={t.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {t.type === TransactionType.INFLOW ? (
                          <ArrowUpRight className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <ArrowDownRight className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <span
                          className={`text-sm font-semibold tabular-nums ${
                            t.type === TransactionType.INFLOW ? "text-green-600" : ""
                          }`}
                        >
                          {formatCompact(t.amount, sym)}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: TransactionStatus }) {
  const map: Record<TransactionStatus, { label: string; variant: "success" | "info" | "outline" | "secondary" }> = {
    CLEARED: { label: "Cleared", variant: "success" },
    RECONCILED: { label: "Reconciled", variant: "info" },
    PENDING: { label: "Pending", variant: "secondary" },
    VOID: { label: "Void", variant: "outline" },
  };
  const { label, variant } = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={variant} className="text-xs">{label}</Badge>;
}
