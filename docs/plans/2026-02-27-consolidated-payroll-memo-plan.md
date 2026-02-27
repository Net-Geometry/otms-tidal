# Consolidated Payroll Memo Submission — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace individual per-company payroll run approvals with a single consolidated memo per month/year that goes through HR → Director → Finance → Posted.

**Architecture:** New `payroll_memos` table owns the approval workflow. Individual `payroll_runs` get a `memo_id` FK and simplified statuses (`draft`, `calculated`, `locked`). The existing `ConsolidatedPayrollMemo.tsx` component is refactored to support the full memo lifecycle with role-based actions.

**Tech Stack:** Supabase (Postgres), React, TanStack Query, shadcn/ui, TypeScript

---

### Task 1: Database Migration — Create `payroll_memos` Table

**Files:**
- Create: migration via Supabase MCP `apply_migration` tool

**Step 1: Apply the migration**

Use the Supabase MCP `apply_migration` tool with name `create_payroll_memos` and this SQL:

```sql
-- Create payroll_memos table
create table public.payroll_memos (
  id uuid primary key default gen_random_uuid(),
  memo_number text unique not null,
  pay_period_month int not null check (pay_period_month between 1 and 12),
  pay_period_year int not null,
  status text not null default 'draft',

  employee_count int not null default 0,
  total_gross_salary numeric(14,2) not null default 0,
  total_net_salary numeric(14,2) not null default 0,
  total_director_fee numeric(14,2) not null default 0,
  total_employer_epf numeric(14,2) not null default 0,
  total_employee_epf numeric(14,2) not null default 0,
  total_employer_socso numeric(14,2) not null default 0,
  total_employee_socso numeric(14,2) not null default 0,
  total_employer_eis numeric(14,2) not null default 0,
  total_employee_eis numeric(14,2) not null default 0,
  total_hrdc numeric(14,2) not null default 0,
  total_pcb numeric(14,2) not null default 0,
  total_allowances numeric(14,2) not null default 0,
  total_deductions numeric(14,2) not null default 0,

  created_by uuid references public.profiles(id),
  hr_id uuid references public.profiles(id),
  hr_approved_at timestamptz,
  hr_remarks text,

  director_id uuid references public.profiles(id),
  director_approved_at timestamptz,
  director_remarks text,

  finance_id uuid references public.profiles(id),
  finance_approved_at timestamptz,
  finance_remarks text,

  rejected_by uuid references public.profiles(id),
  rejected_at timestamptz,
  rejection_remarks text,
  rejection_stage text,

  is_posted boolean not null default false,
  posted_at timestamptz,
  posted_by uuid references public.profiles(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (pay_period_month, pay_period_year)
);

-- Add memo_id FK to payroll_runs
alter table public.payroll_runs
  add column memo_id uuid references public.payroll_memos(id);

-- Enable RLS
alter table public.payroll_memos enable row level security;

-- RLS policies: authenticated users can read, mutations controlled by app logic
create policy "Authenticated users can view memos"
  on public.payroll_memos for select
  to authenticated using (true);

create policy "Authenticated users can insert memos"
  on public.payroll_memos for insert
  to authenticated with check (true);

create policy "Authenticated users can update memos"
  on public.payroll_memos for update
  to authenticated using (true);
```

**Step 2: Verify migration**

Run: `select column_name, data_type from information_schema.columns where table_name = 'payroll_memos' order by ordinal_position;` via Supabase MCP `execute_sql`.

Expected: all columns listed above.

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: create payroll_memos table and add memo_id to payroll_runs"
```

---

### Task 2: TypeScript Types — Add `PayrollMemo` Type and Memo Status Constants

**Files:**
- Modify: `src/types/payroll.ts`

**Step 1: Add memo types to `src/types/payroll.ts`**

Add these types after the existing `PayrollRunStatus` type (around line 11):

```typescript
export type PayrollMemoStatus =
  | 'draft'
  | 'pending_director'
  | 'pending_finance'
  | 'finance_approved'
  | 'posted'
  | 'rejected';

export const MEMO_STATUS_LABELS: Record<PayrollMemoStatus, string> = {
  draft: 'Draft',
  pending_director: 'Pending Director',
  pending_finance: 'Pending Finance',
  finance_approved: 'Finance Approved',
  posted: 'Posted',
  rejected: 'Rejected',
};

export const MEMO_STATUS_TRANSITIONS = [
  { from: 'draft', to: 'pending_director', role: 'hr' },
  { from: 'pending_director', to: 'pending_finance', role: 'management' },
  { from: 'pending_director', to: 'rejected', role: 'management' },
  { from: 'pending_finance', to: 'finance_approved', role: 'finance' },
  { from: 'pending_finance', to: 'rejected', role: 'finance' },
  { from: 'finance_approved', to: 'posted', role: 'finance' },
] as const;

