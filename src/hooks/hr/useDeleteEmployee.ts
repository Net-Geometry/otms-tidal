import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export function useDeleteEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (employeeId: string) => {
      // Ensure we have a valid session; try to refresh if missing
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        try {
          const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError || !refreshed.session) {
            await supabase.auth.signOut();
            throw new Error('Your session has expired. Please sign in again.');
          }
        } catch {
          await supabase.auth.signOut();
          throw new Error('Your session has expired. Please sign in again.');
        }
      }

      const invokeDelete = async () =>
        await supabase.functions.invoke('delete-employee', {
          body: { employeeId },
        });

      let { data, error } = await invokeDelete();

      // If unauthorized, try refreshing and retry once
      if (error && (error as any)?.status === 401) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshed.session) {
          ({ data, error } = await invokeDelete());
        }
      }

      if (error) {
        const message = (error as any)?.message || (error as any)?.error || 'Failed to delete employee';
        if ((error as any)?.status === 401) {
          await supabase.auth.signOut();
          throw new Error('Your session expired. Please sign in again.');
        }
        if ((error as any)?.status === 403) {
          throw new Error('You do not have permission to delete employees.');
        }
        throw new Error(message);
      }

      return data;
    },
    onSuccess: (data) => {
      // Invalidate and immediately refetch both queries to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
      queryClient.invalidateQueries({ queryKey: ['archived-employees'] });
      queryClient.refetchQueries({ queryKey: ['hr-employees'] });
      queryClient.refetchQueries({ queryKey: ['archived-employees'] });
      toast({
        title: 'Success',
        description: 'Employee removed from active list and moved to archive',
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
}
