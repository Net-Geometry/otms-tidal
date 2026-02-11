import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { PettyCashSettings } from '@/types/finance';

export function usePettyCashSettings() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const settingsQuery = useQuery({
    queryKey: ['petty-cash-settings'],
    queryFn: async () => {
      const { data, error } = await db
        .from('petty_cash_settings')
        .select('*')
        .eq('id', 1)
        .single();

      if (error) throw error;
      return data as PettyCashSettings;
    },
    staleTime: 5 * 60 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: async (values: Partial<Omit<PettyCashSettings, 'id' | 'created_at' | 'updated_at'>>) => {
      const { error } = await db
        .from('petty_cash_settings')
        .update(values)
        .eq('id', 1);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty-cash-settings'] });
      queryClient.invalidateQueries({ queryKey: ['petty-cash-balance'] });
      toast({ title: 'Saved', description: 'Petty cash settings updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    ...settingsQuery,
    settings: settingsQuery.data,
    updateSettings: updateMutation.mutateAsync,
    isSaving: updateMutation.isPending,
  };
}