export function canTransitionMemo(from: string, to: string, role: string): boolean {
  return MEMO_STATUS_TRANSITIONS.some(
    (t) => t.from === from && t.to === to && t.role === role
  );
}
```

Add the `PayrollMemo` interface after the existing `PayrollRun` interface (around line 162):

```typescript
export interface PayrollMemo {
  id: string;
  memo_number: string;
  pay_period_month: number;
  pay_period_year: number;
  status: PayrollMemoStatus;

  employee_count: number;
  total_gross_salary: number;
  total_net_salary: number;
  total_director_fee: number;
  total_employer_epf: number;
  total_employee_epf: number;
  total_employer_socso: number;
  total_employee_socso: number;
  total_employer_eis: number;
  total_employee_eis: number;
  total_hrdc: number;
  total_pcb: number;
  total_allowances: number;
  total_deductions: number;

  created_by: string | null;
  hr_id: string | null;
  hr_approved_at: string | null;
  hr_remarks: string | null;

  director_id: string | null;
  director_approved_at: string | null;
  director_remarks: string | null;

  finance_id: string | null;
  finance_approved_at: string | null;
  finance_remarks: string | null;

  rejected_by: string | null;
  rejected_at: string | null;
  rejection_remarks: string | null;
  rejection_stage: string | null;

  is_posted: boolean;
  posted_at: string | null;
  posted_by: string | null;

