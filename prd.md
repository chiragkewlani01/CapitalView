# CashFlowIQ

## Product Requirements Document (PRD)

**Product Type:** B2B Financial Intelligence & Cash-Flow Management Platform
**Primary Users:** CFOs, Finance Managers, Business Owners, FP&A Teams
**Technology:** Next.js + TypeScript + PostgreSQL
**Product Stage:** MVP → Production-ready architecture

---

# 1. Executive Summary

CashFlowIQ is a web-based financial intelligence platform designed to help businesses understand their current cash position, forecast future cash flow, identify potential liquidity problems, and receive actionable management recommendations.

The core question the product answers is:

> **"How much cash will we have in the future, what could cause a cash shortage, and what should management do about it?"**

Instead of simply displaying historical financial data, CashFlowIQ converts financial transactions, receivables, payables, budgets, and assumptions into:

* Current cash position
* Historical cash-flow analysis
* Future cash-flow forecasts
* Cash shortage predictions
* Financial risk alerts
* Scenario analysis
* Management recommendations

The platform should feel like a lightweight version of an enterprise **Treasury + FP&A + Financial Intelligence** platform.

---

# 2. Problem Statement

Businesses frequently have financial data spread across:

* Bank accounts
* Accounting software
* Excel files
* Invoices
* Payroll systems
* Expense systems
* Accounts receivable
* Accounts payable

The problem isn't necessarily lack of data.

The problem is that management often cannot quickly answer:

1. How much cash do we actually have?
2. How much cash is coming in?
3. How much cash is going out?
4. What will our cash balance look like in 30, 60, or 90 days?
5. When could we run into a cash shortage?
6. Which payments are creating the biggest pressure?
7. Which customers have delayed payments?
8. What happens if revenue decreases by 10%?
9. What happens if expenses increase by 15%?
10. What action should management take?

CashFlowIQ converts raw financial data into decision-support information.

---

# 3. Product Vision

Build a financial command center where a management team can open one dashboard and immediately understand:

**Current position → Future position → Risks → Recommended actions**

The product should move from:

**Data**

to

**Information**

to

**Insight**

to

**Action**

---

# 4. Target Users

## 4.1 CFO

Needs:

* Overall liquidity visibility
* Cash forecasts
* Risk detection
* Scenario planning
* Executive-level reporting

Primary dashboard:

**Executive Financial Overview**

---

## 4.2 Finance Manager

Needs:

* Transaction management
* Receivables
* Payables
* Forecast adjustments
* Alerts
* Financial reports

Primary dashboard:

**Finance Operations**

---

## 4.3 Business Owner

Needs simple answers rather than accounting complexity.

Example:

> "Your cash position is healthy today, but a ₹12 lakh shortage is projected in 47 days because of supplier payments."

Primary dashboard:

**Business Health**

---

## 4.4 Finance Analyst / FP&A Analyst

Needs:

* Historical analysis
* Forecast models
* Scenario planning
* Budget vs actual
* Data exports

Primary dashboard:

**Planning & Analysis**

---

# 5. Product Scope

## MVP

The first production-quality version should contain:

### Core

* Authentication
* Company/workspace
* User roles
* Financial accounts
* Transactions
* Categories
* Income
* Expenses
* Receivables
* Payables
* Cash-flow calculations
* Cash forecasting
* Scenario analysis
* Risk detection
* Alerts
* Dashboard
* Management insights
* CSV import
* Reports

---

# 6. High-Level Product Architecture

```text
                    ┌─────────────────────┐
                    │      User           │
                    │ CFO / Finance / CEO │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │    Next.js Web App  │
                    │                     │
                    │ Dashboard           │
                    │ Transactions        │
                    │ Forecast            │
                    │ Scenarios           │
                    │ Risks               │
                    │ Reports             │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Application API   │
                    │                     │
                    │ Auth                │
                    │ Transactions        │
                    │ Forecast Engine     │
                    │ Risk Engine         │
                    │ Insight Engine      │
                    └──────────┬──────────┘
                               │
                ┌──────────────┼───────────────┐
                ▼              ▼               ▼
        ┌─────────────┐ ┌──────────────┐ ┌──────────────┐
        │ PostgreSQL  │ │ Forecast     │ │ AI/Insights  │
        │ Database    │ │ Engine       │ │ Engine       │
        └─────────────┘ └──────────────┘ └──────────────┘
```

