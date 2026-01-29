import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { calendarAssignmentKeys } from '@/hooks/hr/useEmployeeCalendarAssignment';

interface HolidayItem {
  id?: string;
  holiday_date: string;
  description: string;
  state_code?: string | null;
}

interface UpdateHolidayCalendarData {
  id: string;
  name: string;
  year: number;
  state_code?: string | null;
  date_from: string;
  date_to: string;
  total_holidays: number;
  items: HolidayItem[];
  removedItemIds?: string[];
}

export function useUpdateHolidayCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateHolidayCalendarData) => {
      const { id, items, removedItemIds, ...calendarData } = data;

      // Update calendar
      const { error: calendarError } = await supabase
        .from('holiday_calendars')
        .update(calendarData)
        .eq('id', id);

      if (calendarError) throw calendarError;

      // Delete removed items
      if (removedItemIds && removedItemIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('holiday_calendar_items')
          .delete()
          .in('id', removedItemIds);

        if (deleteError) throw deleteError;
      }

      // Separate new items from existing items
      const existingItems = items.filter(item => item.id);
      const newItems = items.filter(item => !item.id);

      // Update existing items
      if (existingItems.length > 0) {
        const existingItemsWithCalendarId = existingItems.map(item => ({
          ...item,
          calendar_id: id,
        }));

        const { error: updateError } = await supabase
          .from('holiday_calendar_items')
          .upsert(existingItemsWithCalendarId);

        if (updateError) throw updateError;
      }

      // Insert new items
      if (newItems.length > 0) {
        const newItemsWithCalendarId = newItems.map(item => ({
          holiday_date: item.holiday_date,
          description: item.description,
          state_code: item.state_code,
          calendar_id: id,
        }));

        const { error: insertError } = await supabase
          .from('holiday_calendar_items')
          .insert(newItemsWithCalendarId);

        if (insertError) throw insertError;
      }

      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holiday-calendars'] });
      queryClient.invalidateQueries({ queryKey: ['holiday-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['holiday-calendar-view'] });
      queryClient.invalidateQueries({ queryKey: calendarAssignmentKeys.all });
      toast.success('Holiday calendar updated successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to update holiday calendar: ' + error.message);
    },
  });
}
