import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ClaimMemo, ClaimMemoApprovalRole, OTBreakdownItem, AllowanceBreakdownItem } from '@/types/claims';
import { canTransitionClaimMemo, CLAIM_FINAL_APPROVED_STATUSES } from '@/types/claims';

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['claim-memo'] });
  queryClient.invalidateQueries({ queryKey: ['claim-memo-preview'] });
  queryClient.invalidateQueries({ queryKey: ['claim-posting'] });
  queryClient.invalidateQueries({ queryKey: ['claim-approvals'] });
  queryClient.invalidateQueries({ queryKey: ['claim-requests'] });
  queryClient.invalidateQueries({ queryKey: ['claims'] });
}

function getMonthRange(month: number, year: number) {
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  return { monthStart, monthEnd };
}

interface TypeAgg {
  name: string;
  code: string;
  count: number;
  total: number;
}

function aggregateClaims(claims: any[]) {
  const byType: Record<string, TypeAgg> = {};
  let totalAmount = 0;

  for (const c of claims) {
    const typeId = c.claim_type_id as string;
    const amount = Number(c.amount || 0);
    totalAmount += amount;

    if (!byType[typeId]) {
      byType[typeId] = {
        name: c.claim_types?.name ?? 'Unknown',
        code: c.claim_types?.code ?? '',
        count: 0,
        total: 0,
      };
    }
    byType[typeId].count += 1;
    byType[typeId].total += amount;
  }

  const typeBreakdown = Object.entries(byType).map(([claim_type_id, v]) => ({
    claim_type_id,
    ...v,
  }));

  return { totalAmount, typeBreakdown, claimCount: claims.length };
}

function aggregateOT(otRequests: any[]): { otTotalAmount: number; otCount: number; otBreakdown: OTBreakdownItem[] } {
  const byEmployee: Record<string, OTBreakdownItem> = {};
  let otTotalAmount = 0;

  for (const ot of otRequests) {
    const empId = ot.employee_id as string;
    const amount = Number(ot.ot_amount || 0);
    const hours = Number(ot.total_hours || 0);
    otTotalAmount += amount;

    if (!byEmployee[empId]) {
      byEmployee[empId] = {
        employee_id: empId,
        employee_name: ot.profiles?.full_name ?? 'Unknown',
        hours: 0,
        amount: 0,
      };
    }
    byEmployee[empId].hours += hours;
    byEmployee[empId].amount += amount;
  }

  return { otTotalAmount, otCount: otRequests.length, otBreakdown: Object.values(byEmployee) };
}

function aggregateAllowances(allowances: any[]): { allowanceTotalAmount: number; allowanceCount: number; allowanceBreakdown: AllowanceBreakdownItem[] } {
  const byType: Record<string, AllowanceBreakdownItem> = {};
  let allowanceTotalAmount = 0;

  for (const a of allowances) {
    const typeId = a.allowance_type_id as string;
    const amount = Number(a.amount || 0);
    allowanceTotalAmount += amount;

    if (!byType[typeId]) {
      byType[typeId] = {
        allowance_type_id: typeId,
        name: a.allowance_types?.name ?? 'Unknown',
        code: a.allowance_types?.code ?? '',
        count: 0,
        total: 0,
      };
    }
    byType[typeId].count += 1;
    byType[typeId].total += amount;
  }

  return { allowanceTotalAmount, allowanceCount: allowances.length, allowanceBreakdown: Object.values(byType) };
}