---

# 7. Technology Architecture

## Frontend

* Next.js
* TypeScript
* React
* Tailwind CSS
* shadcn/ui
* Recharts

## Backend

Use Next.js server-side architecture:

* Server Components
* Server Actions where appropriate
* Route Handlers for APIs
* Service layer for business logic

## Database

PostgreSQL

ORM:

Prisma

## Authentication

Auth.js

## Validation

Zod

## Charts

Recharts

## Deployment

Recommended:

* Vercel
* PostgreSQL provider such as Neon/Supabase

---

# 8. Application Structure

Recommended structure:

```text
src/
│
├── app/
│   ├── login/
│   ├── dashboard/
│   ├── transactions/
│   ├── cash-flow/
│   ├── forecast/
│   ├── scenarios/
│   ├── alerts/
│   ├── insights/
│   ├── reports/
│   └── settings/
│
├── components/
│   ├── dashboard/
│   ├── transactions/
│   ├── forecast/
│   ├── charts/
│   ├── alerts/
│   └── ui/
│
├── lib/
│   ├── db/
│   ├── auth/
│   ├── calculations/
│   ├── forecasting/
│   ├── risk/
│   └── ai/
│
├── services/
│   ├── transaction.service.ts
│   ├── forecast.service.ts
│   ├── risk.service.ts
│   └── insight.service.ts
│
├── types/
└── validations/
```

---

# 9. Core Data Model

The MVP database should contain the following entities.

## User

```text
id
name
email
password/auth provider
role
companyId
createdAt
updatedAt
```

Roles:

```text
OWNER
ADMIN
FINANCE_MANAGER
ANALYST
VIEWER
```

---

# 10. Company

```text
id
name
industry
currency
country
minimumCashThreshold
createdAt
updatedAt
```

Example:

```text
Company:
ABC Manufacturing Pvt Ltd

Currency:
INR

Minimum Cash Threshold:
₹10,00,000
```

---

# 11. Financial Account

Represents company bank/cash accounts.

```text
id
companyId
name
accountType
openingBalance
currentBalance
currency
status
```

Account types:

```text
BANK
CASH
CREDIT
INVESTMENT
OTHER
```

For MVP, these are manually created or populated through imported data.

---

# 12. Transaction

Core financial entity.

```text
id
companyId
accountId
type
amount
categoryId
description
transactionDate
status
counterparty
reference
createdAt
updatedAt
```

Transaction types:

```text
INFLOW
OUTFLOW
```

Status:

```text
COMPLETED
PENDING
CANCELLED
```

---

# 13. Transaction Categories

Examples:

```text
Sales Revenue
Customer Payment
Salary
Rent
Utilities
Marketing
Travel
Suppliers
Taxes
Loan Repayment
Software
Office Expenses
Other
```

Categories should be configurable by the company.

---

# 14. Receivables

Money the company expects to receive.

```text
id
companyId
customerName
invoiceNumber
amount
invoiceDate
dueDate
status
expectedPaymentDate
```

Status:

```text
PENDING
PARTIALLY_PAID
PAID
OVERDUE
```

---

# 15. Payables

Money the company expects to pay.

```text
id
companyId
vendorName
invoiceNumber
amount
invoiceDate
dueDate
status
expectedPaymentDate
```

Status:

```text
PENDING
PARTIALLY_PAID
PAID
OVERDUE
```

---

# 16. Forecast

Represents projected cash positions.

```text
id
companyId
forecastDate
projectedInflows
projectedOutflows
projectedBalance
scenario
confidence
createdAt
```

Scenario:

```text
BASE
OPTIMISTIC
PESSIMISTIC
CUSTOM
```

---

# 17. Alert

```text
id
companyId
type
severity
title
description
relatedEntityId
isRead
createdAt
```

Severity:

```text
INFO
WARNING
CRITICAL
```

---

# 18. Budget

```text
id
companyId
categoryId
period
budgetAmount
```

Used for:

**Budget vs Actual**

---

# 19. Core Dashboard

The dashboard is the most important screen.

The user should understand the company's financial situation within approximately 10 seconds.

---

## Dashboard Layout

### Header

```text
Good morning, Rahul

ABC Manufacturing Pvt Ltd

September 2026
```

---

## KPI Cards

### Current Cash

```text
₹48.5L
```

### Expected Inflow

```text
₹22.4L
```

### Expected Outflow

