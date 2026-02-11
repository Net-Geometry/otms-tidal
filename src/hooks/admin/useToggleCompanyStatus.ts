import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ToggleCompanyStatusData {
  id: string;
  is_active: boolean;
}

export function useToggleCompanyStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: ToggleCompanyStatusData) => {
      const { data: company, error } = await supabase
        .from('companies')
        .update({ is_active: !is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return company;
    },
    onSuccess: (company) => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success(
        company?.is_active
          ? 'Company reactivated successfully'
          : 'Company deactivated successfully'
      );
    },
    onError: (error: unknown) => {
      const supabaseError = error as { code?: string };

      if (supabaseError.code === '42501') {
        toast.error('Insufficient permissions to update company status');
      } else {
        toast.error('Failed to update company status');
      }
    },
  });
}
