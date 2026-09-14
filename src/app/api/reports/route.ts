import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TransactionType, ReceivableStatus, PayableStatus } from "@prisma/client";
import { format } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as Record<string, unknown>;
  const companyId = user.companyId as string;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type") ?? "transactions";
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  let csv = "";

  if (type === "transactions") {
    const where: Record<string, unknown> = { companyId };
    if (dateFrom) where.date = { ...(where.date as object), gte: new Date(dateFrom) };
    if (dateTo) where.date = { ...(where.date as object), lte: new Date(dateTo) };

    const transactions = await prisma.transaction.findMany({
      where,
      include: { category: true, account: true },
      orderBy: { date: "desc" },
    });

    csv = "Date,Description,Type,Amount,Category,Account,Reference,Status\n";
    csv += transactions
      .map((t) =>
        [
          format(t.date, "yyyy-MM-dd"),
          `"${t.description}"`,
          t.type,
          (Number(t.amount) / 100).toFixed(2),
          t.category?.name ?? "",
          t.account.name,
          t.reference ?? "",
          t.status,
        ].join(",")
      )
      .join("\n");
  } else if (type === "receivables") {
    const receivables = await prisma.receivable.findMany({
      where: { companyId },
      orderBy: { dueDate: "desc" },
    });

    csv = "Customer,Invoice#,Description,Amount,AmountPaid,Status,IssueDate,DueDate\n";
    csv += receivables
      .map((r) =>
        [
          `"${r.customerName}"`,
          r.invoiceNumber ?? "",
          `"${r.description}"`,
          (Number(r.amount) / 100).toFixed(2),
          (Number(r.amountPaid) / 100).toFixed(2),
          r.status,
          format(r.issueDate, "yyyy-MM-dd"),
          format(r.dueDate, "yyyy-MM-dd"),
        ].join(",")
      )
      .join("\n");
  } else if (type === "payables") {
    const payables = await prisma.payable.findMany({
      where: { companyId },
      orderBy: { dueDate: "desc" },
    });

    csv = "Vendor,Bill#,Description,Amount,AmountPaid,Status,IssueDate,DueDate\n";
    csv += payables
      .map((p) =>
        [
          `"${p.vendorName}"`,
          p.billNumber ?? "",
          `"${p.description}"`,
          (Number(p.amount) / 100).toFixed(2),
          (Number(p.amountPaid) / 100).toFixed(2),
          p.status,
          format(p.issueDate, "yyyy-MM-dd"),
          format(p.dueDate, "yyyy-MM-dd"),
        ].join(",")
      )
      .join("\n");
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="cashflowiq-${type}-${format(new Date(), "yyyy-MM-dd")}.csv"`,
    },
  });
}
