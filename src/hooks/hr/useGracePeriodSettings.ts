import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type GracePeriodSettings = {
  id: string;
  grace_period_enabled: boolean | null;
};

export function useGracePeriodSettings() {
  return useQuery({
    queryKey: ['grace-period-settings'],
    queryFn: async (): Promise<GracePeriodSettings> => {
      const { data, error } = await supabase
        .from('ot_settings')
        .select('id, grace_period_enabled')
        .limit(1)
        .single();

      if (error) throw error;
      return data as unknown as GracePeriodSettings;
    },
  });
}

export function useUpdateGracePeriodSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; gracePeriodEnabled: boolean }) => {
      const { data, error } = await supabase
        .from('ot_settings')
        .update({
          grace_period_enabled: params.gracePeriodEnabled,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.id)
        .select('id, grace_period_enabled')
        .single();

      if (error) throw error;
      return data as unknown as GracePeriodSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grace-period-settings'] });
      toast.success('Grace Period Mode updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update Grace Period Mode', {
        description: error.message,
      });
    },
  });
}