  created_at: string;
  updated_at: string;
}
```

**Step 2: Verify types compile**

Run: `bun run tsc --noEmit`

Expected: no errors.

**Step 3: Commit**

```bash
git add src/types/payroll.ts && git commit -m "feat: add PayrollMemo type and memo status transitions"
```

---

### Task 3: Hook — Create `usePayrollMemo.ts`

**Files:**
- Create: `src/hooks/payroll/usePayrollMemo.ts`

**Step 1: Create the hook**

Create `src/hooks/payroll/usePayrollMemo.ts` with this content:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { PayrollMemo, PayrollApprovalRole } from '@/types/payroll';
import { canTransitionMemo } from '@/types/payroll';

export function usePayrollMemo(month: number, year: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const queryKey = ['payroll-memo', month, year];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const db = supabase as any;
      const { data, error } = await db
        .from('payroll_memos')
        .select('*')
        .eq('pay_period_month', month)
        .eq('pay_period_year', year)
        .maybeSingle();
      if (error) throw error;
      return data as PayrollMemo | null;
    },
    enabled: month > 0 && year > 0,
    staleTime: 20 * 1000,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['payroll-memo'] });
    queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
    queryClient.invalidateQueries({ queryKey: ['consolidated-payroll-runs'] });
  };

  // Create memo: snapshot totals from runs, link runs via memo_id
  const createMutation = useMutation({
    mutationFn: async () => {
      const db = supabase as any;
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');

      // Check no existing memo
      const { data: existing } = await db
        .from('payroll_memos')
        .select('id')
        .eq('pay_period_month', month)
        .eq('pay_period_year', year)
        .maybeSingle();
      if (existing) throw new Error('A memo already exists for this period');

      // Fetch all runs for this period
      const { data: runs, error: runsErr } = await db
        .from('payroll_runs')
        .select('id, status, employee_count, total_gross_salary, total_net_salary, total_director_fee, total_employer_epf, total_employee_epf, total_employer_socso, total_employee_socso, total_employer_eis, total_employee_eis, total_hrdc, total_pcb, total_allowances, total_deductions')
        .eq('pay_period_month', month)
        .eq('pay_period_year', year)
        .is('memo_id', null);
      if (runsErr) throw runsErr;
      if (!runs || runs.length === 0) throw new Error('No payroll runs found for this period');

      // Check all runs have items (not draft with 0 employees)
      const notReady = runs.filter((r: any) => r.employee_count === 0);
      if (notReady.length > 0) {
        throw new Error(`${notReady.length} payroll run(s) have no calculated employees. Calculate payroll first.`);
      }

      // Aggregate totals
      const totals = runs.reduce((acc: Record<string, number>, r: any) => {
        acc.employee_count += Number(r.employee_count || 0);
        acc.total_gross_salary += Number(r.total_gross_salary || 0);
        acc.total_net_salary += Number(r.total_net_salary || 0);
        acc.total_director_fee += Number(r.total_director_fee || 0);
        acc.total_employer_epf += Number(r.total_employer_epf || 0);
        acc.total_employee_epf += Number(r.total_employee_epf || 0);
        acc.total_employer_socso += Number(r.total_employer_socso || 0);
        acc.total_employee_socso += Number(r.total_employee_socso || 0);
        acc.total_employer_eis += Number(r.total_employer_eis || 0);
        acc.total_employee_eis += Number(r.total_employee_eis || 0);
        acc.total_hrdc += Number(r.total_hrdc || 0);
        acc.total_pcb += Number(r.total_pcb || 0);
        acc.total_allowances += Number(r.total_allowances || 0);
        acc.total_deductions += Number(r.total_deductions || 0);
        return acc;
      }, {
        employee_count: 0, total_gross_salary: 0, total_net_salary: 0, total_director_fee: 0,
        total_employer_epf: 0, total_employee_epf: 0, total_employer_socso: 0, total_employee_socso: 0,
        total_employer_eis: 0, total_employee_eis: 0, total_hrdc: 0, total_pcb: 0,
        total_allowances: 0, total_deductions: 0,
      });

      const memoNumber = `MEMO-${year}-${String(month).padStart(2, '0')}`;

      // Insert memo
      const { data: memo, error: insertErr } = await db
        .from('payroll_memos')
        .insert({
          memo_number: memoNumber,
          pay_period_month: month,
          pay_period_year: year,
          status: 'draft',
          created_by: authData.user.id,
          ...totals,
        })
        .select('id')
        .single();
      if (insertErr) throw insertErr;

      // Link runs to memo
      const runIds = runs.map((r: any) => r.id);
      const { error: linkErr } = await db
        .from('payroll_runs')
        .update({ memo_id: memo.id })
        .in('id', runIds);
      if (linkErr) throw linkErr;

      return memo;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: 'Memo Created', description: 'Consolidated payroll memo created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Delete memo (draft only)
  const deleteMutation = useMutation({
    mutationFn: async (memoId: string) => {
      const db = supabase as any;

      // Verify it's draft
      const { data: memo, error: fetchErr } = await db
        .from('payroll_memos')
        .select('id, status')
        .eq('id', memoId)
        .single();
      if (fetchErr) throw fetchErr;
      if (memo.status !== 'draft') throw new Error('Only draft memos can be deleted');

      // Unlink runs
      const { error: unlinkErr } = await db
        .from('payroll_runs')
        .update({ memo_id: null })
        .eq('memo_id', memoId);
      if (unlinkErr) throw unlinkErr;

      // Delete memo
      const { error: delErr } = await db
        .from('payroll_memos')
        .delete()
        .eq('id', memoId);
      if (delErr) throw delErr;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: 'Deleted', description: 'Memo deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Submit / Approve memo
  const approveMutation = useMutation({
    mutationFn: async (input: { memoId: string; role: PayrollApprovalRole; remarks?: string }) => {
      const db = supabase as any;
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');

      const { data: memo, error: fetchErr } = await db
        .from('payroll_memos')
        .select('id, status')
        .eq('id', input.memoId)
        .single();
      if (fetchErr) throw fetchErr;

      const now = new Date().toISOString();
      let updateData: Record<string, unknown> = {};

      if (input.role === 'hr' && memo.status === 'draft') {
        if (!canTransitionMemo('draft', 'pending_director', 'hr')) {
          throw new Error('Cannot submit this memo');
        }
        updateData = {
          status: 'pending_director',
          hr_id: authData.user.id,
          hr_approved_at: now,
          hr_remarks: input.remarks || null,
        };
        // Lock all linked runs
        await db
          .from('payroll_runs')
          .update({ status: 'locked' })
          .eq('memo_id', input.memoId);

      } else if (input.role === 'management' && memo.status === 'pending_director') {
        if (!canTransitionMemo('pending_director', 'pending_finance', 'management')) {
          throw new Error('Cannot approve this memo');
        }
        // Director approves -> auto-advance to pending_finance
        updateData = {
          status: 'pending_finance',
          director_id: authData.user.id,
          director_approved_at: now,
          director_remarks: input.remarks || null,
        };

      } else if (input.role === 'finance' && memo.status === 'pending_finance') {
        if (!canTransitionMemo('pending_finance', 'finance_approved', 'finance')) {
          throw new Error('Cannot approve this memo');
        }
        updateData = {
          status: 'finance_approved',
          finance_id: authData.user.id,
          finance_approved_at: now,
          finance_remarks: input.remarks || null,
        };

      } else {
        throw new Error(`Cannot approve memo in ${memo.status} state as ${input.role}`);
      }

      const { error } = await db
        .from('payroll_memos')
        .update(updateData)
        .eq('id', input.memoId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: 'Success', description: 'Memo updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Reject memo
  const rejectMutation = useMutation({
    mutationFn: async (input: { memoId: string; role: PayrollApprovalRole; remarks: string }) => {
      const db = supabase as any;
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');
      if (!input.remarks?.trim()) throw new Error('Remarks are required when rejecting');

      const { data: memo, error: fetchErr } = await db
        .from('payroll_memos')
        .select('id, status')
        .eq('id', input.memoId)
        .single();
      if (fetchErr) throw fetchErr;

      if (!canTransitionMemo(memo.status, 'rejected', input.role)) {
        throw new Error(`Cannot reject memo in ${memo.status} state as ${input.role}`);
      }

      const now = new Date().toISOString();
      const { error } = await db
        .from('payroll_memos')
        .update({
          status: 'rejected',
          rejected_by: authData.user.id,
          rejected_at: now,
          rejection_remarks: input.remarks,
          rejection_stage: input.role === 'management' ? 'director' : 'finance',
        })
        .eq('id', input.memoId);
      if (error) throw error;

      // Unlock linked runs back to calculated
      await db
        .from('payroll_runs')
        .update({ status: 'calculated' })
        .eq('memo_id', input.memoId);
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: 'Rejected', description: 'Memo rejected and runs unlocked' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Resubmit rejected memo (re-snapshot totals, reset to pending_director)
  const resubmitMutation = useMutation({
    mutationFn: async (memoId: string) => {
      const db = supabase as any;
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');

      const { data: memo, error: fetchErr } = await db
        .from('payroll_memos')
        .select('id, status')
        .eq('id', memoId)
        .single();
      if (fetchErr) throw fetchErr;
      if (memo.status !== 'rejected') throw new Error('Only rejected memos can be resubmitted');

      // Re-snapshot totals from linked runs
      const { data: runs, error: runsErr } = await db
        .from('payroll_runs')
        .select('employee_count, total_gross_salary, total_net_salary, total_director_fee, total_employer_epf, total_employee_epf, total_employer_socso, total_employee_socso, total_employer_eis, total_employee_eis, total_hrdc, total_pcb, total_allowances, total_deductions')
        .eq('memo_id', memoId);
      if (runsErr) throw runsErr;

      const totals = (runs || []).reduce((acc: Record<string, number>, r: any) => {
        acc.employee_count += Number(r.employee_count || 0);
        acc.total_gross_salary += Number(r.total_gross_salary || 0);
        acc.total_net_salary += Number(r.total_net_salary || 0);
        acc.total_director_fee += Number(r.total_director_fee || 0);
        acc.total_employer_epf += Number(r.total_employer_epf || 0);
        acc.total_employee_epf += Number(r.total_employee_epf || 0);
        acc.total_employer_socso += Number(r.total_employer_socso || 0);
        acc.total_employee_socso += Number(r.total_employee_socso || 0);
        acc.total_employer_eis += Number(r.total_employer_eis || 0);
        acc.total_employee_eis += Number(r.total_employee_eis || 0);
        acc.total_hrdc += Number(r.total_hrdc || 0);
        acc.total_pcb += Number(r.total_pcb || 0);
        acc.total_allowances += Number(r.total_allowances || 0);
        acc.total_deductions += Number(r.total_deductions || 0);
        return acc;
      }, {
        employee_count: 0, total_gross_salary: 0, total_net_salary: 0, total_director_fee: 0,
        total_employer_epf: 0, total_employee_epf: 0, total_employer_socso: 0, total_employee_socso: 0,
        total_employer_eis: 0, total_employee_eis: 0, total_hrdc: 0, total_pcb: 0,
        total_allowances: 0, total_deductions: 0,
      });

      const now = new Date().toISOString();
      const { error } = await db
        .from('payroll_memos')
        .update({
          status: 'pending_director',
          ...totals,
          hr_id: authData.user.id,
          hr_approved_at: now,
          // Clear rejection fields
          rejected_by: null,
          rejected_at: null,
          rejection_remarks: null,
          rejection_stage: null,
          // Clear downstream approvals
          director_id: null,
          director_approved_at: null,
          director_remarks: null,
          finance_id: null,
          finance_approved_at: null,
          finance_remarks: null,
        })
        .eq('id', memoId);
      if (error) throw error;

      // Lock runs again
      await db
        .from('payroll_runs')
        .update({ status: 'locked' })
        .eq('memo_id', memoId);
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: 'Resubmitted', description: 'Memo resubmitted to Director' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Post memo (finance_approved -> posted)
  const postMutation = useMutation({
    mutationFn: async (memoId: string) => {
      const db = supabase as any;
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');

      const { data: memo, error: fetchErr } = await db
        .from('payroll_memos')
        .select('id, status')
        .eq('id', memoId)
        .single();
      if (fetchErr) throw fetchErr;

      if (!canTransitionMemo(memo.status, 'posted', 'finance')) {
        throw new Error('Only finance-approved memos can be posted');
      }

      const now = new Date().toISOString();
      const { error } = await db
        .from('payroll_memos')
        .update({
          status: 'posted',
          is_posted: true,
          posted_at: now,
          posted_by: authData.user.id,
        })
        .eq('id', memoId);
      if (error) throw error;

      // Lock all payroll items across linked runs
      const { data: runs } = await db
        .from('payroll_runs')
        .select('id')
        .eq('memo_id', memoId);

      if (runs && runs.length > 0) {
        const runIds = runs.map((r: any) => r.id);
        await db
          .from('payroll_items')
          .update({ is_locked: true })
          .in('payroll_run_id', runIds);

        // Also mark runs as posted
        await db
          .from('payroll_runs')
          .update({ status: 'posted', is_posted: true, posted_at: now, posted_by: authData.user.id })
          .in('id', runIds);
      }
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: 'Posted', description: 'Payroll memo posted and all items locked' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    memo: query.data ?? null,
    isLoading: query.isLoading,
    createMemo: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    deleteMemo: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    approveMemo: approveMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    rejectMemo: rejectMutation.mutateAsync,
    isRejecting: rejectMutation.isPending,
    resubmitMemo: resubmitMutation.mutateAsync,
    isResubmitting: resubmitMutation.isPending,
    postMemo: postMutation.mutateAsync,
    isPosting: postMutation.isPending,
  };
}
```

