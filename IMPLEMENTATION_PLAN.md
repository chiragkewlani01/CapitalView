# CashFlowIQ — Implementation Plan

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      Next.js App Router                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │   Pages/UI   │  │  API Routes  │  │ Server Actions│  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
│         └─────────────────┼──────────────────┘          │
│                           │                              │
│  ┌────────────────────────▼──────────────────────────┐  │
│  │              Service / Business Logic Layer        │  │
│  │  calculations/ │ forecasting/ │ risk/ │ insights/  │  │
│  └────────────────────────┬──────────────────────────┘  │
│                           │                              │
│  ┌────────────────────────▼──────────────────────────┐  │
│  │           Prisma ORM  ←→  PostgreSQL               │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS + shadcn/ui |
| ORM | Prisma 5 |
| Database | PostgreSQL 15 |
| Auth | Auth.js (NextAuth v5) |
| Validation | Zod |
| Charts | Recharts |
| Icons | Lucide React |
| AI | OpenAI GPT-4o |
| Testing | Vitest + Testing Library |

## Database Plan

### Core Models
- **User** — auth, role, company membership
- **Company** — tenant root, currency, min cash threshold
- **Account** — BANK/CASH/CREDIT/INVESTMENT/OTHER
- **Transaction** — inflows/outflows, categorized, reconciled
- **Category** — user-defined expense/income categories
- **Receivable** — customer invoices / expected inflows
- **Payable** — vendor bills / expected outflows
- **Forecast** — generated projections (daily balances)
- **ForecastItem** — individual daily forecast data points
- **Budget** — category budgets per period
- **Alert** — system-generated risk alerts
- **AuditLog** — immutable action log

### Tenant Isolation
- Every entity has `companyId`
- All server queries always filter by `companyId` from session
- Client NEVER sends `companyId` that is trusted

### Key Relationships
```
Company → Users (many-to-many via UserCompany)
Company → Accounts → Transactions
Company → Categories
Company → Receivables
Company → Payables
Company → Budgets
Company → Forecasts → ForecastItems
Company → Alerts
Company → AuditLogs
```

## Implementation Phases

### Phase 1: Foundation
- Next.js init, TypeScript, Tailwind, shadcn/ui
- ESLint, Prettier, env setup

### Phase 2: Database
- Prisma schema all models
- Migrations
- Seed script

### Phase 3: Auth
- Auth.js credentials provider
- Session with role
- Protected routes middleware
- Server-side auth utilities

### Phase 4: Shell
- Sidebar navigation
- Header + user menu
- Layout with breadcrumbs

### Phase 5: Company & Accounts
- Company creation on signup
- Account CRUD

### Phase 6: Transactions
- Full CRUD
- Server-side pagination/filtering
- Category management

### Phase 7: CSV Import
- Upload → Parse → Validate → Preview → Import

### Phase 8: Receivables & Payables
- Full CRUD
- Overdue detection
- Expected collection calculations

### Phase 9: Financial Engine
- `src/lib/calculations/` — pure functions
- All core financial metrics

### Phase 10: Analytics
- Historical cash flow charts
- Monthly aggregations

### Phase 11: Forecast Engine
- `src/lib/forecasting/` — 30/60/90 day projections
- Daily balance projections
- Shortage detection

### Phase 12: Scenario Engine
- BASE/OPTIMISTIC/PESSIMISTIC/CUSTOM
- Configurable assumptions

### Phase 13: Risk Engine
- `src/lib/risk/` — deterministic rules
- Structured risk objects

### Phase 14: AI Layer
- Context builder (structured, not raw DB)
- Management insights
- AI assistant chat

### Phase 15: Dashboard
- All KPI cards from real data
- Charts: cash flow, inflow vs outflow
- Top risks, overdue, upcoming

### Phase 16: Budgets & Reports
- Budget CRUD, variance tracking
- CSV export for all reports

### Phase 17: Audit Logs
- Middleware-style logging
- Log viewer

### Phase 18: Demo Data
- Realistic company "Meridian Manufacturing Pvt Ltd"
- 12 months historical + 90 days projected

### Phase 19: Testing
- Unit tests: calculations, forecasting, risk
- Integration tests: auth, tenant isolation

### Phase 20: QA & Build
- TypeScript strict check
- ESLint clean
- Production build

## API / Server Actions Plan

### Server Actions (mutations)
- `actions/auth.ts` — signup, login, logout
- `actions/company.ts` — create, update settings
- `actions/accounts.ts` — CRUD
- `actions/transactions.ts` — CRUD
- `actions/csv-import.ts` — upload, validate, confirm
- `actions/receivables.ts` — CRUD, mark paid
- `actions/payables.ts` — CRUD, mark paid
- `actions/budgets.ts` — CRUD
- `actions/forecasts.ts` — generate, save

### API Routes (data fetching, AI streaming)
- `api/ai/insights` — management insights
- `api/ai/chat` — assistant streaming
- `api/reports/[type]` — CSV export
- `api/health` — health check

## Testing Strategy

- **Unit**: All `src/lib/` functions (calculations, forecasting, risk)
- **Integration**: Auth flows, tenant isolation, CSV import
- **Edge cases**: Zero data, negative cash, large amounts, overdue scenarios

## Deployment Strategy

- **Docker** — Dockerfile + docker-compose for local dev
- **.env.example** — all required variables documented
- **Database migrations** — run at startup
- **Health check** endpoint
- Vercel-compatible (serverless) with connection pooling via PgBouncer/Neon

## Security Checklist

- [ ] No companyId from client trusted
- [ ] All mutations require auth session
- [ ] Zod validation on all inputs
- [ ] Parameterized queries only (Prisma)
- [ ] CSV injection prevention
- [ ] Rate limiting on AI endpoints
- [ ] No secrets in source code
- [ ] Environment variables for all credentials
