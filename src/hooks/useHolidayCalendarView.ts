import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface HolidayItem {
  id: string;
  calendar_id?: string | null;
  holiday_date: string;
  description: string;
  state_code?: string | null;
  event_source?: 'holiday' | 'leave' | string;
  is_personal_leave?: boolean;
  is_replacement?: boolean;
  leave_type?: string | null;
  leave_status?: string | null;
}

export function useHolidayCalendarView(calendarId?: string, userStateCode?: string | null) {
  return useQuery({
    queryKey: ['holiday-calendar-view', calendarId, userStateCode],
    queryFn: async () => {
      let query = supabase
        .from('employee_calendar_events')
        .select('*');

      if (calendarId) {
        // Include calendar events + personal leave (leave rows are already scoped to auth.uid() in the view)
        query = query.or(`calendar_id.eq.${calendarId},event_source.eq.leave`);
      } else {
        // No calendar assigned: still show personal leave
        query = query.eq('event_source', 'leave');
      }

      const { data, error } = await query.order('holiday_date', { ascending: true });

      if (error) throw error;

      // Filter holiday rows by state; always include personal leave rows.
      const holidays = (data as unknown as HolidayItem[]).filter((item) => {
        if (item.event_source === 'leave' || item.is_personal_leave) return true;
        return item.state_code === null || item.state_code === 'ALL' || item.state_code === userStateCode;
      });

      return holidays;
    },
  });
}