**Step 2: Verify types compile**

Run: `bun run tsc --noEmit`

Expected: no errors.

**Step 3: Commit**

```bash
git add src/hooks/payroll/usePayrollMemo.ts && git commit -m "feat: add usePayrollMemo hook with full CRUD and workflow"
```

---

### Task 4: Component — Create `MemoApprovalActions.tsx`

**Files:**
- Create: `src/components/payroll/MemoApprovalActions.tsx`

This component follows the exact same pattern as `src/components/payroll/PayrollApprovalActions.tsx` but operates on the memo entity. It provides role-based buttons (submit, approve, reject, resubmit, post) and dialogs for remarks.

**Step 1: Create the component**

Create `src/components/payroll/MemoApprovalActions.tsx`:

```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, Send, RotateCcw, FileCheck } from 'lucide-react';
import type { PayrollMemo, PayrollApprovalRole } from '@/types/payroll';

interface MemoApprovalActionsProps {
  memo: PayrollMemo;
  role: PayrollApprovalRole;
  onApprove: (input: { memoId: string; role: PayrollApprovalRole; remarks?: string }) => Promise<void>;
  onReject: (input: { memoId: string; role: PayrollApprovalRole; remarks: string }) => Promise<void>;
  onResubmit: (memoId: string) => Promise<void>;
  onPost: (memoId: string) => Promise<void>;
  onDelete: (memoId: string) => Promise<void>;
  isApproving: boolean;
  isRejecting: boolean;
  isResubmitting: boolean;
  isPosting: boolean;
  isDeleting: boolean;
}

type MemoAction = 'submit' | 'approve' | 'reject' | 'resubmit' | 'post' | 'delete';

function getAvailableActions(status: string, role: PayrollApprovalRole): MemoAction[] {
  if (role === 'hr') {
    if (status === 'draft') return ['submit', 'delete'];
    if (status === 'rejected') return ['resubmit', 'delete'];
  }
  if (role === 'management') {
    if (status === 'pending_director') return ['approve', 'reject'];
  }
  if (role === 'finance') {
    if (status === 'pending_finance') return ['approve', 'reject'];
    if (status === 'finance_approved') return ['post'];
  }
  return [];
}

export function MemoApprovalActions({
  memo, role, onApprove, onReject, onResubmit, onPost, onDelete,
  isApproving, isRejecting, isResubmitting, isPosting, isDeleting,
}: MemoApprovalActionsProps) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveRemarks, setApproveRemarks] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  const actions = getAvailableActions(memo.status, role);
  if (actions.length === 0) return null;

  const handleApprove = async () => {
    await onApprove({ memoId: memo.id, role, remarks: approveRemarks || undefined });
    setApproveOpen(false);
    setApproveRemarks('');
  };

  const handleReject = async () => {
    if (!remarks.trim()) return;
    await onReject({ memoId: memo.id, role, remarks });
    setRejectOpen(false);
    setRemarks('');
  };

  const isBusy = isApproving || isRejecting || isResubmitting || isPosting || isDeleting;

  return (
    <div className="flex items-center gap-2">
      {actions.includes('submit') && (
        <Button onClick={() => onApprove({ memoId: memo.id, role })} disabled={isBusy}>
          <Send className="h-4 w-4 mr-2" />
          {isApproving ? 'Submitting...' : 'Submit to Director'}
        </Button>
      )}

      {actions.includes('approve') && (
        <Button onClick={() => setApproveOpen(true)} disabled={isBusy}>
          <CheckCircle className="h-4 w-4 mr-2" />
          {isApproving ? 'Approving...' : 'Approve'}
        </Button>
      )}

      {actions.includes('reject') && (
        <Button variant="destructive" onClick={() => setRejectOpen(true)} disabled={isBusy}>
          <XCircle className="h-4 w-4 mr-2" />
          {isRejecting ? 'Rejecting...' : 'Reject'}
        </Button>
      )}

      {actions.includes('resubmit') && (
        <Button onClick={() => onResubmit(memo.id)} disabled={isBusy}>
          <RotateCcw className="h-4 w-4 mr-2" />
          {isResubmitting ? 'Resubmitting...' : 'Resubmit to Director'}
        </Button>
      )}

      {actions.includes('post') && (
        <Button onClick={() => onPost(memo.id)} disabled={isBusy}>
          <FileCheck className="h-4 w-4 mr-2" />
          {isPosting ? 'Posting...' : 'Post Payroll'}
        </Button>
      )}

      {actions.includes('delete') && (
        <Button variant="outline" onClick={() => setDeleteOpen(true)} disabled={isBusy}>
          {isDeleting ? 'Deleting...' : 'Delete Memo'}
        </Button>
      )}

      {/* Approve dialog */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Payroll Memo</DialogTitle>
            <DialogDescription>Optionally add remarks for this approval.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Remarks (optional)</Label>
            <Textarea value={approveRemarks} onChange={(e) => setApproveRemarks(e.target.value)} placeholder="Add any notes..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
            <Button onClick={handleApprove} disabled={isApproving}>
              {isApproving ? 'Approving...' : 'Confirm Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Payroll Memo</DialogTitle>
            <DialogDescription>Please provide a reason for rejection.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Remarks (required)</Label>
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Reason for rejection..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={isRejecting || !remarks.trim()}>
              {isRejecting ? 'Rejecting...' : 'Confirm Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Memo?</DialogTitle>
            <DialogDescription>This will unlink all payroll runs from this memo. The runs themselves are not deleted.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={async () => { await onDelete(memo.id); setDeleteOpen(false); }} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Step 2: Verify types compile**

Run: `bun run tsc --noEmit`

**Step 3: Commit**

```bash
git add src/components/payroll/MemoApprovalActions.tsx && git commit -m "feat: add MemoApprovalActions component with role-based workflow"
```

---

### Task 5: Component — Create `MemoApprovalTrail.tsx`

**Files:**
- Create: `src/components/payroll/MemoApprovalTrail.tsx`

Follows the pattern in `PayrollMemoView.tsx` lines 68-121 for showing approval/rejection/posting history.

**Step 1: Create the component**

Create `src/components/payroll/MemoApprovalTrail.tsx`:

```typescript
import { Separator } from '@/components/ui/separator';
import type { PayrollMemo } from '@/types/payroll';

