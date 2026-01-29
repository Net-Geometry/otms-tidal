import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { calendarAssignmentKeys } from '@/hooks/hr/useEmployeeCalendarAssignment';

interface HolidayItem {
  holiday_date: string;
  description: string;
  state_code?: string | null;
}

interface CreateHolidayCalendarData {
  name: string;
  year: number;
  state_code?: string | null;
  date_from: string;
  date_to: string;
  total_holidays: number;
  items: HolidayItem[];
}

export function useCreateHolidayCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateHolidayCalendarData) => {
      const { items, ...calendarData } = data;

      // Insert calendar
      const { data: calendar, error: calendarError } = await supabase
        .from('holiday_calendars')
        .insert(calendarData)
        .select()
        .single();

      if (calendarError) throw calendarError;

      const createdCalendar = calendar as unknown as { id: string } | null;
      if (!createdCalendar?.id) throw new Error('Failed to create holiday calendar (missing id)');

      // Insert items
      if (items.length > 0) {
        const itemsWithCalendarId = items.map(item => ({
          ...item,
          calendar_id: createdCalendar.id,
        }));

        const { error: itemsError } = await supabase
          .from('holiday_calendar_items')
          .insert(itemsWithCalendarId);

        if (itemsError) throw itemsError;
      }

      // Set as company default calendar so employees auto-see it via get_employee_calendar()
      const { data: settings, error: settingsError } = await supabase
        .from('ot_settings')
        .select('id')
        .limit(1)
        .single();

      if (settingsError) throw settingsError;

      const settingsRow = settings as unknown as { id: string } | null;
      if (!settingsRow?.id) throw new Error('Company settings not configured (ot_settings missing)');

      const { error: updateSettingsError } = await supabase
        .from('ot_settings')
        .update({
          active_calendar_id: createdCalendar.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settingsRow.id);

      if (updateSettingsError) throw updateSettingsError;

      return createdCalendar;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holiday-calendars'] });
      queryClient.invalidateQueries({ queryKey: ['active-holiday-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['holiday-calendar-view'] });
      queryClient.invalidateQueries({ queryKey: calendarAssignmentKeys.all });
      toast.success('Holiday calendar created and activated', {
        description: 'This calendar is now the company default (employees will see it automatically).',
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to create holiday calendar: ' + error.message);
    },
  });
}
