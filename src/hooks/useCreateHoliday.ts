import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CreateHolidayInput {
  date: string; // YYYY-MM-DD
  name: string;
  type?: 'company' | 'emergency' | 'government';
  description?: string | null;
}

export function useCreateHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateHolidayInput) => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw authError || new Error('Not authenticated');

      const payload = {
        company_id: authData.user.id,
        created_by: authData.user.id,
        date: input.date,
        name: input.name,
        type: input.type ?? 'company',
        description: input.description ?? null,
      };

      const { data, error } = await supabase
        .from('holiday_overrides')
        .insert(payload)
        .select('*')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holiday-calendar-view'] });
      toast.success('Holiday added');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to add holiday: ${message}`);
    },
  });
}