```text
₹31.7L
```

### Projected 30-Day Cash

```text
₹39.2L
```

### Cash Runway

```text
4.7 months
```

---

# 20. Cash Health Indicator

Display:

```text
Cash Health

🟢 Healthy
```

or

```text
🟡 Watch
```

or

```text
🔴 Critical
```

Based on configurable thresholds.

Example:

```text
Current cash > 3 months expected expenses
→ Healthy

Current cash > 1 month but < 3 months
→ Watch

Current cash < 1 month
→ Critical
```

These thresholds should be configurable.

---

# 21. Cash Flow Chart

Main chart:

```text
Cash Balance

₹60L ┤                  ╭────
₹50L ┤       ╭─────────╯
₹40L ┤───────╯
₹30L ┤
₹20L ┤
     └────────────────────────
       Today  30D  60D  90D
```

Show:

* Historical actual cash
* Forecast cash
* Minimum cash threshold

Actual and forecast periods must be visually distinguishable.

---

# 22. Inflow vs Outflow

Chart:

```text
Month       Inflow       Outflow

June        ₹35L         ₹28L
July        ₹42L         ₹31L
August      ₹39L         ₹44L
September   ₹45L         ₹51L
```

This helps identify deteriorating cash flow.

---

# 23. Cash Forecast Engine

This is the core intelligence of the application.

Basic calculation:

```text
Projected Cash
=
Current Cash
+
Expected Inflows
-
Expected Outflows
```

For each future date:

```text
Projected Balance(Day N)
=
Previous Balance
+
Inflows(Day N)
-
Outflows(Day N)
```

---

# 24. Sources of Forecast Data

Forecast inflows can come from:

### Receivables

```text
Invoice amount
×
Expected payment probability
```

Example:

```text
₹10L invoice
80% expected collection

Expected inflow:
₹8L
```

---

Forecast outflows:

* Payroll
* Rent
* Supplier payments
* Taxes
* Loan payments
* Recurring expenses
* Scheduled expenses

---

# 25. Forecast Assumptions

The user should be able to configure:

```text
Expected revenue growth: +5%

Average customer payment delay: 7 days

Expected expense growth: +3%

Minimum cash threshold: ₹10L
```

These assumptions affect forecasting.

---

# 26. Forecast Scenarios

Provide three default scenarios.

## Base Case

Normal expected business conditions.

```text
Revenue: 100%
Expenses: 100%
Collection: normal
```

## Optimistic

```text
Revenue: +10%
Expenses: -5%
Collections: faster
```

## Pessimistic

```text
Revenue: -15%
Expenses: +10%
Collections: delayed
```

The exact values should be configurable.

---

# 27. Scenario Comparison

Example:

```text
                 Base       Optimistic      Pessimistic

30 Days          ₹42L          ₹47L             ₹35L
60 Days          ₹39L          ₹48L             ₹21L
90 Days          ₹31L          ₹52L              ₹8L
```

The user immediately sees the risk.

---

# 28. Cash Shortage Detection

The system continuously checks:

```text
Projected Cash < Minimum Cash Threshold
```

If true:

Create a risk.

Example:

> 🔴 Cash shortage projected in 52 days.

Then:

```text
Current projected balance:
₹7.8L

Minimum threshold:
₹10L

Potential shortage:
₹2.2L
```

---

# 29. Risk Detection Engine

The MVP should use deterministic rules first.

Do not make AI responsible for basic financial calculations.

### Risk 1: Low Cash

```text
Projected cash < threshold
```

### Risk 2: Rising Expenses

```text
Current expenses > previous period expenses
```

Example:

> Operating expenses increased 18% compared with last month.

### Risk 3: Delayed Receivables

```text
Overdue receivables > threshold
```

Example:

> ₹14L of customer invoices are overdue.

### Risk 4: Large Upcoming Payment

```text
Upcoming payment > configured percentage of current cash
```

Example:

> A ₹20L supplier payment is due in 12 days.

### Risk 5: Negative Cash Flow

```text
Outflows > inflows
```

for a sustained period.

---

# 30. Risk Severity

### INFO

Minor observation.

### WARNING

Requires management attention.

### CRITICAL

Could materially affect liquidity.

---

# 31. Management Insights

The system converts detected patterns into understandable statements.

Example:

> **Cash pressure is increasing.**

