import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type CalendarEditableSource = 'holiday' | 'company';

export interface UpdateHolidayInput {
  id: string;
  ids?: string[];
  source: CalendarEditableSource;
  date?: string | null; // YYYY-MM-DD
  name?: string | null;
  state_code?: string | null;
  holiday_type?: string | null;
  type?: 'company' | 'emergency' | 'government' | null; // company overrides
  description?: string | null;
}

export function useUpdateHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateHolidayInput) => {
      if (input.source === 'holiday') {
        const ids = (input.ids && input.ids.length > 0) ? input.ids : [input.id];

        const results = await Promise.all(
          ids.map(async (id) => {
            const { error } = await supabase.rpc(
              'hr_modify_malaysian_holiday' as never,
              {
                p_holiday_id: id,
                p_new_date: input.date ?? null,
                p_new_name: input.name ?? null,
                p_new_state: input.state_code ?? null,
                p_new_type: input.holiday_type ?? null,
              } as never
            );
            if (error) throw error;
            return id;
          })
        );

        return { ids: results };
      }

      const updateData: Record<string, unknown> = {};
      if (input.date !== undefined) updateData.date = input.date;
      if (input.name !== undefined) updateData.name = input.name;
      if (input.type !== undefined && input.type !== null) updateData.type = input.type;
      if (input.description !== undefined) updateData.description = input.description;

      const { error } = await supabase
        .from('holiday_overrides')
        .update(updateData)
        .eq('id', input.id);

      if (error) throw error;
      return { id: input.id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holiday-calendar-view'] });
      toast.success('Holiday updated');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to update holiday: ${message}`);
    },
  });
}
