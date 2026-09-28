---
name: system-tester
description: Autonomous end-to-end system testing agent specialized for the ERP application. Executes full system walkthroughs, validates CRUD operations, verifies Supabase data consistency, tests role permissions, and generates structured test result reports.
---

# System Testing Agent for ERP

This skill equips Antigravity to act as an **Autonomous Quality Assurance & System Testing Agent** for the Almas Accessories ERP system.

---

## 1. System Coverage Matrix

When tasked with a full system test, execute test cases across the following 12 core ERP modules:

| Module | Route / Component | Critical Test Cases |
| :--- | :--- | :--- |
| **Authentication** | `/login`, [`Auth.jsx`](file:///e:/WORK/ALMAS%20ACCESSORIES/ERP/src/views/Auth.jsx) | Login, session persistence, role-based redirection, logout, invalid credentials handling. |
| **Dashboard** | `/`, [`Dashboard.jsx`](file:///e:/WORK/ALMAS%20ACCESSORIES/ERP/src/views/Dashboard.jsx) | Metric cards calculation (Total Sales, Purchases, Dues, Stock Value), quick action links, charts rendering. |
| **Products** | `/products`, [`Product.jsx`](file:///e:/WORK/ALMAS%20ACCESSORIES/ERP/src/views/Product.jsx) | Add new product, category assignment, price/cost validation, barcode/SKU uniqueness, edit & delete. |
| **Inventory** | `/inventory`, [`Inventory.jsx`](file:///e:/WORK/ALMAS%20ACCESSORIES/ERP/src/views/Inventory.jsx) | Stock balance accuracy, low-stock threshold alerts, warehouse/branch stock breakdown, manual stock adjustments. |
| **Purchases** | `/purchases`, [`Purchases.jsx`](file:///e:/WORK/ALMAS%20ACCESSORIES/ERP/src/views/Purchases.jsx) | Create purchase invoice, multi-item line addition, supplier ledger update, stock increment verification. |
| **Sales** | `/sales`, [`Sales.jsx`](file:///e:/WORK/ALMAS%20ACCESSORIES/ERP/src/views/Sales.jsx) | POS/Invoice creation, customer ledger balance update, stock decrement, discount & tax calculations, invoice printing/preview. |
| **Branch Challans** | `/branch-challans`, [`BranchChallans.jsx`](file:///e:/WORK/ALMAS%20ACCESSORIES/ERP/src/views/BranchChallans.jsx) | Transfer creation between branches, transit status updates, receiving challan verification, stock deduction from source & addition to destination. |
| **Contacts** | `/contacts`, [`Contacts.jsx`](file:///e:/WORK/ALMAS%20ACCESSORIES/ERP/src/views/Contacts.jsx) | Customer & Supplier creation, ledger statement generation, credit limit checks, contact filtering. |
| **Payments** | `/payments`, [`Payments.jsx`](file:///e:/WORK/ALMAS%20ACCESSORIES/ERP/src/views/Payments.jsx) | Receive customer payments, record supplier payouts, account balance deductions, payment history log. |
| **Expenses** | `/expenses`, [`Expenses.jsx`](file:///e:/WORK/ALMAS%20ACCESSORIES/ERP/src/views/Expenses.jsx) | Record operational expenses, category breakdown, attachment/note logging, daily/monthly totals. |
| **Reports** | `/reports`, [`Reports.jsx`](file:///e:/WORK/ALMAS%20ACCESSORIES/ERP/src/views/Reports.jsx) | Profit & Loss statement, Sales summary, Stock valuation report, date range filtering, export to Excel/PDF. |
| **User Management** | `/users`, [`Users.jsx`](file:///e:/WORK/ALMAS%20ACCESSORIES/ERP/src/views/Users.jsx) | User registration, role assignments (Admin, Manager, Staff), permission boundary verification. |

---

## 2. Test Execution Workflow

Follow this systematic 4-step workflow:

### Step 1: Health Check & Dev Server Verification
1. Verify the Vite dev server is running on `http://localhost:5173` (or active port).
2. Check browser console logs for unhandled React errors, syntax issues, or broken Supabase queries.
3. Run lint check using `oxlint` to detect runtime/syntax pitfalls.

### Step 2: Interactive Browser Testing (E2E)
1. Use the `browser_subagent` to launch the application and navigate systematically through the UI.
2. Complete simulated user journeys:
   - **Order Lifecycle**: Create Product -> Record Purchase -> Verify Stock In -> Create Sale -> Verify Stock Out -> Record Payment -> Check Customer Ledger.
   - **Branch Transfer**: Create Branch Challan -> Dispatch -> Accept at Destination -> Verify stock rebalancing across warehouses.
3. Take DOM snapshots or screenshots to verify visual integrity, responsive layout, and toast/notification alerts.

### Step 3: Data Integrity Verification
1. Confirm Supabase CRUD requests execute without 400/403/500 errors.
2. Confirm ledger balances match mathematical invariants:
   $$\text{Final Balance} = \text{Opening Balance} + \text{Debit/Sales} - \text{Credit/Payments}$$

### Step 4: Generate Test Report Artifact
Generate a detailed report artifact titled `system_test_report.md` in the artifacts directory.

---

## 3. Test Report Template (`system_test_report.md`)

```markdown
# 🧪 ERP System Automated Test Report

**Execution Date**: YYYY-MM-DD HH:MM
**Environment**: Local Dev / Supabase
**Overall Status**: ✅ PASS / ⚠️ WARNINGS / ❌ FAILED

## Summary Metrics
- **Total Test Cases**: XX
- **Passed**: XX
- **Failed**: XX
- **Warnings / UI Quirks**: XX

## Detailed Results by Module
| Module | Test Case | Status | Notes / Latency |
| :--- | :--- | :--- | :--- |
| Auth | Login with Valid Credentials | ✅ PASS | Redirected in 210ms |
| Sales | Create Multi-item Invoice | ✅ PASS | Stock decremented correctly |
| ... | ... | ... | ... |

## Issues & Bugs Found
1. **[Module Name]**: Description of issue, stack trace, and reproduction step.

## Suggested Fixes / Action Plan
- Actionable recommendations to resolve any detected defects.
```