interface MemoApprovalTrailProps {
  memo: PayrollMemo;
}

export function MemoApprovalTrail({ memo }: MemoApprovalTrailProps) {
  const hasTrail = memo.hr_approved_at || memo.director_approved_at || memo.finance_approved_at;
  if (!hasTrail && !memo.rejected_at && !memo.posted_at) return null;

  return (
    <div className="space-y-3 text-sm">
      <Separator />
      <p className="font-semibold">Approval Trail</p>

      {memo.hr_approved_at && (
        <p className="text-muted-foreground">
          HR submitted on {new Date(memo.hr_approved_at).toLocaleDateString()}
          {memo.hr_remarks && ` — "${memo.hr_remarks}"`}
        </p>
      )}

      {memo.director_approved_at && (
        <p className="text-muted-foreground">
          Director approved on {new Date(memo.director_approved_at).toLocaleDateString()}
          {memo.director_remarks && ` — "${memo.director_remarks}"`}
        </p>
      )}

      {memo.finance_approved_at && (
        <p className="text-muted-foreground">
          Finance approved on {new Date(memo.finance_approved_at).toLocaleDateString()}
          {memo.finance_remarks && ` — "${memo.finance_remarks}"`}
        </p>
      )}

      {memo.rejected_at && (
        <>
          <Separator />
          <p className="text-destructive font-medium">
            Rejected at {memo.rejection_stage} stage on {new Date(memo.rejected_at).toLocaleDateString()}
          </p>
          {memo.rejection_remarks && (
            <p className="text-muted-foreground">Reason: {memo.rejection_remarks}</p>
          )}
        </>
      )}

      {memo.is_posted && memo.posted_at && (
        <>
          <Separator />
          <p className="text-green-600 font-medium">
            Posted on {new Date(memo.posted_at).toLocaleDateString()}
          </p>
        </>
      )}
    </div>
  );
}
```

**Step 2: Verify types compile**

Run: `bun run tsc --noEmit`

**Step 3: Commit**

```bash
git add src/components/payroll/MemoApprovalTrail.tsx && git commit -m "feat: add MemoApprovalTrail component"
```

---

### Task 6: Refactor — Replace `ConsolidatedPayrollMemo.tsx` with Full Memo Lifecycle

**Files:**
- Modify: `src/components/payroll/ConsolidatedPayrollMemo.tsx`

This is the major refactor. The component gains:
- Memo query via `usePayrollMemo(month, year)`
- Role awareness via `useActiveRole()`
- Conditional rendering based on memo status
- `MemoApprovalActions` for workflow buttons
- `MemoApprovalTrail` for audit history
- Status badge display

**Step 1: Rewrite `ConsolidatedPayrollMemo.tsx`**

Replace the entire content of `src/components/payroll/ConsolidatedPayrollMemo.tsx` with:

```typescript
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FilePlus, Info } from 'lucide-react';
import { useConsolidatedPayrollRuns } from '@/hooks/payroll/useConsolidatedPayrollRuns';
import { usePayrollMemo } from '@/hooks/payroll/usePayrollMemo';
import { useActiveRole } from '@/hooks/useActiveRole';
import { MemoApprovalActions } from './MemoApprovalActions';
import { MemoApprovalTrail } from './MemoApprovalTrail';
import { formatCurrency } from '@/lib/otCalculations';
import { MEMO_STATUS_LABELS } from '@/types/payroll';
import type { PayrollApprovalRole, PayrollMemoStatus } from '@/types/payroll';

