import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { consolidateHolidays, type CalendarEventItem } from '@/utils/consolidateHolidays';
import { format } from 'date-fns';

export interface HolidayItem {
  id: string;
  calendar_id?: string | null;
  holiday_date: string;
  description: string;
  state_code?: string | null;
  state_codes?: string[];
  source_ids?: string[];
  event_source?: 'holiday' | 'company' | 'leave' | 'birthday' | string;
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
      const db = supabase as any;

      // Fetch calendar events and birthday data in parallel
      const [calendarResult, birthdayResult] = await Promise.all([
        db
          .from('employee_calendar_events')
          .select('*')
          .order('holiday_date', { ascending: true }),
        db
          .from('profiles')
          .select('id, full_name, date_of_birth')
          .not('date_of_birth', 'is', null)
          .eq('status', 'active'),
      ]);

      if (calendarResult.error) throw calendarResult.error;

      const consolidated = consolidateHolidays((calendarResult.data as unknown as CalendarEventItem[]) || []);

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

      // Inject birthday events for current year
      const currentYear = new Date().getFullYear();
      const birthdayEvents: HolidayItem[] = [];

      if (!birthdayResult.error && birthdayResult.data) {
        for (const profile of birthdayResult.data as any[]) {
          if (!profile.date_of_birth) continue;

          const dob = new Date(profile.date_of_birth);
          if (isNaN(dob.getTime())) continue;

          const birthdayThisYear = new Date(currentYear, dob.getMonth(), dob.getDate());
          const birthdayDate = format(birthdayThisYear, 'yyyy-MM-dd');

          birthdayEvents.push({
            id: `birthday-${profile.id}`,
            holiday_date: birthdayDate,
            description: `${profile.full_name}'s Birthday`,
            event_source: 'birthday',
            state_code: 'ALL',
          });
        }
      }

      return [...filtered, ...birthdayEvents].sort(
        (a, b) => a.holiday_date.localeCompare(b.holiday_date)
      );
    },
  });
}