> Your projected cash balance falls below the ₹10L minimum threshold in 52 days, primarily due to ₹18L of scheduled supplier payments.

Then provide possible actions:

```text
Potential Actions

1. Accelerate collection of ₹12L overdue receivables.
2. Review upcoming discretionary expenses.
3. Consider negotiating supplier payment terms.
```

Important:

These are **decision-support recommendations**, not financial instructions.

---

# 32. AI Layer

AI should sit on top of the deterministic financial engine.

Architecture:

```text
Database
   ↓
Financial Calculations
   ↓
Risk Detection
   ↓
Structured Financial Summary
   ↓
AI
   ↓
Management Explanation
```

Never:

```text
Database → AI → financial calculation
```

The AI should explain verified numbers, not invent them.

---

# 33. AI Financial Assistant

Add a conversational interface:

```text
Ask CashFlowIQ

"Why is our cash position declining?"
```

Response:

> Cash is projected to decline over the next 60 days primarily because expected outflows exceed inflows by ₹9.4L. The largest contributors are supplier payments and payroll.

Users can ask:

* Why is cash declining?
* What are our biggest expenses?
* When could we face a cash shortage?
* Which customers owe us the most?
* What happens if revenue drops 10%?
* Which expenses increased the most?
* How much cash will we have after 90 days?

---

# 34. CSV Import

For MVP, financial data can be imported using CSV.

Example:

```text
Date,Description,Type,Amount,Category,Account
2026-09-01,Customer Payment,INFLOW,500000,Sales,HDFC
2026-09-02,Salary,OUTFLOW,200000,Payroll,HDFC
```

Import flow:

```text
Upload CSV
     ↓
Parse
     ↓
Validate
     ↓
Preview
     ↓
User confirms
     ↓
Database
     ↓
Recalculate metrics
```

---

# 35. CSV Validation

Detect:

* Missing date
* Invalid amount
* Unknown transaction type
* Duplicate transactions
* Invalid category
* Invalid account

Show errors before importing.

---

# 36. Transactions Page

Features:

* Search
* Filter
* Sort
* Date range
* Category
* Account
* Inflow/outflow
* Status

Example:

```text
Transactions

Search: [Customer Payment]

Date       Description       Category      Amount

12 Sep     Client Payment    Revenue       +₹5L
11 Sep     AWS               Software      -₹48K
10 Sep     Payroll           Salary        -₹8L
```

---

# 37. Receivables Page

Show:

```text
Total Receivables
₹42L

Overdue
₹11L

Due This Week
₹7L

Expected This Month
₹24L
```

Table:

```text
Customer | Invoice | Amount | Due Date | Status
```

---

# 38. Payables Page

Show:

```text
Total Payables
₹31L

Due This Week
₹9L

Due This Month
₹22L
```

This directly feeds the cash forecast.

---

# 39. Budget vs Actual

Example:

```text
Category       Budget       Actual       Variance

Marketing      ₹5L          ₹6.2L        +₹1.2L
Payroll        ₹20L         ₹19.5L       -₹0.5L
Travel         ₹2L          ₹3.4L        +₹1.4L
Software       ₹3L          ₹2.8L        -₹0.2L
```

Highlight significant variances.

---

# 40. Reports

Generate:

### Cash Flow Report

* Opening cash
* Inflows
* Outflows
* Closing cash

### Forecast Report

* 30/60/90-day forecast
* Scenarios
* Risk points

### Receivables Report

* Outstanding invoices
* Aging
* Overdue amount

### Expense Report

* Category breakdown
* Monthly trends

Reports should eventually support PDF/CSV export.

---

# 41. User Roles & Permissions

## Owner

Everything.

## Admin

Everything except ownership changes.

## Finance Manager

Financial data + forecasting + reports.

## Analyst

View and analyze financial information.

## Viewer

Read-only dashboard and reports.

---

# 42. Authentication Flow

```text
User
 ↓
Login
 ↓
Auth.js
 ↓
Session
 ↓
Company identification
 ↓
Role verification
 ↓
Dashboard
```

Every database query must be scoped to the user's company.

This is critical.

A user from:

```text
Company A
```

must never be able to access:

```text
Company B
```

data.

---

# 43. Multi-Tenant Architecture

CashFlowIQ should be designed as a multi-tenant application.

```text
Company A
 ├── Users
 ├── Accounts
 ├── Transactions
 ├── Forecasts
 └── Reports

Company B
 ├── Users
 ├── Accounts
 ├── Transactions
 ├── Forecasts
 └── Reports
```

