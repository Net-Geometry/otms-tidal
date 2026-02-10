import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { LeaveRequest, LeaveRequestStatus } from '@/types/leave';
import { LEAVE_STATUS_TRANSITIONS } from '@/types/leave';

export type LeaveApprovalRole = 'supervisor' | 'hr' | 'management';
export type LeaveApprovalTab = 'pending' | 'approved' | 'rejected' | 'all';

function getStatusFilter(role: LeaveApprovalRole, tab: LeaveApprovalTab): LeaveRequestStatus[] | null {
  if (tab === 'all') return null;
  if (tab === 'approved') return ['management_approved'];
  if (tab === 'rejected') return ['rejected', 'cancelled'];

  // pending
  if (role === 'supervisor') return ['pending_supervisor'];
  if (role === 'hr') return ['pending_hr', 'supervisor_approved'];
  return ['hr_approved', 'pending_management'];
}

function canTransitionLeave(from: string, to: string, role: string): boolean {
  return LEAVE_STATUS_TRANSITIONS.some(
    (t) => t.from === from && t.to === to && t.role === role,
  );
}

function getApproveUpdate(role: LeaveApprovalRole, remarks?: string | null) {
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
      status: 'hr_approved',
      hr_approved_at: now,
      hr_remarks: remarks || null,
    };
  }
  return {
    status: 'management_approved',
    management_approved_at: now,
    management_remarks: remarks || null,
  };
}

export function useLeaveApproval(options: { role: LeaveApprovalRole; tab?: LeaveApprovalTab }) {
  const { role } = options;
  const tab = options.tab ?? 'pending';
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const queryKey = ['leave-approvals', role, tab];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const db = supabase as any;
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');

      let q = db
        .from('leave_requests')
        .select(`
          *,
          leave_type:leave_types(*),
          profiles:profiles!leave_requests_employee_id_fkey(
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
      return (data || []) as LeaveRequest[];
    },
    staleTime: 20 * 1000,
  });

  const approveMutation = useMutation({
    mutationFn: async (input: { requestIds: string[]; remarks?: string }) => {
      const db = supabase as any;
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');

      // Validate transitions: fetch current statuses
      const { data: current, error: fetchErr } = await db
        .from('leave_requests')
        .select('id, status')
        .in('id', input.requestIds);
      if (fetchErr) throw fetchErr;

      const updateData: any = getApproveUpdate(role, input.remarks);
      const targetStatus = updateData.status;

      // Check each request allows this transition
      const invalid = (current || []).filter(
        (r: any) => !canTransitionLeave(r.status, targetStatus, role),
      );
      if (invalid.length > 0) {
        const statuses = invalid.map((r: any) => r.status).join(', ');
        throw new Error(`Cannot approve: ${invalid.length} request(s) in invalid state (${statuses}) for ${role} role`);
      }

      if (role === 'supervisor') updateData.supervisor_id = authData.user.id;
      if (role === 'hr') updateData.hr_id = authData.user.id;
      if (role === 'management') updateData.management_id = authData.user.id;

      const { error } = await db
        .from('leave_requests')
        .update(updateData)
        .in('id', input.requestIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['holiday-calendar-view'] });
      toast({ title: 'Success', description: 'Leave request approved' });
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
        throw new Error('Remarks are required when rejecting a request');
      }

      // Validate transitions: fetch current statuses
      const { data: current, error: fetchErr } = await db
        .from('leave_requests')
        .select('id, status')
        .in('id', input.requestIds);
      if (fetchErr) throw fetchErr;

      const invalid = (current || []).filter(
        (r: any) => !canTransitionLeave(r.status, 'rejected', role),
      );
      if (invalid.length > 0) {
        const statuses = invalid.map((r: any) => r.status).join(', ');
        throw new Error(`Cannot reject: ${invalid.length} request(s) in invalid state (${statuses}) for ${role} role`);
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
        .from('leave_requests')
        .update(updateData)
        .in('id', input.requestIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['holiday-calendar-view'] });
      toast({ title: 'Rejected', description: 'Leave request rejected' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    ...query,
    approveLeave: approveMutation.mutateAsync,
    rejectLeave: rejectMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
  };
}
