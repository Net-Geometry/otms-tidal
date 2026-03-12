import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { PayrollMemo, PayrollApprovalRole } from '@/types/payroll';
import { canTransitionMemo } from '@/types/payroll';

const AGGREGATE_FIELDS = [
  'employee_count',
  'total_gross_salary',
  'total_net_salary',
  'total_director_fee',
  'total_employer_epf',
  'total_employee_epf',
  'total_employer_socso',
  'total_employee_socso',
  'total_employer_eis',
  'total_employee_eis',
  'total_hrdc',
  'total_pcb',
  'total_allowances',
  'total_deductions',
] as const;

type AggregatableRun = Record<(typeof AGGREGATE_FIELDS)[number], number>;

function aggregateRuns(runs: AggregatableRun[]) {
  const totals: Record<string, number> = {};
  for (const field of AGGREGATE_FIELDS) {
    totals[field] = runs.reduce((sum, r) => sum + (Number(r[field]) || 0), 0);
  }
  return totals;
}

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['payroll-memo'] });
  queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
  queryClient.invalidateQueries({ queryKey: ['consolidated-payroll-runs'] });
}

export function usePayrollMemo(month: number, year: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const db = supabase as any;

  // ── Query: fetch the single memo for this period ──
  const {
    data: memo = null,
    isLoading,
    ...queryRest
  } = useQuery({
    queryKey: ['payroll-memo', month, year],
    queryFn: async () => {
      const { data, error } = await db
        .from('payroll_memos')
        .select('*')
        .eq('pay_period_month', month)
        .eq('pay_period_year', year)
        .maybeSingle();

      if (error) throw error;
      return (data as PayrollMemo) ?? null;
    },
    staleTime: 20 * 1000,
  });

  // ── createMemo ──
  const createMemoMutation = useMutation({
    mutationFn: async () => {
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

      if (existing) {
        throw new Error('A payroll memo already exists for this period');
      }

      // Fetch all runs for period where memo_id is null
      const { data: runs, error: runsErr } = await db
        .from('payroll_runs')
        .select('*')
        .eq('pay_period_month', month)
        .eq('pay_period_year', year)
        .is('memo_id', null);

      if (runsErr) throw runsErr;
      if (!runs || runs.length === 0) {
        throw new Error('No payroll runs found for this period');
      }

      // Verify all runs have employee_count > 0
      const emptyRuns = runs.filter((r: any) => !r.employee_count || r.employee_count <= 0);
      if (emptyRuns.length > 0) {
        throw new Error('All payroll runs must have employees before creating a memo');
      }

      // Aggregate totals
      const totals = aggregateRuns(runs as AggregatableRun[]);

      // Generate memo number
      const memoNumber = `MEMO-${year}-${String(month).padStart(2, '0')}`;

      // Insert memo
      const { data: memoData, error: insertErr } = await db
        .from('payroll_memos')
        .insert({
          memo_number: memoNumber,
          pay_period_month: month,
          pay_period_year: year,
          status: 'draft',
          created_by: authData.user.id,
          ...totals,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      // Link all runs to memo
      const runIds = runs.map((r: any) => r.id);
      const { error: linkErr } = await db
        .from('payroll_runs')
        .update({ memo_id: memoData.id })
        .in('id', runIds);

      if (linkErr) throw linkErr;

      return memoData as PayrollMemo;
    },
    onSuccess: () => {
      invalidateAll(queryClient);
      toast({ title: 'Created', description: 'Payroll memo created' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // ── deleteMemo ──
  const deleteMemoMutation = useMutation({
    mutationFn: async (memoId: string) => {
      // Verify draft status
      const { data: current, error: fetchErr } = await db
        .from('payroll_memos')
        .select('id, status')
        .eq('id', memoId)
        .single();

      if (fetchErr) throw fetchErr;
      if (current.status !== 'draft' && current.status !== 'rejected') {
        throw new Error('Only draft or rejected memos can be deleted');
      }

      // Unlink runs
      const { error: unlinkErr } = await db
        .from('payroll_runs')
        .update({ memo_id: null })
        .eq('memo_id', memoId);

      if (unlinkErr) throw unlinkErr;

      // Delete memo
      const { error: deleteErr } = await db
        .from('payroll_memos')
        .delete()
        .eq('id', memoId);

      if (deleteErr) throw deleteErr;
    },
    onSuccess: () => {
      invalidateAll(queryClient);
      toast({ title: 'Deleted', description: 'Payroll memo deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // ── approveMemo ──
  const approveMemoMutation = useMutation({
    mutationFn: async (input: { memoId: string; role: PayrollApprovalRole; remarks?: string }) => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');

      const { data: current, error: fetchErr } = await db
        .from('payroll_memos')
        .select('id, status')
        .eq('id', input.memoId)
        .single();

      if (fetchErr) throw fetchErr;
      const now = new Date().toISOString();
      let updateData: Record<string, unknown> = {};

      if (input.role === 'hr' && current.status === 'draft') {
        if (!canTransitionMemo('draft', 'pending_director', 'hr')) {
          throw new Error('Cannot approve this memo as HR');
        }
        updateData = {
          status: 'pending_director',
          hr_id: authData.user.id,
          hr_approved_at: now,
          hr_remarks: input.remarks || null,
        };

        // Lock linked runs
        const { error: lockErr } = await db
          .from('payroll_runs')
          .update({ status: 'locked' })
          .eq('memo_id', input.memoId);

        if (lockErr) throw lockErr;
      } else if ((input.role === 'management' || input.role === 'dmd') && current.status === 'pending_director') {
        if (!canTransitionMemo('pending_director', 'pending_finance', 'management')) {
          throw new Error('Cannot approve this memo as Director');
        }
        updateData = {
          status: 'pending_finance',
          director_id: authData.user.id,
          director_approved_at: now,
          director_remarks: input.remarks || null,
        };
      } else if (input.role === 'finance' && current.status === 'pending_finance') {
        if (!canTransitionMemo('pending_finance', 'finance_approved', 'finance')) {
          throw new Error('Cannot approve this memo as Finance');
        }
        updateData = {
          status: 'finance_approved',
          finance_id: authData.user.id,
          finance_approved_at: now,
          finance_remarks: input.remarks || null,
        };
      } else {
        throw new Error(`Cannot approve memo in ${current.status} state as ${input.role}`);
      }

      const { error: updateErr } = await db
        .from('payroll_memos')
        .update(updateData)
        .eq('id', input.memoId);

      if (updateErr) throw updateErr;
    },
    onSuccess: () => {
      invalidateAll(queryClient);
      toast({ title: 'Approved', description: 'Payroll memo approved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // ── rejectMemo ──
  const rejectMemoMutation = useMutation({
    mutationFn: async (input: { memoId: string; role: PayrollApprovalRole; remarks: string }) => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');

      if (!input.remarks?.trim()) {
        throw new Error('Remarks are required when rejecting');
      }

      const { data: current, error: fetchErr } = await db
        .from('payroll_memos')
        .select('id, status')
        .eq('id', input.memoId)
        .single();

      if (fetchErr) throw fetchErr;

      if (!canTransitionMemo(current.status, 'rejected', input.role)) {
        throw new Error(`Cannot reject memo in ${current.status} state as ${input.role}`);
      }

      const now = new Date().toISOString();

      // Update memo to rejected
      const { error: updateErr } = await db
        .from('payroll_memos')
        .update({
          status: 'rejected',
          rejected_by: authData.user.id,
          rejected_at: now,
          rejection_remarks: input.remarks,
          rejection_stage: input.role,
        })
        .eq('id', input.memoId);

      if (updateErr) throw updateErr;

      // Unlock linked runs
      const { error: unlockErr } = await db
        .from('payroll_runs')
        .update({ status: 'calculated' })
        .eq('memo_id', input.memoId);

      if (unlockErr) throw unlockErr;
    },
    onSuccess: () => {
      invalidateAll(queryClient);
      toast({ title: 'Rejected', description: 'Payroll memo rejected' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // ── resubmitMemo ──
  const resubmitMemoMutation = useMutation({
    mutationFn: async (memoId: string) => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');

      const { data: current, error: fetchErr } = await db
        .from('payroll_memos')
        .select('id, status')
        .eq('id', memoId)
        .single();

      if (fetchErr) throw fetchErr;
      if (current.status !== 'rejected') {
        throw new Error('Only rejected memos can be resubmitted');
      }

      // Re-snapshot totals from linked runs
      const { data: runs, error: runsErr } = await db
        .from('payroll_runs')
        .select('*')
        .eq('memo_id', memoId);

      if (runsErr) throw runsErr;
      const totals = aggregateRuns((runs || []) as AggregatableRun[]);

      const now = new Date().toISOString();

      // Clear rejection fields, clear downstream approvals, set HR approval, move to pending_director
      const { error: updateErr } = await db
        .from('payroll_memos')
        .update({
          ...totals,
          status: 'pending_director',
          // Set HR approval with current user
          hr_id: authData.user.id,
          hr_approved_at: now,
          hr_remarks: null,
          // Clear downstream approvals
          director_id: null,
          director_approved_at: null,
          director_remarks: null,
          finance_id: null,
          finance_approved_at: null,
          finance_remarks: null,
          // Clear rejection fields
          rejected_by: null,
          rejected_at: null,
          rejection_remarks: null,
          rejection_stage: null,
        })
        .eq('id', memoId);

      if (updateErr) throw updateErr;

      // Lock linked runs again
      const { error: lockErr } = await db
        .from('payroll_runs')
        .update({ status: 'locked' })
        .eq('memo_id', memoId);

      if (lockErr) throw lockErr;
    },
    onSuccess: () => {
      invalidateAll(queryClient);
      toast({ title: 'Resubmitted', description: 'Payroll memo resubmitted for approval' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // ── postMemo ──
  const postMemoMutation = useMutation({
    mutationFn: async (memoId: string) => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');

      const { data: current, error: fetchErr } = await db
        .from('payroll_memos')
        .select('*')
        .eq('id', memoId)
        .single();

      if (fetchErr) throw fetchErr;
      if (current.status !== 'finance_approved') {
        throw new Error('Only finance-approved memos can be posted');
      }

      const now = new Date().toISOString();

      // Post the memo
      const { error: updateErr } = await db
        .from('payroll_memos')
        .update({
          is_posted: true,
          posted_at: now,
          posted_by: authData.user.id,
          status: 'posted',
        })
        .eq('id', memoId);

      if (updateErr) throw updateErr;

      // Get linked runs (need company_id for PV creation)
      const { data: runs, error: runsErr } = await db
        .from('payroll_runs')
        .select('id, company_id')
        .eq('memo_id', memoId);

      if (runsErr) throw runsErr;
      const runIds = (runs || []).map((r: any) => r.id);

      if (runIds.length > 0) {
        // Lock all payroll_items across linked runs
        const { error: lockItemsErr } = await db
          .from('payroll_items')
          .update({ is_locked: true })
          .in('payroll_run_id', runIds);

        if (lockItemsErr) throw lockItemsErr;

        // Mark linked runs as posted
        const { error: postRunsErr } = await db
          .from('payroll_runs')
          .update({
            status: 'posted',
            is_posted: true,
            posted_at: now,
            posted_by: authData.user.id,
          })
          .in('id', runIds);

        if (postRunsErr) throw postRunsErr;
      }

      // ── Auto-create draft PV for net salary payout ──
      const companyId = (runs || [])[0]?.company_id;
      if (!companyId) return; // No runs = no PV

      // Get company's default bank account
      const { data: companyProfile } = await db
        .from('finance_company_profiles')
        .select('default_bank_account_id')
        .eq('company_id', companyId)
        .maybeSingle();

      const bankAccountId = companyProfile?.default_bank_account_id;
      if (!bankAccountId) {
        // No default bank account configured — skip PV creation silently
        console.warn('Skipping auto PV creation: no default bank account configured for company');
        return;
      }

      // Get company name for pay_to
      const { data: company } = await db
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .single();

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const periodLabel = `${monthNames[current.pay_period_month - 1]} ${current.pay_period_year}`;

      // Generate PV number
      const paymentDate = now.slice(0, 10);
      const { data: pvNumber, error: seqErr } = await db.rpc('finance_next_document_number', {
        p_company_id: companyId,
        p_prefix: 'PV',
        p_doc_date: paymentDate,
      });
      if (seqErr) throw seqErr;

      // Build PV line items breakdown
      const grossSalary = Number(current.total_gross_salary || 0);
      const employeeEpf = Number(current.total_employee_epf || 0);
      const employeeSocso = Number(current.total_employee_socso || 0);
      const employeeEis = Number(current.total_employee_eis || 0);
      const pcb = Number(current.total_pcb || 0);
      const deductions = Number(current.total_deductions || 0);
      const netSalary = Number(current.total_net_salary || 0);

      const pvLines: { line_date: string; description: string; amount: number; sort_order: number }[] = [];
      let sort = 0;

      if (grossSalary > 0) {
        pvLines.push({ line_date: paymentDate, description: 'Gross Salary', amount: grossSalary, sort_order: sort++ });
      }
      if (employeeEpf > 0) {
        pvLines.push({ line_date: paymentDate, description: 'Less: Employee EPF', amount: -employeeEpf, sort_order: sort++ });
      }
      if (employeeSocso > 0) {
        pvLines.push({ line_date: paymentDate, description: 'Less: Employee SOCSO', amount: -employeeSocso, sort_order: sort++ });
      }
      if (employeeEis > 0) {
        pvLines.push({ line_date: paymentDate, description: 'Less: Employee EIS', amount: -employeeEis, sort_order: sort++ });
      }
      if (pcb > 0) {
        pvLines.push({ line_date: paymentDate, description: 'Less: PCB/MTD', amount: -pcb, sort_order: sort++ });
      }
      if (deductions > 0) {
        pvLines.push({ line_date: paymentDate, description: 'Less: Other Deductions', amount: -deductions, sort_order: sort++ });
      }

      // Insert draft PV
      const { data: pv, error: pvErr } = await db
        .from('payment_vouchers')
        .insert({
          company_id: companyId,
          pv_number: pvNumber,
          supplier_id: null,
          bank_account_id: bankAccountId,
          payment_date: paymentDate,
          payment_method: 'online_transfer',
          pay_to: company?.name || 'Payroll',
          pay_for: `Payroll - ${periodLabel}`,
          total_amount: netSalary,
          status: 'draft',
          post_to_type: 'cashbook',
          remarks: `Auto-generated from ${current.memo_number}`,
          source_type: 'payroll_memo',
          source_id: memoId,
        })
        .select('id')
        .single();

      if (pvErr) throw pvErr;

      // Insert PV lines
      if (pvLines.length > 0 && pv?.id) {
        const { error: linesErr } = await db
          .from('payment_voucher_lines')
          .insert(pvLines.map((line) => ({ pv_id: pv.id, ...line })));

        if (linesErr) throw linesErr;
      }
    },
    onSuccess: () => {
      invalidateAll(queryClient);
      queryClient.invalidateQueries({ queryKey: ['payment-vouchers'] });
      toast({ title: 'Posted', description: 'Payroll memo posted — draft PV created' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    memo,
    isLoading,
    createMemo: createMemoMutation.mutateAsync,
    isCreating: createMemoMutation.isPending,
    deleteMemo: deleteMemoMutation.mutateAsync,
    isDeleting: deleteMemoMutation.isPending,
    approveMemo: approveMemoMutation.mutateAsync,
    isApproving: approveMemoMutation.isPending,
    rejectMemo: rejectMemoMutation.mutateAsync,
    isRejecting: rejectMemoMutation.isPending,
    resubmitMemo: resubmitMemoMutation.mutateAsync,
    isResubmitting: resubmitMemoMutation.isPending,
    postMemo: postMemoMutation.mutateAsync,
    isPosting: postMemoMutation.isPending,
  };
}