const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 3 }, (_, i) => CURRENT_YEAR - 1 + i);

interface SalaryRow {
  label: string;
  key: string;
  isSubtotal?: boolean;
}

const SALARY_ROWS: SalaryRow[] = [
  { label: 'Employee Count', key: 'employee_count' },
  { label: 'Gross Salary', key: 'total_gross_salary' },
  { label: 'Total Allowances', key: 'total_allowances' },
  { label: 'Employee EPF', key: 'total_employee_epf' },
  { label: 'Employer EPF', key: 'total_employer_epf' },
  { label: 'Employee SOCSO', key: 'total_employee_socso' },
  { label: 'Employer SOCSO', key: 'total_employer_socso' },
  { label: 'Employee EIS', key: 'total_employee_eis' },
  { label: 'Employer EIS', key: 'total_employer_eis' },
  { label: 'HRDC', key: 'total_hrdc' },
  { label: 'PCB', key: 'total_pcb' },
  { label: 'Director Fees', key: 'total_director_fee' },
  { label: 'Total Deductions', key: 'total_deductions', isSubtotal: true },
  { label: 'Net Salary', key: 'total_net_salary', isSubtotal: true },
];

function getStatusVariant(status: PayrollMemoStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'posted': return 'default';
    case 'finance_approved': return 'default';
    case 'rejected': return 'destructive';
    default: return 'secondary';
  }
}

