import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { LeaveRequest, LeaveRequestStatus } from '@/types/leave';

export type LeaveRequestsFilter = 'pending' | 'approved' | 'rejected' | 'all';

function getStatusList(filter: LeaveRequestsFilter): LeaveRequestStatus[] | null {
  if (filter === 'all') return null;
  if (filter === 'pending') {
    return ['pending_supervisor', 'pending_hr', 'supervisor_approved', 'hr_approved', 'pending_management'];
  }
  if (filter === 'approved') {
    return ['management_approved'];
  }
  return ['rejected', 'cancelled'];
}

export function useLeaveRequests(options?: { filter?: LeaveRequestsFilter }) {
  const filter = options?.filter ?? 'all';
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['leave-requests', 'me', filter],
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
        .eq('employee_id', authData.user.id)
        .order('created_at', { ascending: false });

      const statuses = getStatusList(filter);
      if (statuses && statuses.length > 0) {
        q = q.in('status', statuses);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as LeaveRequest[];
    },
    staleTime: 30 * 1000,
  });

  const cancelMutation = useMutation({
    mutationFn: async (input: { requestId: string; reason?: string }) => {
      const db = supabase as any;

      // Best-effort guard: only allow cancelling non-final requests
      const { data: current, error: fetchError } = await db
        .from('leave_requests')
        .select('status')
        .eq('id', input.requestId)
        .single();
      if (fetchError) throw fetchError;

      if (current?.status === 'management_approved') {
        throw new Error('Approved leave cannot be cancelled here. Please contact HR.');
      }
      if (current?.status === 'rejected' || current?.status === 'cancelled') {
        throw new Error('This request cannot be cancelled');
      }

      const { error } = await db
        .from('leave_requests')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: input.reason || null,
        })
        .eq('id', input.requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['holiday-calendar-view'] });
      toast({ title: 'Cancelled', description: 'Leave request cancelled successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    ...query,
    cancelLeaveRequest: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,
  };
}
