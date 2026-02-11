import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { PayrollRun, PayrollRunStatus, PayrollApprovalRole } from '@/types/payroll';
import { PAYROLL_STATUS_TRANSITIONS, canTransitionPayroll } from '@/types/payroll';

export type PayrollApprovalTab = 'pending' | 'approved' | 'rejected' | 'all';

function getStatusFilter(role: PayrollApprovalRole, tab: PayrollApprovalTab): PayrollRunStatus[] | null {
  if (tab === 'all') return null;
  if (tab === 'rejected') return ['rejected', 'cancelled'];

  if (tab === 'pending') {
    if (role === 'hr') return ['pending_hr_review', 'draft'];
    if (role === 'management') return ['pending_director'];
    return ['pending_finance'];
  }

  // approved
  if (role === 'hr') return ['hr_approved', 'pending_director', 'director_approved', 'pending_finance', 'finance_approved', 'posted'];
  if (role === 'management') return ['director_approved', 'pending_finance', 'finance_approved', 'posted'];
  return ['finance_approved', 'posted'];
}

export function usePayrollApproval(options: { role: PayrollApprovalRole; tab?: PayrollApprovalTab }) {
  const { role } = options;
  const tab = options.tab ?? 'pending';
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const queryKey = ['payroll-approvals', role, tab];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const db = supabase as any;
      let q = db
        .from('payroll_runs')
        .select(`
          *,
          companies:companies!payroll_runs_company_id_fkey(id, name)
        `)
        .order('created_at', { ascending: false });

      const statuses = getStatusFilter(role, tab);
      if (statuses && statuses.length > 0) {
        q = q.in('status', statuses);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as PayrollRun[];
    },
    staleTime: 20 * 1000,
  });

  const approveMutation = useMutation({
    mutationFn: async (input: { runId: string; remarks?: string }) => {
      const db = supabase as any;
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');

      const { data: current, error: fetchErr } = await db
        .from('payroll_runs')
        .select('id, status')
        .eq('id', input.runId)
        .single();
      if (fetchErr) throw fetchErr;

      const now = new Date().toISOString();
      let updateData: Record<string, unknown> = {};

      if (role === 'hr') {
        if (current.status === 'draft') {
          if (!canTransitionPayroll('draft', 'pending_hr_review', 'hr')) {
            throw new Error('Cannot submit this payroll run for review');
          }
          updateData = { status: 'pending_hr_review' };
        } else if (current.status === 'pending_hr_review') {
          if (!canTransitionPayroll('pending_hr_review', 'hr_approved', 'hr')) {
            throw new Error('Cannot approve this payroll run');
          }
          updateData = {
            status: 'hr_approved',
            hr_id: authData.user.id,
            hr_approved_at: now,
            hr_remarks: input.remarks || null,
          };
        } else if (current.status === 'hr_approved') {
          if (!canTransitionPayroll('hr_approved', 'pending_director', 'hr')) {
            throw new Error('Cannot send this payroll run to director');
          }
          updateData = { status: 'pending_director' };
        } else {
          throw new Error(`Cannot approve payroll run in ${current.status} state as HR`);
        }
      } else if (role === 'management') {
        if (current.status === 'pending_director') {
          if (!canTransitionPayroll('pending_director', 'director_approved', 'management')) {
            throw new Error('Cannot approve this payroll run');
          }
          updateData = {
            status: 'director_approved',
            director_id: authData.user.id,
            director_approved_at: now,
            director_remarks: input.remarks || null,
          };
        } else if (current.status === 'director_approved') {
          if (!canTransitionPayroll('director_approved', 'pending_finance', 'management')) {
            throw new Error('Cannot send this payroll run to finance');
          }
          updateData = { status: 'pending_finance' };
        } else {
          throw new Error(`Cannot approve payroll run in ${current.status} state as Director`);
        }
      } else if (role === 'finance') {
        if (!canTransitionPayroll(current.status, 'finance_approved', 'finance')) {
          throw new Error(`Cannot approve payroll run in ${current.status} state as Finance`);
        }
        updateData = {
          status: 'finance_approved',
          finance_id: authData.user.id,
          finance_approved_at: now,
          finance_remarks: input.remarks || null,
        };
      }

      const { error } = await db
        .from('payroll_runs')
        .update(updateData)
        .eq('id', input.runId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-run'] });
      toast({ title: 'Success', description: 'Payroll run updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (input: { runId: string; remarks: string }) => {
      const db = supabase as any;
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');
      if (!input.remarks?.trim()) throw new Error('Remarks are required when rejecting');

      const { data: current, error: fetchErr } = await db
        .from('payroll_runs')
        .select('id, status')
        .eq('id', input.runId)
        .single();
      if (fetchErr) throw fetchErr;

      if (!canTransitionPayroll(current.status, 'rejected', role)) {
        throw new Error(`Cannot reject payroll run in ${current.status} state as ${role}`);
      }

      const now = new Date().toISOString();
      const { error } = await db
        .from('payroll_runs')
        .update({
          status: 'rejected',
          rejected_by: authData.user.id,
          rejected_at: now,
          rejection_remarks: input.remarks,
          rejection_stage: role,
        })
        .eq('id', input.runId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-run'] });
      toast({ title: 'Rejected', description: 'Payroll run rejected' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    ...query,
    approvePayrollRun: approveMutation.mutateAsync,
    rejectPayrollRun: rejectMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
  };
}