Every company-owned table contains:

```text
companyId
```

and server-side authorization must verify ownership.

---

# 44. API Architecture

Example endpoints:

```text
/api/auth

/api/companies

/api/accounts

/api/transactions
/api/transactions/import

/api/receivables
/api/payables

/api/forecast
/api/forecast/scenarios

/api/alerts

/api/insights

/api/reports
```

However, don't create APIs just for the sake of creating APIs.

For internal Next.js operations, Server Actions can be used where appropriate.

---

# 45. Financial Calculation Service

Create a dedicated service:

```text
financial-calculation.service.ts
```

Responsibilities:

* Current balance
* Total inflows
* Total outflows
* Net cash flow
* Monthly cash flow
* Budget variance
* Cash runway

This keeps financial logic away from UI components.

---

# 46. Forecast Service

```text
forecast.service.ts
```

Responsibilities:

```text
generateForecast()
calculateProjectedBalance()
calculateScenario()
findCashShortage()
calculateCashRunway()
```

Input:

```text
Current balance
Historical transactions
Receivables
Payables
Recurring expenses
Forecast assumptions
Scenario
```

Output:

```text
Forecast[]
Risk[]
Summary
```

---

# 47. Risk Service

```text
risk.service.ts
```

Responsibilities:

```text
detectLowCashRisk()
detectExpenseIncrease()
detectOverdueReceivables()
detectLargePayments()
detectNegativeCashFlow()
```

Each function returns structured data.

Example:

```text
{
  type: "LOW_CASH",
  severity: "CRITICAL",
  amount: 220000,
  date: "2026-10-27"
}
```

---

# 48. Insight Service

The insight service converts structured financial data into natural language.

Input:

```text
Risk
Forecast
Receivables
Payables
Expense trends
```

Output:

```text
{
  title,
  summary,
  drivers[],
  recommendedActions[]
}
```

AI should not have direct unrestricted database access.

---

# 49. End-to-End Data Flow

## Transaction Flow

```text
User
 ↓
Transaction Form
 ↓
Client Validation
 ↓
Server Action/API
 ↓
Zod Validation
 ↓
Authorization
 ↓
Database
 ↓
Transaction Created
 ↓
Financial Metrics Recalculated
 ↓
Forecast Updated
 ↓
Risk Engine
 ↓
Dashboard Updated
```

---

# 50. Forecast Flow

```text
Current Balance
       ↓
Historical Transactions
       ↓
Receivables
       ↓
Payables
       ↓
Recurring Expenses
       ↓
Forecast Assumptions
       ↓
Scenario
       ↓
Forecast Engine
       ↓
Daily Projected Cash
       ↓
Threshold Check
       ↓
Risk Engine
       ↓
Dashboard + Alerts
```

---

# 51. AI Insight Flow

```text
Financial Database
       ↓
Calculation Engine
       ↓
Structured Metrics
       ↓
Risk Engine
       ↓
Financial Context
       ↓
AI Model
       ↓
Management Explanation
       ↓
User
```

---

# 52. Example Complete Scenario

Company has:

```text
Current Cash: ₹50L
```

Expected inflows:

```text
Customer A: ₹10L
Customer B: ₹8L
Customer C: ₹7L
```

Expected outflows:

```text
Payroll: ₹12L
Supplier: ₹20L
Rent: ₹5L
Loan: ₹8L
```

Calculation:

```text
₹50L
+ ₹25L
- ₹45L
────────
₹30L projected
```

But the supplier payment occurs before the customer payments.

Daily forecast therefore detects:

```text
Day 25
Projected Cash: ₹8L

Minimum Threshold: ₹10L
```

Risk engine creates:

```text
CRITICAL

Cash shortage projected in 25 days.
```

AI insight:

> Your cash balance is projected to fall ₹2L below the minimum threshold in 25 days. The primary driver is the ₹20L supplier payment scheduled before expected customer collections.

Potential actions:

```text
• Accelerate customer collections
• Review supplier payment terms
• Delay non-essential expenses
```

That is the central product experience.

---

# 53. Security Requirements

Because this is financial software, security cannot be treated as decoration.

MVP requirements:

* Secure authentication
* Password hashing if credentials are managed directly
* HTTPS
* Server-side authorization
* Company-level data isolation
* Input validation
* SQL injection protection through Prisma
* CSRF protection where applicable
* Rate limiting for sensitive endpoints
* Secure environment variables
* Audit logs
* No sensitive financial data in client-side logs

---

# 54. Audit Logging

Track important actions:

```text
User
Action
Entity
Timestamp
IP/device metadata where appropriate
```

Examples:

```text
Rahul imported 1,240 transactions
Admin changed minimum cash threshold
Finance Manager deleted transaction
CFO created forecast scenario
```

For financial software, knowing **who changed what and when** matters.

---

# 55. Notifications

MVP:

* In-app alerts

Future:

* Email
* Slack
* WhatsApp
* Mobile push

Examples:

> Cash shortage projected in 30 days.

> ₹15L receivables are overdue.

> Monthly expenses exceeded budget by 18%.

---

# 56. Performance Requirements

Dashboard should ideally load in:

**< 2 seconds** for normal datasets.

Use:

* Server-side aggregation
* Database indexes
* Pagination
* Cached calculations where useful
* Avoid loading thousands of transactions into the browser

Charts should receive aggregated data rather than raw transaction records whenever possible.

---

# 57. Database Indexing

Important indexes:

```text
Transaction(companyId)
Transaction(companyId, transactionDate)
Transaction(companyId, type)
Transaction(companyId, categoryId)

Receivable(companyId, dueDate)
Payable(companyId, dueDate)

Forecast(companyId, forecastDate)
Alert(companyId, severity)
```

---

# 58. Error Handling

Every important operation should have predictable errors.

Examples:

```text
CSV import failed
Invalid transaction amount
Unauthorized access
Forecast generation failed
Database unavailable
AI service unavailable
```

The application should never expose raw server/database errors to users.

---

# 59. Empty States

Don't leave blank screens.

Example:

> No transactions yet.

> Import your financial data to generate your first cash-flow forecast.

Button:

**Import Transactions**

This creates a natural onboarding path.

---

# 60. Onboarding Flow

First login:

```text
Create Company
      ↓
Set Currency
      ↓
Set Minimum Cash Threshold
      ↓
Add Financial Account
      ↓
Import Transactions
      ↓
Add Receivables
      ↓
Add Payables
      ↓
Generate Forecast
      ↓
Dashboard
```

---

# 61. Demo Mode

For portfolio/demo purposes, create:

**"Load Demo Company"**

It should populate realistic fictional data.

Example:

```text
ABC Manufacturing Pvt Ltd
₹2.4 Cr annual revenue
₹48.5L current cash
₹22.4L receivables
₹31.7L payables
```

This is extremely useful when demonstrating the product without entering hundreds of records manually.

---

# 62. MVP Acceptance Criteria

The MVP is complete when a user can:

### Authentication

* Create account
* Login
* Logout
* Access company dashboard

### Financial Data

* Create account
* Add transaction
* Edit transaction
* Delete transaction
* Import CSV
* View transactions

### Receivables

* Create invoice
* Mark invoice paid
* Track overdue invoices

### Payables

* Create payable
* Mark payable paid
* Track upcoming payments

### Dashboard

Display:

* Current cash
* Inflow
* Outflow
* Net cash flow
* Forecast
* Cash runway
* Alerts

### Forecast

Generate:

* 30-day forecast
* 60-day forecast
* 90-day forecast
* Base scenario
* Optimistic scenario
* Pessimistic scenario

### Intelligence

Detect:

* Low cash
* Negative cash flow
* Large upcoming payment
* Overdue receivables
* Expense increases

### AI

Explain detected financial patterns using verified application data.

---

# 63. What NOT to Build Initially

Avoid these in V1:

* Real bank account integrations
* Actual money transfers
* Payment processing
* Loan underwriting
* Stock trading
* Real financial advice
* Regulatory filing automation
* Complex accounting
* Full ERP functionality
* Machine-learning credit scoring

These will explode the scope.

The product is **cash-flow intelligence**, not a bank or ERP.

---

# 64. Future Roadmap

## V2

* Bank integrations
* Accounting integrations
* Automated transaction categorization
* Recurring transaction detection
* Email alerts
* Advanced scenario modeling

## V3

* AI forecasting
* Cash optimization recommendations
* Vendor payment optimization
* Customer payment prediction
* Department-level financial intelligence

## V4

Enterprise:

