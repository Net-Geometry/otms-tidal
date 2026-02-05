import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { consolidateHolidays, type CalendarEventItem } from '@/utils/consolidateHolidays';

export interface HolidayItem {
  id: string;
  calendar_id?: string | null;
  holiday_date: string;
  description: string;
  state_code?: string | null;
  state_codes?: string[];
  source_ids?: string[];
  event_source?: 'holiday' | 'company' | 'leave' | string;
  is_personal_leave?: boolean;
  is_replacement?: boolean;
  holiday_type?: string | null;
  leave_type?: string | null;
  leave_status?: string | null;
  is_hr_modified?: boolean;
}

export function useHolidayCalendarView(userStateCode?: string | null) {
  return useQuery({
    queryKey: ['holiday-calendar-view', userStateCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_calendar_events')
        .select('*')
        .order('holiday_date', { ascending: true });

      if (error) throw error;

      const consolidated = consolidateHolidays((data as unknown as CalendarEventItem[]) || []);

      // Filter holiday rows by state; always include personal leave rows.
      const filtered = (consolidated as unknown as HolidayItem[]).filter((item) => {
        const source = item.event_source;
        const isLeave = source === 'leave' || item.is_personal_leave;
        if (isLeave) return true;

        const states = item.state_codes || (item.state_code ? [item.state_code] : []);

        // If user state is unknown, show only federal/company events (ALL) + any events without a state.
        if (!userStateCode) {
          return states.length === 0 || states.includes('ALL') || item.state_code === null;
        }

        return states.length === 0 || states.includes('ALL') || states.includes(userStateCode);
      });

      return filtered;
    },
  });
}
