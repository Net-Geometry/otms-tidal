# Consolidated Payroll Memo Submission — Design

**Date:** 2026-02-27
**Requirements:** HR-01-01 through HR-01-11, FIN-02-03 (deferred)

## Summary

Replace the per-company payroll run approval workflow with a single consolidated memo per month/year. HR creates the memo, submits to Director (management role), who approves and auto-forwards to Finance. Finance approves and posts, locking all data and enabling payslip distribution.

## Decisions

| Decision | Choice |
|----------|--------|
| Replaces or supplements individual approvals? | Replaces — memo is the single approval entity |
| Rejection scope | Entire memo returns to HR |
| Memos per period | Exactly one (unique constraint on month+year) |
| Posting scope | Lock items + enable payslip distribution (Finance journal deferred) |
| Director role mapping | Reuse `management` RBAC role |
| Director → Finance transition | Auto-advance (no manual "send to finance" step) |

## Database Schema

### New table: `payroll_memos`

```sql
create table payroll_memos (
  id uuid primary key default gen_random_uuid(),
  memo_number text unique not null,
  pay_period_month int not null check (pay_period_month between 1 and 12),
  pay_period_year int not null,
  status text not null default 'draft',

  -- Consolidated totals (snapshotted from runs)
  employee_count int not null default 0,
  total_gross_salary numeric not null default 0,
  total_net_salary numeric not null default 0,
  total_director_fee numeric not null default 0,
  total_employer_epf numeric not null default 0,
  total_employee_epf numeric not null default 0,
  total_employer_socso numeric not null default 0,
  total_employee_socso numeric not null default 0,
  total_employer_eis numeric not null default 0,
  total_employee_eis numeric not null default 0,
  total_hrdc numeric not null default 0,
  total_pcb numeric not null default 0,
  total_allowances numeric not null default 0,
  total_deductions numeric not null default 0,

  -- HR stage
  created_by uuid references profiles(id),
  hr_id uuid references profiles(id),
  hr_approved_at timestamptz,
  hr_remarks text,

  -- Director stage
  director_id uuid references profiles(id),
  director_approved_at timestamptz,
  director_remarks text,

  -- Finance stage
  finance_id uuid references profiles(id),
  finance_approved_at timestamptz,
  finance_remarks text,

  -- Rejection
  rejected_by uuid references profiles(id),
  rejected_at timestamptz,
  rejection_remarks text,
  rejection_stage text, -- 'director' or 'finance'

  -- Posting
  is_posted boolean not null default false,
  posted_at timestamptz,
  posted_by uuid references profiles(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (pay_period_month, pay_period_year)
);
```

### Modified table: `payroll_runs`

```sql
alter table payroll_runs add column memo_id uuid references payroll_memos(id);
```

Individual run statuses simplify to: `draft`, `calculated`, `locked`. Existing approval columns on runs are kept for backward compatibility but no longer written to for new runs.

## Status Flow

```
draft → pending_director → pending_finance → finance_approved → posted
              ↓                    ↓
          rejected             rejected
```

- HR creates memo (draft) → submits to Director (pending_director)
- Director approves → auto-advances to pending_finance
- Finance approves → finance_approved → Finance posts → posted
- Rejection at any stage → rejected, linked runs unlocked to `calculated`

Director approval records `director_id` and `director_approved_at` even though status skips to `pending_finance`.

## UI Design

### Location

Existing "Consolidated" tab on Payroll page (`/hr/payroll`).

### UI States

**No memo for period:** Read-only consolidated table from runs. "Create Memo" button enabled only when all active companies have runs in `calculated` status.

**Draft:** Consolidated table with totals from memo. "Submit to Director" button (HR). "Delete Memo" option.

**Pending Director:** HR sees read-only + "Pending Director" badge. Management role sees Approve/Reject buttons + remarks.

**Pending Finance:** Management sees read-only. Finance role sees Approve/Reject + remarks.

**Finance Approved:** Finance sees "Post Payroll" button. Others see read-only.

**Posted:** Green "Posted" badge. Full approval trail displayed. All read-only.

**Rejected:** HR sees rejection remarks + "Resubmit" button. Can edit payroll items on individual runs, recalculate, then resubmit (re-snapshots totals, clears rejection, resets to pending_director).

### Components

| Component | Status |
|-----------|--------|
| `ConsolidatedPayrollMemo.tsx` | Major refactor — memo lifecycle states |
| `MemoApprovalActions.tsx` | New — role-based approve/reject/submit buttons |
| `MemoStatusBadge.tsx` | New — color-coded status badge |
| `MemoApprovalTrail.tsx` | New — approval history display |
| `usePayrollMemo.ts` | New hook — CRUD + transitions |
| `PayrollMemoView.tsx` | Minor update |
| `PayrollRunDetail.tsx` | Hide approval actions when run is linked to memo |

## Business Rules

1. **Create memo:** All active companies must have a `calculated` payroll run for the period. Totals are snapshotted from runs. `memo_id` set on each run.

2. **Submit to Director:** Memo → `pending_director`, runs → `locked`. Records HR approval metadata.

3. **Director approval:** Records director metadata, auto-advances to `pending_finance`.

4. **Finance approval:** Records finance metadata, memo → `finance_approved`.

5. **Posting:** All payroll items `is_locked = true`, memo → `posted`, runs stay `locked`. Payslip generation enabled.

6. **Rejection:** Memo → `rejected` with mandatory remarks and stage. Linked runs → `calculated` (unlocked). HR can edit items, recalculate, and resubmit the same memo.

7. **Run detail page:** If run has `memo_id`, hide individual approval actions. Show banner linking to the memo.

8. **One memo per period:** Enforced by unique constraint on `(pay_period_month, pay_period_year)`.
