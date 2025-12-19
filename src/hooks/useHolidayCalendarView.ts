import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface HolidayItem {
  id: string;
  holiday_date: string;
  description: string;
  state_code?: string | null;
}

export function useHolidayCalendarView(calendarId?: string, userStateCode?: string | null) {
  return useQuery({
    queryKey: ['holiday-calendar-view', calendarId, userStateCode],
    queryFn: async () => {
      let query = supabase
        .from('holiday_calendar_items')
        .select('*');

      if (calendarId) {
        query = query.eq('calendar_id', calendarId);
      }

      const { data, error } = await query.order('holiday_date', { ascending: true });

      if (error) throw error;

      // Filter holidays: show national holidays (state_code IS NULL) + user's state-specific holidays
      const holidays = (data as HolidayItem[]).filter(holiday =>
        holiday.state_code === null || holiday.state_code === userStateCode
      );

      return holidays;
    },
  });
}
