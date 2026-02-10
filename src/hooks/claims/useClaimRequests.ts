import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Claim, ClaimRequestStatus } from '@/types/claims';

export type ClaimRequestsFilter = 'pending' | 'approved' | 'rejected' | 'all';

function getStatusList(filter: ClaimRequestsFilter): ClaimRequestStatus[] | null {
  if (filter === 'all') return null;
  if (filter === 'pending') {
    return ['pending_supervisor', 'supervisor_approved', 'pending_hr', 'pending_finance'];
  }
  if (filter === 'approved') {
    return ['hr_approved', 'finance_approved'];
  }
  return ['rejected', 'cancelled'];
}

export function useClaimRequests(options?: { filter?: ClaimRequestsFilter }) {
  const filter = options?.filter ?? 'all';
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['claim-requests', 'me', filter],
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
        .eq('employee_id', authData.user.id)
        .order('created_at', { ascending: false });

      const statuses = getStatusList(filter);
      if (statuses && statuses.length > 0) {
        q = q.in('status', statuses);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Claim[];
    },
    staleTime: 30 * 1000,
  });

  const cancelMutation = useMutation({
    mutationFn: async (input: { requestId: string; reason?: string }) => {
      const db = supabase as any;
      const { data: current, error: fetchError } = await db
        .from('claims')
        .select('status, is_posted')
        .eq('id', input.requestId)
        .single();
      if (fetchError) throw fetchError;

      if (current?.is_posted) {
        throw new Error('Posted claims cannot be cancelled. Please contact Finance.');
      }
      if (current?.status === 'hr_approved' || current?.status === 'finance_approved') {
        throw new Error('Approved claims cannot be cancelled here. Please contact HR/Finance.');
      }
      if (current?.status === 'rejected' || current?.status === 'cancelled') {
        throw new Error('This claim cannot be cancelled');
      }

      const { error } = await db
        .from('claims')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: input.reason || null,
        })
        .eq('id', input.requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claim-requests'] });
      queryClient.invalidateQueries({ queryKey: ['claim-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['claims'] });
      toast({ title: 'Cancelled', description: 'Claim cancelled successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    ...query,
    cancelClaimRequest: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,
  };
}