export function useClaimMemoPreview(month: number, year: number, enabled: boolean) {
  const db = supabase as any;
  const { monthStart, monthEnd } = getMonthRange(month, year);

  return useQuery({
    queryKey: ['claim-memo-preview', month, year],
    queryFn: async () => {
      // Fetch claims
      const { data: claims, error: claimsErr } = await db
        .from('claims')
        .select('id, amount, claim_type_id, claim_date, claim_types(id, name, code), profiles:profiles!claims_employee_id_fkey(full_name)')
        .in('status', CLAIM_FINAL_APPROVED_STATUSES)
        .eq('is_posted', false)
        .is('memo_id', null)
        .gte('claim_date', monthStart)
        .lt('claim_date', monthEnd)
        .order('claim_date', { ascending: true });

      if (claimsErr) throw claimsErr;

      // Fetch management-approved OT for the period
      const { data: otRequests, error: otErr } = await db
        .from('ot_requests')
        .select('id, employee_id, ot_amount, total_hours, ot_date, profiles:profiles!ot_requests_employee_id_fkey(full_name)')
        .eq('status', 'management_approved')
        .gte('ot_date', monthStart)
        .lt('ot_date', monthEnd);

      if (otErr) throw otErr;

      // Fetch allowances from finalized payroll runs for the period
      const { data: allowances, error: allowErr } = await db
        .from('payroll_item_allowances')
        .select('id, allowance_type_id, amount, allowance_types(id, name, code), payroll_items!inner(payroll_run_id, payroll_runs!inner(pay_period_month, pay_period_year, status))')
        .eq('payroll_items.payroll_runs.pay_period_month', month)
        .eq('payroll_items.payroll_runs.pay_period_year', year)
        .eq('payroll_items.payroll_runs.status', 'finalized');

      if (allowErr) throw allowErr;

      return {
        claims: (claims || []) as any[],
        otRequests: (otRequests || []) as any[],
        allowances: (allowances || []) as any[],
      };
    },
    enabled,
    staleTime: 20 * 1000,
  });
}

