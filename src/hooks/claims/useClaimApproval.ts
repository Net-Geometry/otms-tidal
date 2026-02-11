import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Claim, ClaimRequestStatus } from '@/types/claims';
import { canTransitionClaim } from '@/types/claims';

export type ClaimApprovalRole = 'supervisor' | 'hr' | 'finance';
export type ClaimApprovalTab = 'pending' | 'approved' | 'rejected' | 'all';

function getStatusFilter(role: ClaimApprovalRole, tab: ClaimApprovalTab): ClaimRequestStatus[] | null {
  if (tab === 'all') return null;
  if (tab === 'rejected') return ['rejected', 'cancelled'];

  if (tab === 'pending') {
    if (role === 'supervisor') return ['pending_supervisor'];
    if (role === 'hr') return ['pending_hr', 'supervisor_approved'];
    return ['pending_finance'];
  }

  // approved
  if (role === 'finance') return ['finance_approved'];
  if (role === 'hr') return ['hr_approved', 'pending_finance', 'finance_approved'];
  return ['supervisor_approved', 'pending_hr', 'hr_approved', 'pending_finance', 'finance_approved'];
}

function baseApproveUpdate(role: ClaimApprovalRole, remarks?: string | null) {
  const now = new Date().toISOString();
  if (role === 'supervisor') {
    return {
      status: 'supervisor_approved',
      supervisor_approved_at: now,
      supervisor_remarks: remarks || null,
    };
  }
  if (role === 'hr') {
    return {
      hr_approved_at: now,
      hr_remarks: remarks || null,
    };
  }
  return {
    status: 'finance_approved',
    finance_approved_at: now,
    finance_remarks: remarks || null,
  };
}

export function useClaimApproval(options: { role: ClaimApprovalRole; tab?: ClaimApprovalTab }) {
  const { role } = options;
  const tab = options.tab ?? 'pending';
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const queryKey = ['claim-approvals', role, tab];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const db = supabase as any;
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');

      let q = db
        .from('claims')
        .select(`
          *,
          claim_type:claim_types(*),
          profiles:profiles!claims_employee_id_fkey(
            id,
            employee_id,
            full_name,
            department_id,
            departments(name)
          )
        `)
        .order('created_at', { ascending: false });

      if (role === 'supervisor') {
        q = q.eq('supervisor_id', authData.user.id);
      }

      const statuses = getStatusFilter(role, tab);
      if (statuses && statuses.length > 0) {
        q = q.in('status', statuses);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Claim[];
    },
    staleTime: 20 * 1000,
  });

  const approveMutation = useMutation({
    mutationFn: async (input: { requestIds: string[]; remarks?: string }) => {
      const db = supabase as any;
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');

      if (!input.requestIds || input.requestIds.length === 0) return;

      // Fetch current statuses and claim type approver
      const { data: current, error: fetchErr } = await db
        .from('claims')
        .select(`id, status, claim_type:claim_types(final_approver)`)
        .in('id', input.requestIds);
      if (fetchErr) throw fetchErr;

      const now = new Date().toISOString();

      if (role === 'hr') {
        const toFinance: string[] = [];
        const toHrApproved: string[] = [];

        for (const row of (current || []) as any[]) {
          const finalApprover = row.claim_type?.final_approver as string | undefined;
          if (finalApprover === 'finance') toFinance.push(row.id);
          else toHrApproved.push(row.id);
        }

        // Validate transitions
        const invalid: any[] = [];
        for (const row of (current || []) as any[]) {
          const target = (row.claim_type?.final_approver === 'finance') ? 'pending_finance' : 'hr_approved';
          if (!canTransitionClaim(row.status, target, role)) invalid.push({ id: row.id, status: row.status });
        }
        if (invalid.length > 0) {
          const statuses = invalid.map((r) => r.status).join(', ');
          throw new Error(`Cannot approve: ${invalid.length} claim(s) in invalid state (${statuses}) for ${role} role`);
        }

        const base = {
          hr_id: authData.user.id,
          hr_approved_at: now,
          hr_remarks: input.remarks || null,
        };

        if (toHrApproved.length > 0) {
          const { error } = await db
            .from('claims')
            .update({ ...base, status: 'hr_approved' })
            .in('id', toHrApproved);
          if (error) throw error;
        }

        if (toFinance.length > 0) {
          const { error } = await db
            .from('claims')
            .update({ ...base, status: 'pending_finance' })
            .in('id', toFinance);
          if (error) throw error;
        }

        return;
      }

      const updateData: any = baseApproveUpdate(role, input.remarks);
      const targetStatus = updateData.status;

      const invalid = (current || []).filter((r: any) => !canTransitionClaim(r.status, targetStatus, role));
      if (invalid.length > 0) {
        const statuses = invalid.map((r: any) => r.status).join(', ');
        throw new Error(`Cannot approve: ${invalid.length} claim(s) in invalid state (${statuses}) for ${role} role`);
      }

      if (role === 'supervisor') updateData.supervisor_id = authData.user.id;
      if (role === 'finance') updateData.finance_id = authData.user.id;

      const { error } = await db
        .from('claims')
        .update(updateData)
        .in('id', input.requestIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claim-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['claim-requests'] });
      queryClient.invalidateQueries({ queryKey: ['claims'] });
      queryClient.invalidateQueries({ queryKey: ['claim-posting'] });
      toast({ title: 'Success', description: 'Claim approved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (input: { requestIds: string[]; remarks: string }) => {
      const db = supabase as any;
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');
      if (!input.remarks || input.remarks.trim() === '') {
        throw new Error('Remarks are required when rejecting a claim');
      }
      if (!input.requestIds || input.requestIds.length === 0) return;

      const { data: current, error: fetchErr } = await db
        .from('claims')
        .select('id, status')
        .in('id', input.requestIds);
      if (fetchErr) throw fetchErr;

      const invalid = (current || []).filter((r: any) => !canTransitionClaim(r.status, 'rejected', role));
      if (invalid.length > 0) {
        const statuses = invalid.map((r: any) => r.status).join(', ');
        throw new Error(`Cannot reject: ${invalid.length} claim(s) in invalid state (${statuses}) for ${role} role`);
      }

      const now = new Date().toISOString();
      const updateData: any = {
        status: 'rejected',
        rejected_by: authData.user.id,
        rejected_at: now,
        rejection_remarks: input.remarks,
        rejection_stage: role,
      };

      const { error } = await db
        .from('claims')
        .update(updateData)
        .in('id', input.requestIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claim-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['claim-requests'] });
      queryClient.invalidateQueries({ queryKey: ['claims'] });
      queryClient.invalidateQueries({ queryKey: ['claim-posting'] });
      toast({ title: 'Rejected', description: 'Claim rejected' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    ...query,
    approveClaim: approveMutation.mutateAsync,
    rejectClaim: rejectMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
  };
}
