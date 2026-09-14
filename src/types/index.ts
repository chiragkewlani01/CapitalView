export type {
  User,
  Company,
  CompanyMember,
  FinancialAccount,
  Transaction,
  Category,
  Receivable,
  Payable,
  Forecast,
  ForecastItem,
  Budget,
  Alert,
  AuditLog,
} from "@prisma/client";

export {
  UserRole,
  AccountType,
  TransactionType,
  TransactionStatus,
  ReceivableStatus,
  PayableStatus,
  CategoryType,
  ForecastScenario,
  AlertSeverity,
  AlertType,
  AlertStatus,
  BudgetPeriod,
  AuditAction,
} from "@prisma/client";

// ============================================================
// Domain types
// ============================================================

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  companyId: string;
  companyName: string;
  companyCurrency: string;
  companyCurrencySymbol: string;
  role: import("@prisma/client").UserRole;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ============================================================
// Financial types (amounts always in minor units / BigInt)
// ============================================================

export interface CashPosition {
  currentCash: bigint;
  totalInflows: bigint;
  totalOutflows: bigint;
  netCashFlow: bigint;
}

export interface MonthlyCashFlow {
  month: string; // "2024-01"
  year: number;
  monthNum: number;
  openingBalance: bigint;
  inflows: bigint;
  outflows: bigint;
  netCashFlow: bigint;
  closingBalance: bigint;
}

export interface ReceivablesSummary {
  total: bigint;
  overdue: bigint;
  dueThisWeek: bigint;
  dueThisMonth: bigint;
  collected: bigint;
}

export interface PayablesSummary {
  total: bigint;
  overdue: bigint;
  dueThisWeek: bigint;
  dueThisMonth: bigint;
  paid: bigint;
}

export interface ForecastResult {
  scenario: import("@prisma/client").ForecastScenario;
  startDate: Date;
  endDate: Date;
  startingCash: bigint;
  projectedEndingCash: bigint;
  minProjectedBalance: bigint;
  minBalanceDate: Date;
  cashShortageDate?: Date;
  cashShortageAmount?: bigint;
  cashRunwayDays?: number;
  items: ForecastDayItem[];
}

export interface ForecastDayItem {
  date: Date;
  openingBalance: bigint;
  inflows: bigint;
  outflows: bigint;
  netCashFlow: bigint;
  closingBalance: bigint;
  isShortagePeriod: boolean;
}

export interface ScenarioAssumptions {
  revenueGrowthBps: number; // basis points (100 = 1%)
  expenseGrowthBps: number;
  collectionDelayDays: number;
  paymentDelayDays: number;
}

export interface RiskItem {
  type: import("@prisma/client").AlertType;
  severity: import("@prisma/client").AlertSeverity;
  title: string;
  description: string;
  amount?: bigint;
  date?: Date;
  relatedEntity?: string;
  relatedId?: string;
}

export interface BudgetWithActual {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryColor?: string | null;
  period: import("@prisma/client").BudgetPeriod;
  periodYear: number;
  periodMonth?: number | null;
  budgetedAmount: bigint;
  actualAmount: bigint;
  variance: bigint;
  variancePct: number;
}

export interface FinancialContext {
  company: {
    name: string;
    currency: string;
    currencySymbol: string;
    minCashThreshold: bigint;
  };
  cashPosition: CashPosition;
  currentCash: bigint;
  receivablesSummary: ReceivablesSummary;
  payablesSummary: PayablesSummary;
  forecast30: ForecastResult | null;
  topExpenseCategories: Array<{ name: string; amount: bigint }>;
  topRisks: RiskItem[];
  recentTransactionCount: number;
  periodStart: Date;
  periodEnd: Date;
}