export function useClaimMemo(month: number, year: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const db = supabase as any;

  const {
    data: memo = null,
    isLoading,
    ...queryRest
  } = useQuery({
    queryKey: ['claim-memo', month, year],
    queryFn: async () => {
      const { data, error } = await db
        .from('claim_memos')
        .select('*')
        .eq('pay_period_month', month)
        .eq('pay_period_year', year)
        .maybeSingle();

      if (error) throw error;
      return (data as ClaimMemo) ?? null;
    },
    staleTime: 20 * 1000,
  });

  // ── createMemo ──
  const createMemoMutation = useMutation({
    mutationFn: async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');

      const { data: existing } = await db
        .from('claim_memos')
        .select('id')
        .eq('pay_period_month', month)
        .eq('pay_period_year', year)
        .maybeSingle();

      if (existing) throw new Error('A claim memo already exists for this period');

      const { monthStart, monthEnd } = getMonthRange(month, year);

      // Fetch claims
      const { data: claims, error: claimsErr } = await db
        .from('claims')
        .select('id, amount, claim_type_id, claim_types(id, name, code)')
        .in('status', CLAIM_FINAL_APPROVED_STATUSES)
        .eq('is_posted', false)
        .is('memo_id', null)
        .gte('claim_date', monthStart)
        .lt('claim_date', monthEnd);

      if (claimsErr) throw claimsErr;

      // Fetch management-approved OT for the period
      const { data: otRequests, error: otErr } = await db
        .from('ot_requests')
        .select('id, employee_id, ot_amount, total_hours, ot_date, profiles:profiles!ot_requests_employee_id_fkey(full_name)')
        .eq('status', 'management_approved')
        .gte('ot_date', monthStart)
        .lt('ot_date', monthEnd);

      if (otErr) throw otErr;

      // Fetch allowances from finalized payroll runs for the period
      const { data: allowances, error: allowErr } = await db
        .from('payroll_item_allowances')
        .select('id, allowance_type_id, amount, allowance_types(id, name, code), payroll_items!inner(payroll_run_id, payroll_runs!inner(pay_period_month, pay_period_year, status))')
        .eq('payroll_items.payroll_runs.pay_period_month', month)
        .eq('payroll_items.payroll_runs.pay_period_year', year)
        .eq('payroll_items.payroll_runs.status', 'finalized');

      if (allowErr) throw allowErr;

      const hasClaims = claims && claims.length > 0;
      const hasOT = otRequests && otRequests.length > 0;
      const hasAllowances = allowances && allowances.length > 0;

      if (!hasClaims && !hasOT && !hasAllowances) {
        throw new Error('No approved claims, OT, or allowances found for this period');
      }

      const { totalAmount, typeBreakdown, claimCount } = aggregateClaims(claims || []);
      const { otTotalAmount, otCount, otBreakdown } = aggregateOT(otRequests || []);
      const { allowanceTotalAmount, allowanceCount, allowanceBreakdown } = aggregateAllowances(allowances || []);
      const grandTotal = totalAmount + otTotalAmount + allowanceTotalAmount;

      const memoNumber = `MEMO-${year}-${String(month).padStart(2, '0')}`;

      const { data: memoData, error: insertErr } = await db
        .from('claim_memos')
        .insert({
          memo_number: memoNumber,
          pay_period_month: month,
          pay_period_year: year,
          status: 'draft',
          total_amount: totalAmount,
          claim_count: claimCount,
          type_breakdown: typeBreakdown,
          ot_total_amount: otTotalAmount,
          ot_count: otCount,
          ot_breakdown: otBreakdown,
          allowance_total_amount: allowanceTotalAmount,
          allowance_count: allowanceCount,
          allowance_breakdown: allowanceBreakdown,
          grand_total: grandTotal,
          created_by: authData.user.id,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      // Link claims to memo
      if (hasClaims) {
        const claimIds = claims.map((c: any) => c.id);
        const { error: linkErr } = await db
          .from('claims')
          .update({ memo_id: memoData.id })
          .in('id', claimIds);

        if (linkErr) throw linkErr;
      }

      return memoData as ClaimMemo;
    },
    onSuccess: () => {
      invalidateAll(queryClient);
      toast({ title: 'Created', description: 'Claim memo created' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // ── deleteMemo ──
  const deleteMemoMutation = useMutation({
    mutationFn: async (memoId: string) => {
      const { data: current, error: fetchErr } = await db
        .from('claim_memos')
        .select('id, status')
        .eq('id', memoId)
        .single();

      if (fetchErr) throw fetchErr;
      if (current.status !== 'draft' && current.status !== 'rejected') {
        throw new Error('Only draft or rejected memos can be deleted');
      }

      const { error: unlinkErr } = await db
        .from('claims')
        .update({ memo_id: null, is_memo_locked: false })
        .eq('memo_id', memoId);

      if (unlinkErr) throw unlinkErr;

      const { error: deleteErr } = await db
        .from('claim_memos')
        .delete()
        .eq('id', memoId);

      if (deleteErr) throw deleteErr;
    },
    onSuccess: () => {
      invalidateAll(queryClient);
      toast({ title: 'Deleted', description: 'Claim memo deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // ── approveMemo ──
  const approveMemoMutation = useMutation({
    mutationFn: async (input: { memoId: string; role: ClaimMemoApprovalRole; remarks?: string }) => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');

      const { data: current, error: fetchErr } = await db
        .from('claim_memos')
        .select('id, status')
        .eq('id', input.memoId)
        .single();

      if (fetchErr) throw fetchErr;
      const now = new Date().toISOString();
      let updateData: Record<string, unknown> = {};

      if (input.role === 'hr' && current.status === 'draft') {
        if (!canTransitionClaimMemo('draft', 'pending_director', 'hr')) {
          throw new Error('Cannot submit this memo as HR');
        }
        updateData = {
          status: 'pending_director',
          hr_id: authData.user.id,
          hr_approved_at: now,
          hr_remarks: input.remarks || null,
        };

        const { error: lockErr } = await db
          .from('claims')
          .update({ is_memo_locked: true })
          .eq('memo_id', input.memoId);

        if (lockErr) throw lockErr;

      } else if (input.role === 'management' && current.status === 'pending_director') {
        if (!canTransitionClaimMemo('pending_director', 'pending_finance', 'management')) {
          throw new Error('Cannot approve this memo as Director');
        }
        updateData = {
          status: 'pending_finance',
          director_id: authData.user.id,
          director_approved_at: now,
          director_remarks: input.remarks || null,
        };

      } else if (input.role === 'finance' && current.status === 'pending_finance') {
        if (!canTransitionClaimMemo('pending_finance', 'finance_approved', 'finance')) {
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
        .from('claim_memos')
        .update(updateData)
        .eq('id', input.memoId);

      if (updateErr) throw updateErr;
    },
    onSuccess: () => {
      invalidateAll(queryClient);
      toast({ title: 'Approved', description: 'Claim memo approved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // ── rejectMemo ──
  const rejectMemoMutation = useMutation({
    mutationFn: async (input: { memoId: string; role: ClaimMemoApprovalRole; remarks: string }) => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');

      if (!input.remarks?.trim()) throw new Error('Remarks are required when rejecting');

      const { data: current, error: fetchErr } = await db
        .from('claim_memos')
        .select('id, status')
        .eq('id', input.memoId)
        .single();

      if (fetchErr) throw fetchErr;
      if (!canTransitionClaimMemo(current.status, 'rejected', input.role)) {
        throw new Error(`Cannot reject memo in ${current.status} state as ${input.role}`);
      }

      const now = new Date().toISOString();

      const { error: updateErr } = await db
        .from('claim_memos')
        .update({
          status: 'rejected',
          rejected_by: authData.user.id,
          rejected_at: now,
          rejection_remarks: input.remarks,
          rejection_stage: input.role,
        })
        .eq('id', input.memoId);

      if (updateErr) throw updateErr;

      const { error: unlockErr } = await db
        .from('claims')
        .update({ is_memo_locked: false })
        .eq('memo_id', input.memoId);

      if (unlockErr) throw unlockErr;
    },
    onSuccess: () => {
      invalidateAll(queryClient);
      toast({ title: 'Rejected', description: 'Claim memo rejected' });
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
        .from('claim_memos')
        .select('id, status, pay_period_month, pay_period_year')
        .eq('id', memoId)
        .single();

      if (fetchErr) throw fetchErr;
      if (current.status !== 'rejected') {
        throw new Error('Only rejected memos can be resubmitted');
      }

      // Re-fetch memo to get period info
      const memoMonth = current.pay_period_month ?? month;
      const memoYear = current.pay_period_year ?? year;
      const { monthStart, monthEnd } = getMonthRange(memoMonth, memoYear);

      const { data: linkedClaims, error: claimsErr } = await db
        .from('claims')
        .select('id, amount, claim_type_id, claim_types(id, name, code)')
        .eq('memo_id', memoId)
        .in('status', CLAIM_FINAL_APPROVED_STATUSES)
        .eq('is_posted', false);

      if (claimsErr) throw claimsErr;

      // Re-fetch OT
      const { data: otRequests, error: otErr } = await db
        .from('ot_requests')
        .select('id, employee_id, ot_amount, total_hours, ot_date, profiles:profiles!ot_requests_employee_id_fkey(full_name)')
        .eq('status', 'management_approved')
        .gte('ot_date', monthStart)
        .lt('ot_date', monthEnd);

      if (otErr) throw otErr;

      // Re-fetch allowances
      const { data: allowances, error: allowErr } = await db
        .from('payroll_item_allowances')
        .select('id, allowance_type_id, amount, allowance_types(id, name, code), payroll_items!inner(payroll_run_id, payroll_runs!inner(pay_period_month, pay_period_year, status))')
        .eq('payroll_items.payroll_runs.pay_period_month', memoMonth)
        .eq('payroll_items.payroll_runs.pay_period_year', memoYear)
        .eq('payroll_items.payroll_runs.status', 'finalized');

      if (allowErr) throw allowErr;

      const { totalAmount, typeBreakdown, claimCount } = aggregateClaims(linkedClaims || []);
      const { otTotalAmount, otCount, otBreakdown } = aggregateOT(otRequests || []);
      const { allowanceTotalAmount, allowanceCount, allowanceBreakdown } = aggregateAllowances(allowances || []);
      const grandTotal = totalAmount + otTotalAmount + allowanceTotalAmount;
      const now = new Date().toISOString();

      const { error: updateErr } = await db
        .from('claim_memos')
        .update({
          total_amount: totalAmount,
          claim_count: claimCount,
          type_breakdown: typeBreakdown,
          ot_total_amount: otTotalAmount,
          ot_count: otCount,
          ot_breakdown: otBreakdown,
          allowance_total_amount: allowanceTotalAmount,
          allowance_count: allowanceCount,
          allowance_breakdown: allowanceBreakdown,
          grand_total: grandTotal,
          status: 'pending_director',
          hr_id: authData.user.id,
          hr_approved_at: now,
          hr_remarks: null,
          director_id: null,
          director_approved_at: null,
          director_remarks: null,
          finance_id: null,
          finance_approved_at: null,
          finance_remarks: null,
          rejected_by: null,
          rejected_at: null,
          rejection_remarks: null,
          rejection_stage: null,
        })
        .eq('id', memoId);

      if (updateErr) throw updateErr;

      const { error: lockErr } = await db
        .from('claims')
        .update({ is_memo_locked: true })
        .eq('memo_id', memoId);

      if (lockErr) throw lockErr;
    },
    onSuccess: () => {
      invalidateAll(queryClient);
      toast({ title: 'Resubmitted', description: 'Claim memo resubmitted for approval' });
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
        .from('claim_memos')
        .select('*')
        .eq('id', memoId)
        .single();

      if (fetchErr) throw fetchErr;
      if (current.status !== 'finance_approved') {
        throw new Error('Only finance-approved memos can be posted');
      }

      const now = new Date().toISOString();

      const { error: memoUpdateErr } = await db
        .from('claim_memos')
        .update({ status: 'posted', is_posted: true, posted_at: now, posted_by: authData.user.id })
        .eq('id', memoId);

      if (memoUpdateErr) throw memoUpdateErr;

      const { error: claimsUpdateErr } = await db
        .from('claims')
        .update({ is_posted: true, posted_at: now, posted_by: authData.user.id, is_memo_locked: false })
        .eq('memo_id', memoId);

      if (claimsUpdateErr) throw claimsUpdateErr;

      // ── Auto-create draft PV for claim memo payout ──
      // Get company_id from the posting user's profile
      const { data: userProfile } = await db
        .from('profiles')
        .select('company_id')
        .eq('id', authData.user.id)
        .single();

      const companyId = userProfile?.company_id;
      if (!companyId) return;

      // Get company's default bank account
      const { data: companyProfile } = await db
        .from('finance_company_profiles')
        .select('default_bank_account_id')
        .eq('company_id', companyId)
        .maybeSingle();

      const bankAccountId = companyProfile?.default_bank_account_id;
      if (!bankAccountId) {
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
      const claimTotal = Number(current.total_amount || 0);
      const otTotal = Number(current.ot_total_amount || 0);
      const allowanceTotal = Number(current.allowance_total_amount || 0);
      const grandTotal = Number(current.grand_total || 0);

      const pvLines: { line_date: string; description: string; amount: number; sort_order: number }[] = [];
      let sort = 0;

      if (claimTotal > 0) {
        pvLines.push({ line_date: paymentDate, description: 'Claims', amount: claimTotal, sort_order: sort++ });
      }
      if (otTotal > 0) {
        pvLines.push({ line_date: paymentDate, description: 'Overtime', amount: otTotal, sort_order: sort++ });
      }
      if (allowanceTotal > 0) {
        pvLines.push({ line_date: paymentDate, description: 'Allowances', amount: allowanceTotal, sort_order: sort++ });
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
          pay_to: company?.name || 'Claims',
          pay_for: `Claims & OT - ${periodLabel}`,
          total_amount: grandTotal,
          status: 'draft',
          post_to_type: 'cashbook',
          remarks: `Auto-generated from ${current.memo_number}`,
          source_type: 'claim_memo',
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
      toast({ title: 'Posted', description: 'Claim memo posted — draft PV created' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    memo,
    isLoading,
    ...queryRest,
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
