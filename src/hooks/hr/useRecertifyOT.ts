import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { OTRequest } from '@/types/otms';

export function usePendingRecertifications() {
  return useQuery({
    queryKey: ['hr-recertify-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ot_requests')
        .select(`
          *,
          profiles!ot_requests_employee_id_fkey(
            employee_id,
            full_name,
            department:departments(name)
          )
        `)
        .eq('status', 'pending_hr_recertification')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as OTRequest[];
    },
  });
}

export function useRecertifyOTActions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const recertify = useMutation({
    mutationFn: async ({ requestId, remarks }: { requestId: string; remarks: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('ot_requests')
        .update({
          status: 'pending_management_approval',
          hr_id: user.id,
          hr_approved_at: new Date().toISOString(),
          hr_remarks: remarks,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-recertify-requests'] });
      toast({
        title: 'Success',
        description: 'OT request recertified and sent back to Management',
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

  const decline = useMutation({
    mutationFn: async ({ requestId, remarks }: { requestId: string; remarks: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('ot_requests')
        .update({
          status: 'rejected',
          hr_id: user.id,
          hr_remarks: remarks,
          rejection_stage: 'hr',
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-recertify-requests'] });
      toast({
        title: 'Success',
        description: 'Request declined and sent back to employee for revision',
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

  return { recertify, decline };
}