* Multi-company groups
* Advanced permissions
* Approval workflows
* Audit controls
* SSO
* Advanced reporting
* API access
* ERP integrations

---

# 65. Product Success Metrics

The product should eventually measure:

### Financial Visibility

Percentage of transactions categorized.

### Forecast Accuracy

```text
Forecasted Cash vs Actual Cash
```

### Risk Detection

Number of meaningful risks identified.

### Actionability

Percentage of alerts that lead to user action.

### User Engagement

* Dashboard visits
* Forecast usage
* Scenario creation
* Reports generated
* AI questions asked

---

# 66. Design Direction

The UI should look like **modern enterprise financial software**.

Avoid:

* Excessive gradients
* Giant illustrations
* Consumer-app aesthetics
* Excessive animations
* Cartoonish dashboards

Prefer:

* Dense but readable information
* Strong typography
* Clear hierarchy
* Tables
* Financial charts
* KPI cards
* Professional status indicators
* Minimal animation

Think:

**Bloomberg-lite + modern SaaS + CFO dashboard**

not:

**college project dashboard with 17 glowing cards.**

---

# 67. Navigation

Primary sidebar:

```text
CashFlowIQ

Overview

Financials
  Transactions
  Receivables
  Payables

Planning
  Cash Flow
  Forecast
  Scenarios
  Budgets

Intelligence
  Risks
  Insights

Reports

Settings
```

---

# 68. Core Product Loop

The entire application revolves around this loop:

```text
             ┌───────────────┐
             │ Financial Data│
             └───────┬───────┘
                     ↓
             ┌───────────────┐
             │   Analysis    │
             └───────┬───────┘
                     ↓
             ┌───────────────┐
             │   Forecast    │
             └───────┬───────┘
                     ↓
             ┌───────────────┐
             │ Risk Detection│
             └───────┬───────┘
                     ↓
             ┌───────────────┐
             │ AI Insights   │
             └───────┬───────┘
                     ↓
             ┌───────────────┐
             │Management     │
             │Decision       │
             └───────┬───────┘
                     ↓
             ┌───────────────┐
             │ New Financial │
             │ Data          │
             └───────┬───────┘
                     │
                     └──────────────→ Loop
```

---

# 69. Final Product Definition

CashFlowIQ is **not** primarily a transaction management application.

Transactions are simply the raw material.

The actual product is:

> **A financial decision-support system that converts company cash-flow data into forecasts, risks, and management insights.**

The hierarchy should therefore always be:

```text
DATA
 ↓
METRICS
 ↓
FORECAST
 ↓
RISKS
 ↓
INSIGHTS
 ↓
ACTIONS
```

That hierarchy should guide both the architecture and the UI.

---

# 70. Recommended Development Sequence

Build the application in these exact stages:

### Stage 1

Project setup + design system

### Stage 2

Authentication + company/workspace

### Stage 3

Database + Prisma schema

### Stage 4

Accounts + transactions

### Stage 5

CSV import

### Stage 6

Receivables + payables

### Stage 7

Dashboard calculations

### Stage 8

Historical cash-flow analytics

### Stage 9

Forecast engine

### Stage 10

Scenario engine

### Stage 11

Risk detection engine

### Stage 12

Alerts

### Stage 13

AI management insights

### Stage 14

AI financial assistant

### Stage 15

Reports

### Stage 16

Security + audit logs

### Stage 17

Demo dataset

### Stage 18

Testing + performance optimization

### Stage 19

Deployment

---

# 71. The Golden Rule for Vibe Coding This Project

Do **not** tell the AI:

> "Build CashFlowIQ completely."

Instead, give it controlled milestones.

For every feature, make the AI follow:

```text
Requirement
 ↓
Database
 ↓
Business Logic
 ↓
Server/API
 ↓
UI
 ↓
Validation
 ↓
Error Handling
 ↓
Testing
```

This keeps the generated application maintainable instead of turning it into a giant AI-generated pile of components.

---

# 72. First Development Milestone

The first milestone should be:

**CashFlowIQ Foundation**

Deliver:

```text
Next.js project
+
TypeScript
+
Tailwind
+
shadcn/ui
+
PostgreSQL
+
Prisma
+
Auth.js
+
Application layout
+
Sidebar
+
Authentication
+
Company model
+
User roles
```

Do **not** build forecasting or AI yet.

Once the foundation works, build the financial data layer on top of it.
