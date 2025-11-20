import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useManagementBulkApproval() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const bulkApprove = useMutation({
    mutationFn: async (requestIds: string[]) => {
      if (requestIds.length === 0) {
        throw new Error('No requests selected for approval');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const now = new Date().toISOString();

      // Update all selected requests to management_approved status
      const { error } = await supabase
        .from('ot_requests')
        .update({
          status: 'management_approved',
          management_reviewed_at: now,
          updated_at: now,
        })
        .in('id', requestIds);

      if (error) throw error;

      return { approvedCount: requestIds.length };
    },
    onSuccess: (data) => {
      // Invalidate relevant queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['ot-approval'] });
      queryClient.invalidateQueries({ queryKey: ['management-report'] });

      toast({
        title: 'Success',
        description: `Successfully approved ${data.approvedCount} overtime request(s). Employees have been notified.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    bulkApprove: bulkApprove.mutate,
    isApproving: bulkApprove.isPending,
  };
}
