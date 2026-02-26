import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface HRCalendarEvent {
  id: string;
  date: string;
  title: string;
  type: 'birthday' | 'leave' | 'holiday';
  employeeName?: string;
  leaveType?: string;
  stateCode?: string;
}

export function useHRCalendarView(year?: number) {
  const targetYear = year || new Date().getFullYear();

  return useQuery({
    queryKey: ['hr-calendar-view', targetYear],
    queryFn: async () => {
      const db = supabase as any;
      const yearStart = `${targetYear}-01-01`;
      const yearEnd = `${targetYear}-12-31`;

      const [calendarResult, employeeResult, leaveResult] = await Promise.all([
        // Holidays from unified view (scraped + company overrides, single source of truth)
        db
          .from('employee_calendar_events')
          .select('id, holiday_date, description, state_code, event_source')
          .in('event_source', ['holiday', 'company'])
          .gte('holiday_date', yearStart)
          .lte('holiday_date', yearEnd),
        // Active employees for birthdays
        db
          .from('profiles')
          .select('id, full_name, date_of_birth')
          .eq('status', 'active')
          .not('date_of_birth', 'is', null),
        // All employees' approved leave for the year
        db
          .from('leave_requests')
          .select(`
            id,
            employee_id,
            start_date,
            end_date,
            status,
            profiles:profiles!leave_requests_employee_id_fkey(full_name),
            leave_type:leave_types(name)
          `)
          .eq('status', 'management_approved')
          .lte('start_date', yearEnd)
          .gte('end_date', yearStart),
      ]);

      if (calendarResult.error) throw calendarResult.error;
      if (employeeResult.error) throw employeeResult.error;
      if (leaveResult.error) throw leaveResult.error;

      const events: HRCalendarEvent[] = [];

      // Add holidays from unified view
      for (const row of (calendarResult.data as any[]) || []) {
        events.push({
          id: `holiday-${row.id}`,
          date: row.holiday_date,
          title: row.description,
          type: 'holiday',
          stateCode: row.state_code || 'ALL',
        });
      }

      // Add birthday events
      for (const emp of (employeeResult.data as any[]) || []) {
        if (!emp.date_of_birth) continue;
        const dob = new Date(emp.date_of_birth);
        if (isNaN(dob.getTime())) continue;

        const birthdayThisYear = new Date(targetYear, dob.getMonth(), dob.getDate());
        events.push({
          id: `birthday-${emp.id}`,
          date: format(birthdayThisYear, 'yyyy-MM-dd'),
          title: `${emp.full_name}'s Birthday`,
          type: 'birthday',
          employeeName: emp.full_name,
        });
      }

      // Add all employees' leave events
      for (const leave of (leaveResult.data as any[]) || []) {
        const start = new Date(leave.start_date);
        const end = new Date(leave.end_date);
        const employeeName = leave.profiles?.full_name || 'Unknown';
        const leaveTypeName = leave.leave_type?.name || 'Leave';

        const current = new Date(start);
        while (current <= end) {
          events.push({
            id: `leave-${leave.id}-${format(current, 'yyyy-MM-dd')}`,
            date: format(current, 'yyyy-MM-dd'),
            title: `${employeeName} - ${leaveTypeName}`,
            type: 'leave',
            employeeName,
            leaveType: leaveTypeName,
          });
          current.setDate(current.getDate() + 1);
        }
      }

      return events.sort((a, b) => a.date.localeCompare(b.date));
    },
    staleTime: 60 * 1000,
  });
}