export function ConsolidatedPayrollMemo() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const { activeRole } = useActiveRole();

  const { data: runs = [], isLoading: runsLoading } = useConsolidatedPayrollRuns(month, year);
  const {
    memo, isLoading: memoLoading,
    createMemo, isCreating,
    deleteMemo, isDeleting,
    approveMemo, isApproving,
    rejectMemo, isRejecting,
    resubmitMemo, isResubmitting,
    postMemo, isPosting,
  } = usePayrollMemo(month, year);

  const approvalRole: PayrollApprovalRole =
    activeRole === 'management' ? 'management' :
    activeRole === 'finance' ? 'finance' : 'hr';

  const isLoading = runsLoading || memoLoading;

  const companyColumns = runs.map((r) => ({
    id: r.company_id,
    name: r.companies?.code || r.companies?.name || 'Unknown',
    run: r,
  }));

  function getGrandTotal(key: string): number {
    return runs.reduce((sum, r) => sum + Number((r as any)[key] || 0), 0);
  }

  function formatValue(key: string, value: number): string {
    if (key === 'employee_count') return String(value);
    return formatCurrency(value);
  }

  // Check if all runs are ready (have employees calculated)
  const allRunsReady = runs.length > 0 && runs.every((r: any) => r.employee_count > 0);
  const canCreateMemo = !memo && allRunsReady;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">
              Consolidated Payroll Memo
              {memo && (
                <Badge variant={getStatusVariant(memo.status)} className="ml-3">
                  {MEMO_STATUS_LABELS[memo.status] || memo.status}
                </Badge>
              )}
            </CardTitle>
            {memo && (
              <p className="text-sm text-muted-foreground mt-1">{memo.memo_number}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Period selectors */}
            <div className="flex items-center gap-2">
              <Label htmlFor="memo-month">Month</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger id="memo-month" className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.slice(1).map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="memo-year">Year</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger id="memo-year" className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-3">
          {canCreateMemo && approvalRole === 'hr' && (
            <Button onClick={() => createMemo()} disabled={isCreating}>
              <FilePlus className="h-4 w-4 mr-2" />
              {isCreating ? 'Creating...' : 'Create Memo'}
            </Button>
          )}

          {memo && (
            <MemoApprovalActions
              memo={memo}
              role={approvalRole}
              onApprove={approveMemo}
              onReject={rejectMemo}
              onResubmit={resubmitMemo}
              onPost={postMemo}
              onDelete={deleteMemo}
              isApproving={isApproving}
              isRejecting={isRejecting}
              isResubmitting={isResubmitting}
              isPosting={isPosting}
              isDeleting={isDeleting}
            />
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* Readiness warnings */}
        {!memo && runs.length > 0 && !allRunsReady && (
          <Alert className="mb-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Some payroll runs have no calculated employees. Calculate payroll for all companies before creating a memo.
            </AlertDescription>
          </Alert>
        )}

        {memo?.status === 'rejected' && memo.rejection_remarks && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              <strong>Rejected at {memo.rejection_stage} stage:</strong> {memo.rejection_remarks}
            </AlertDescription>
          </Alert>
        )}

        {/* Data table */}
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : runs.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No payroll runs found for {MONTHS[month]} {year}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px]">Component</TableHead>
                  {companyColumns.map((c) => (
                    <TableHead key={c.id} className="text-right min-w-[120px]">{c.name}</TableHead>
                  ))}
                  <TableHead className="text-right min-w-[120px] font-bold">Grand Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SALARY_ROWS.map((row) => (
                  <TableRow key={row.key} className={row.isSubtotal ? 'font-semibold bg-muted/50' : ''}>
                    <TableCell>{row.label}</TableCell>
                    {companyColumns.map((c) => (
                      <TableCell key={c.id} className="text-right">
                        {formatValue(row.key, Number((c.run as any)[row.key] || 0))}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-bold">
                      {formatValue(row.key, getGrandTotal(row.key))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Approval trail */}
        {memo && <MemoApprovalTrail memo={memo} />}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify types compile**

Run: `bun run tsc --noEmit`

**Step 3: Verify the app loads**

Run: `bun run dev` and navigate to `/hr/payroll`, click the "Consolidated" tab. Verify:
- Period selectors work
- Data table shows (if runs exist)
- "Create Memo" button appears when runs are ready and no memo exists
- If a memo exists, status badge and actions show

**Step 4: Commit**

```bash
git add src/components/payroll/ConsolidatedPayrollMemo.tsx && git commit -m "feat: refactor ConsolidatedPayrollMemo with full memo lifecycle"
```

---

### Task 7: Modify `PayrollRunDetail.tsx` — Hide Approval When Linked to Memo

**Files:**
- Modify: `src/pages/hr/PayrollRunDetail.tsx`

When a payroll run has `memo_id` set, individual approval actions should be hidden and a banner shown instead.

**Step 1: Add memo banner**

In `src/pages/hr/PayrollRunDetail.tsx`, add an import for `Alert` and `AlertDescription` at the top (around line 8):

```typescript
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
```

Add `Info` to the existing lucide-react import if it's already there, or add a new import line.

**Step 2: Add memo_id check**

After line 130 (`const isDraft = run.status === 'draft';`), add:

```typescript
const hasMemo = !!(run as any).memo_id;
```

**Step 3: Add banner before approval actions**

Replace the `PayrollApprovalActions` block (lines 157-164) with a conditional:

```typescript
{hasMemo ? (
  <Alert className="flex-1">
    <Info className="h-4 w-4" />
    <AlertDescription>
      This run is part of a consolidated memo. Approval is managed on the Consolidated tab.
    </AlertDescription>
  </Alert>
) : (
  <PayrollApprovalActions
    run={run}
    role={approvalRole}
    onApprove={approval.approvePayrollRun}
    onReject={approval.rejectPayrollRun}
    isApproving={approval.isApproving}
    isRejecting={approval.isRejecting}
  />
)}
```

Also make the "Calculate" and "Add Employee" buttons conditional on not having a memo (or memo being in rejected/draft state):

Replace the `{isDraft && (` condition (line 144) with:

```typescript
{isDraft && !hasMemo && (
```

**Step 4: Verify types compile**

Run: `bun run tsc --noEmit`

**Step 5: Commit**

```bash
git add src/pages/hr/PayrollRunDetail.tsx && git commit -m "feat: hide individual approval actions when run is linked to memo"
```

---

### Task 8: Verify End-to-End Workflow

**Files:** None (manual testing)

**Step 1: Start dev server**

Run: `bun run dev`

**Step 2: Test the full workflow**

Navigate to `/hr/payroll` → Consolidated tab.

1. **No memo state:** Select a month/year with calculated payroll runs. Verify "Create Memo" button is visible.
2. **Create memo:** Click "Create Memo". Verify memo appears with "Draft" badge and "Submit to Director" + "Delete Memo" buttons.
3. **Submit to Director:** Click "Submit to Director". Verify status changes to "Pending Director".
4. **Switch to management role:** Use the role switcher. Verify "Approve" and "Reject" buttons appear.
5. **Approve as Director:** Click "Approve" (add optional remarks). Verify status changes to "Pending Finance".
6. **Switch to finance role:** Verify "Approve" and "Reject" buttons appear.
7. **Approve as Finance:** Verify status changes to "Finance Approved" with "Post Payroll" button.
8. **Post:** Click "Post Payroll". Verify status changes to "Posted" with green badge.
9. **Check run detail:** Navigate to an individual run's detail page. Verify the memo banner shows and individual approval actions are hidden.

**Step 3: Test rejection flow**

1. Create a new memo for a different period.
2. Submit to Director.
3. Switch to management role, click Reject with remarks.
4. Verify memo shows "Rejected" badge with rejection reason.
5. Switch back to HR, verify "Resubmit to Director" button appears.
6. Click Resubmit. Verify memo returns to "Pending Director".

**Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix: address any issues found during e2e testing"
```
