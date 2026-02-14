import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Claim, ClaimRequestStatus, NextApproverOption } from '@/types/claims';
import { canTransitionClaim, isClaimFullyApproved } from '@/types/claims';

export type ClaimApprovalRole = 'supervisor' | 'hr' | 'finance' | 'director' | 'gm' | 'head_finance';
export type ClaimApprovalTab = 'pending' | 'approved' | 'rejected' | 'all';

function getStatusFilter(role: ClaimApprovalRole, tab: ClaimApprovalTab): ClaimRequestStatus[] | null {
  if (tab === 'all') return null;
  if (tab === 'rejected') return ['rejected', 'cancelled'];

  if (tab === 'pending') {
    if (role === 'supervisor') return ['pending_supervisor'];
    if (role === 'hr') return ['pending_hr', 'supervisor_approved'];
    if (role === 'finance') return ['pending_finance'];
    if (role === 'director') return ['pending_director'];
    if (role === 'gm') return ['pending_gm'];
    if (role === 'head_finance') return ['pending_head_finance'];
    return ['pending_finance', 'pending_director', 'pending_gm', 'pending_head_finance'];
  }

  // approved - show all final approved statuses
  return ['finance_approved', 'director_approved', 'gm_approved', 'head_finance_approved'];
}

function getApproveUpdate(role: ClaimApprovalRole, remarks?: string | null) {
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
      status: 'pending_finance',
      hr_approved_at: now,
      hr_remarks: remarks || null,
    };
  }
  if (role === 'finance') {
    return {
      status: 'finance_approved',
      finance_approved_at: now,
      finance_remarks: remarks || null,
    };
  }
  if (role === 'director') {
    return {
      status: 'director_approved',
      director_approved_at: now,
      director_remarks: remarks || null,
    };
  }
  if (role === 'gm') {
    return {
      status: 'gm_approved',
      gm_approved_at: now,
      gm_remarks: remarks || null,
    };
  }
  if (role === 'head_finance') {
    return {
      status: 'head_finance_approved',
      head_finance_approved_at: now,
      head_finance_remarks: remarks || null,
    };
  }
  return {};
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
          ),
          supervisor_profile:profiles!claims_supervisor_id_fkey(
            id,
            full_name
          ),
          hr_profile:profiles!claims_hr_id_fkey(
            id,
            full_name
          ),
          finance_profile:profiles!claims_finance_id_fkey(
            id,
            full_name
          ),
          director_profile:profiles!claims_director_id_fkey(
            id,
            full_name
          ),
          gm_profile:profiles!claims_gm_id_fkey(
            id,
            full_name
          ),
          head_finance_profile:profiles!claims_head_finance_id_fkey(
            id,
            full_name
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

      // Fetch current statuses
      const { data: current, error: fetchErr } = await db
        .from('claims')
        .select('id, status')
        .in('id', input.requestIds);
      if (fetchErr) throw fetchErr;

      const now = new Date().toISOString();

      // For HR role, always forward to pending_finance
      if (role === 'hr') {
        const invalid = (current || []).filter(
          (r: any) => !canTransitionClaim(r.status, 'pending_finance', role)
        );
        if (invalid.length > 0) {
          const statuses = invalid.map((r: any) => r.status).join(', ');
          throw new Error(`Cannot approve: ${invalid.length} claim(s) in invalid state (${statuses}) for ${role} role`);
        }

        const { error } = await db
          .from('claims')
          .update({
            status: 'pending_finance',
            hr_id: authData.user.id,
            hr_approved_at: now,
            hr_remarks: input.remarks || null,
          })
          .in('id', input.requestIds);
        if (error) throw error;
        return;
      }

      const updateData: any = getApproveUpdate(role, input.remarks);
      const targetStatus = updateData.status;

      const invalid = (current || []).filter((r: any) => !canTransitionClaim(r.status, targetStatus, role));
      if (invalid.length > 0) {
        const statuses = invalid.map((r: any) => r.status).join(', ');
        throw new Error(`Cannot approve: ${invalid.length} claim(s) in invalid state (${statuses}) for ${role} role`);
      }

      // Set the approver ID based on role
      if (role === 'supervisor') updateData.supervisor_id = authData.user.id;
      if (role === 'finance') updateData.finance_id = authData.user.id;
      if (role === 'director') updateData.director_id = authData.user.id;
      if (role === 'gm') updateData.gm_id = authData.user.id;
      if (role === 'head_finance') updateData.head_finance_id = authData.user.id;

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

  // New mutation for finance to forward to next approver
  const forwardMutation = useMutation({
    mutationFn: async (input: { requestIds: string[]; nextApprover: NextApproverOption; remarks?: string }) => {
      const db = supabase as any;
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');

      if (!input.requestIds || input.requestIds.length === 0) return;

      // Map next approver option to status
      const statusMap: Record<NextApproverOption, ClaimRequestStatus> = {
        director: 'pending_director',
        gm: 'pending_gm',
        head_finance: 'pending_head_finance',
        final_approve: 'finance_approved',
      };

      const targetStatus = statusMap[input.nextApprover];

      // Fetch current statuses
      const { data: current, error: fetchErr } = await db
        .from('claims')
        .select('id, status')
        .in('id', input.requestIds);
      if (fetchErr) throw fetchErr;

      const now = new Date().toISOString();

      // Validate transition from pending_finance
      const invalid = (current || []).filter(
        (r: any) => !canTransitionClaim(r.status, targetStatus, 'finance')
      );
      if (invalid.length > 0) {
        const statuses = invalid.map((r: any) => r.status).join(', ');
        throw new Error(`Cannot forward: ${invalid.length} claim(s) in invalid state (${statuses})`);
      }

      const updateData: any = {
        status: targetStatus,
        finance_id: authData.user.id,
        finance_approved_at: now,
        finance_remarks: input.remarks || null,
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
      toast({ title: 'Success', description: 'Claim forwarded' });
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
    forwardClaim: forwardMutation.mutateAsync,
    rejectClaim: rejectMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    isForwarding: forwardMutation.isPending,
    isRejecting: rejectMutation.isPending,
  };
}
