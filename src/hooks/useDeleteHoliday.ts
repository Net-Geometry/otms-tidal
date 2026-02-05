import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { CalendarEditableSource } from '@/hooks/useUpdateHoliday';

export interface DeleteHolidayInput {
  id: string;
  ids?: string[];
  source: CalendarEditableSource;
}

export function useDeleteHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: DeleteHolidayInput) => {
      if (input.source === 'holiday') {
        const ids = (input.ids && input.ids.length > 0) ? input.ids : [input.id];

        const results = await Promise.all(
          ids.map(async (id) => {
            const { error } = await supabase.rpc(
              'hr_delete_malaysian_holiday' as never,
              { p_holiday_id: id } as never
            );
            if (error) throw error;
            return id;
          })
        );

        return { ids: results };
      }

      const { error } = await supabase
        .from('holiday_overrides')
        .delete()
        .eq('id', input.id);
      if (error) throw error;
      return { id: input.id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holiday-calendar-view'] });
      toast.success('Holiday deleted');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to delete holiday: ${message}`);
    },
  });
}
