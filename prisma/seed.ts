import { PrismaClient, UserRole, AccountType, TransactionType, TransactionStatus, ReceivableStatus, PayableStatus, BudgetPeriod, AlertSeverity, AlertType, AlertStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Utility: convert major units to minor units (bigint)
function m(amount: number): bigint {
  return BigInt(Math.round(amount * 100));
}

// Utility: date helper
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86400000);
}
function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 86400000);
}

async function main() {
  console.log("🌱 Seeding CashFlowIQ demo data...");

  // Clean demo data
  await prisma.forecastItem.deleteMany({});
  await prisma.forecast.deleteMany({});
  await prisma.budget.deleteMany({});
  await prisma.alert.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.receivable.deleteMany({});
  await prisma.payable.deleteMany({});
  await prisma.financialAccount.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.companyMember.deleteMany({});
  await prisma.company.deleteMany({ where: { isDemo: true } });
  await prisma.user.deleteMany({ where: { email: "demo@meridian.com" } });

  // Create demo user
  const passwordHash = await bcrypt.hash("demo1234", 12);
  const demoUser = await prisma.user.create({
    data: {
      email: "demo@meridian.com",
      name: "Priya Sharma",
      passwordHash,
    },
  });

  // Create demo company
  const company = await prisma.company.create({
    data: {
      name: "Meridian Manufacturing Pvt Ltd",
      slug: "meridian-manufacturing-demo",
      currency: "INR",
      currencySymbol: "₹",
      minCashThreshold: m(1_000_000), // 10 lakh minimum threshold
      industry: "Manufacturing",
      isDemo: true,
      members: {
        create: {
          userId: demoUser.id,
          role: UserRole.OWNER,
        },
      },
    },
  });

  // Create categories
  const categories = await prisma.category.createMany({
    data: [
      { companyId: company.id, name: "Product Sales", type: "INCOME", color: "#22c55e", isSystem: true },
      { companyId: company.id, name: "Service Revenue", type: "INCOME", color: "#10b981", isSystem: true },
      { companyId: company.id, name: "Export Revenue", type: "INCOME", color: "#84cc16", isSystem: true },
      { companyId: company.id, name: "Other Income", type: "INCOME", color: "#a3e635", isSystem: true },
      { companyId: company.id, name: "Raw Materials", type: "EXPENSE", color: "#ef4444", isSystem: true },
      { companyId: company.id, name: "Salaries & Wages", type: "EXPENSE", color: "#f97316", isSystem: true },
      { companyId: company.id, name: "Rent & Utilities", type: "EXPENSE", color: "#8b5cf6", isSystem: true },
      { companyId: company.id, name: "Marketing", type: "EXPENSE", color: "#ec4899", isSystem: true },
      { companyId: company.id, name: "Logistics & Transport", type: "EXPENSE", color: "#6366f1", isSystem: true },
      { companyId: company.id, name: "Professional Services", type: "EXPENSE", color: "#f59e0b", isSystem: true },
      { companyId: company.id, name: "Equipment Maintenance", type: "EXPENSE", color: "#14b8a6", isSystem: true },
      { companyId: company.id, name: "Loan Repayment", type: "EXPENSE", color: "#dc2626", isSystem: true },
      { companyId: company.id, name: "Tax & Compliance", type: "EXPENSE", color: "#9f1239", isSystem: true },
      { companyId: company.id, name: "Miscellaneous", type: "EXPENSE", color: "#9ca3af", isSystem: true },
    ],
  });

  const cats = await prisma.category.findMany({ where: { companyId: company.id } });
  const catMap = new Map(cats.map((c) => [c.name, c.id]));

  // Create financial accounts
  const mainAccount = await prisma.financialAccount.create({
    data: {
      companyId: company.id,
      name: "HDFC Current Account",
      type: AccountType.BANK,
      bankName: "HDFC Bank",
      accountNumber: "4521",
      balance: m(2_450_000), // ₹24.5L
    },
  });

  const savingsAccount = await prisma.financialAccount.create({
    data: {
      companyId: company.id,
      name: "SBI Savings Account",
      type: AccountType.BANK,
      bankName: "State Bank of India",
      accountNumber: "8834",
      balance: m(850_000), // ₹8.5L
    },
  });

  const cashAccount = await prisma.financialAccount.create({
    data: {
      companyId: company.id,
      name: "Petty Cash",
      type: AccountType.CASH,
      balance: m(45_000),
    },
  });

  // Helper to create transaction and update account balance
  async function createTx(data: {
    accountId: string;
    categoryName: string;
    type: TransactionType;
    amount: number;
    description: string;
    date: Date;
    reference?: string;
  }) {
    const catId = catMap.get(data.categoryName);
    return prisma.transaction.create({
      data: {
        companyId: company.id,
        accountId: data.accountId,
        categoryId: catId,
        type: data.type,
        status: TransactionStatus.CLEARED,
        amount: m(data.amount),
        description: data.description,
        reference: data.reference,
        date: data.date,
        createdById: demoUser.id,
      },
    });
  }

  // 12 months of historical transactions
  console.log("Creating transactions...");

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (11 - i));
    return d;
  });

  for (const monthDate of months) {
    const m1 = monthDate.getMonth() + 1;
    const y = monthDate.getFullYear();

    // Monthly inflows
    await createTx({
      accountId: mainAccount.id,
      categoryName: "Product Sales",
      type: TransactionType.INFLOW,
      amount: 1_800_000 + Math.random() * 400_000,
      description: `Product sales revenue — ${monthDate.toLocaleString("en-IN", { month: "long" })} ${y}`,
      date: new Date(y, m1 - 1, 15),
      reference: `REV-${y}-${String(m1).padStart(2, "0")}`,
    });

    await createTx({
      accountId: mainAccount.id,
      categoryName: "Service Revenue",
      type: TransactionType.INFLOW,
      amount: 350_000 + Math.random() * 100_000,
      description: `Service & maintenance contracts — ${monthDate.toLocaleString("en-IN", { month: "long" })}`,
      date: new Date(y, m1 - 1, 20),
    });

    // Monthly outflows
    await createTx({
      accountId: mainAccount.id,
      categoryName: "Raw Materials",
      type: TransactionType.OUTFLOW,
      amount: 700_000 + Math.random() * 150_000,
      description: "Raw material procurement",
      date: new Date(y, m1 - 1, 5),
    });

    await createTx({
      accountId: mainAccount.id,
      categoryName: "Salaries & Wages",
      type: TransactionType.OUTFLOW,
      amount: 650_000,
      description: `Salaries — ${monthDate.toLocaleString("en-IN", { month: "long" })} ${y}`,
      date: new Date(y, m1 - 1, 28),
    });

    await createTx({
      accountId: mainAccount.id,
      categoryName: "Rent & Utilities",
      type: TransactionType.OUTFLOW,
      amount: 120_000,
      description: "Factory rent & electricity",
      date: new Date(y, m1 - 1, 1),
    });

    await createTx({
      accountId: mainAccount.id,
      categoryName: "Loan Repayment",
      type: TransactionType.OUTFLOW,
      amount: 180_000,
      description: "Term loan EMI",
      date: new Date(y, m1 - 1, 10),
    });

    await createTx({
      accountId: mainAccount.id,
      categoryName: "Logistics & Transport",
      type: TransactionType.OUTFLOW,
      amount: 85_000 + Math.random() * 30_000,
      description: "Freight & delivery charges",
      date: new Date(y, m1 - 1, 18),
    });

    if (m1 % 3 === 0) {
      await createTx({
        accountId: mainAccount.id,
        categoryName: "Tax & Compliance",
        type: TransactionType.OUTFLOW,
        amount: 280_000,
        description: "GST & advance tax payment",
        date: new Date(y, m1 - 1, 20),
      });
    }
  }

  // Receivables (outstanding invoices)
  console.log("Creating receivables...");
  const receivableData = [
    { customer: "Tata Projects Ltd", desc: "Industrial components supply Q3", amount: 850_000, days: -12, inv: "INV-2024-089", status: ReceivableStatus.OVERDUE },
    { customer: "L&T Construction", desc: "Fabrication services — Phase 2", amount: 1_200_000, days: -5, inv: "INV-2024-094", status: ReceivableStatus.OVERDUE },
    { customer: "Mahindra Agri", desc: "Agricultural equipment parts", amount: 420_000, days: 8, inv: "INV-2024-098", status: ReceivableStatus.SENT },
    { customer: "Bharat Heavy Electricals", desc: "Custom fabrication order", amount: 680_000, days: 15, inv: "INV-2024-102", status: ReceivableStatus.SENT },
    { customer: "Reliance Industries", desc: "Maintenance contract Q4", amount: 350_000, days: 22, inv: "INV-2024-105", status: ReceivableStatus.SENT },
    { customer: "JSW Steel", desc: "Steel component batch — October", amount: 920_000, days: 30, inv: "INV-2024-109", status: ReceivableStatus.SENT },
    { customer: "Adani Ports", desc: "Port equipment components", amount: 560_000, days: 45, inv: "INV-2024-112", status: ReceivableStatus.SENT },
    { customer: "Hindustan Unilever", desc: "Packaging machinery parts", amount: 280_000, days: 60, inv: "INV-2024-115", status: ReceivableStatus.DRAFT },
  ];

  for (const r of receivableData) {
    await prisma.receivable.create({
      data: {
        companyId: company.id,
        customerName: r.customer,
        invoiceNumber: r.inv,
        description: r.desc,
        amount: m(r.amount),
        currency: "INR",
        status: r.status,
        issueDate: daysAgo(Math.abs(r.days) + 30),
        dueDate: r.days < 0 ? daysAgo(Math.abs(r.days)) : daysFromNow(r.days),
      },
    });
  }

  // Payables (bills due)
  console.log("Creating payables...");
  const payableData = [
    { vendor: "Steel Industries Ltd", desc: "Steel coil supply — October batch", amount: 580_000, days: 5, bill: "BILL-2024-067" },
    { vendor: "Rajasthan Cement Works", desc: "Cement & construction materials", amount: 180_000, days: 8, bill: "BILL-2024-071" },
    { vendor: "Airtel Business", desc: "Q3 telecom & internet charges", amount: 45_000, days: 12, bill: "BILL-2024-073" },
    { vendor: "HDFC Bank", desc: "Working capital loan EMI", amount: 250_000, days: 15, bill: "BILL-2024-075" },
    { vendor: "Maharashtra DISCOM", desc: "Industrial electricity — October", amount: 95_000, days: 18, bill: "BILL-2024-077" },
    { vendor: "Hindustan Petroleum", desc: "Diesel fuel supply", amount: 130_000, days: 25, bill: "BILL-2024-081" },
    { vendor: "Marico Packaging", desc: "Packaging materials October", amount: 220_000, days: 32, bill: "BILL-2024-085" },
    { vendor: "Tax Consultancy LLP", desc: "GST filing & compliance Q3", amount: 85_000, days: 40, bill: "BILL-2024-090" },
    { vendor: "MIDC Industrial Estate", desc: "Industrial estate Q4 rent", amount: 120_000, days: -3, bill: "BILL-2024-059" },
  ];

  for (const p of payableData) {
    const isOverdue = p.days < 0;
    await prisma.payable.create({
      data: {
        companyId: company.id,
        vendorName: p.vendor,
        billNumber: p.bill,
        description: p.desc,
        amount: m(p.amount),
        currency: "INR",
        status: isOverdue ? PayableStatus.OVERDUE : PayableStatus.APPROVED,
        issueDate: daysAgo(30),
        dueDate: isOverdue ? daysAgo(Math.abs(p.days)) : daysFromNow(p.days),
      },
    });
  }

  // Budgets for current month
  console.log("Creating budgets...");
  const now = new Date();
  const budgetData = [
    { cat: "Raw Materials", amount: 800_000 },
    { cat: "Salaries & Wages", amount: 650_000 },
    { cat: "Rent & Utilities", amount: 130_000 },
    { cat: "Marketing", amount: 100_000 },
    { cat: "Logistics & Transport", amount: 100_000 },
    { cat: "Professional Services", amount: 60_000 },
    { cat: "Equipment Maintenance", amount: 80_000 },
  ];

  for (const b of budgetData) {
    const catId = catMap.get(b.cat);
    if (catId) {
      await prisma.budget.create({
        data: {
          companyId: company.id,
          categoryId: catId,
          period: BudgetPeriod.MONTHLY,
          periodYear: now.getFullYear(),
          periodMonth: now.getMonth() + 1,
          budgetedAmount: m(b.amount),
        },
      });
    }
  }

  // Alerts
  console.log("Creating alerts...");
  await prisma.alert.createMany({
    data: [
      {
        companyId: company.id,
        type: AlertType.OVERDUE_RECEIVABLE,
        severity: AlertSeverity.CRITICAL,
        status: AlertStatus.ACTIVE,
        title: "Critical: ₹20.5L in Overdue Receivables",
        description: "Tata Projects (₹8.5L) and L&T Construction (₹12L) are overdue. Immediate follow-up required.",
        amount: m(2_050_000),
      },
      {
        companyId: company.id,
        type: AlertType.LARGE_UPCOMING_PAYMENT,
        severity: AlertSeverity.WARNING,
        status: AlertStatus.ACTIVE,
        title: "Large Payment Due: Steel Industries",
        description: "₹5.8L due to Steel Industries Ltd in 5 days. Ensure account has sufficient balance.",
        amount: m(580_000),
        date: daysFromNow(5),
      },
    ],
  });

  console.log("✅ Demo seed complete!");
  console.log(`
  Demo Credentials:
  Email:    demo@meridian.com
  Password: demo1234
  Company:  Meridian Manufacturing Pvt Ltd
  `);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
