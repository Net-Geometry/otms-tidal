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

      // Fetch all active employees with birthdays
      const { data: employees, error: empError } = await db
        .from('profiles')
        .select('id, full_name, date_of_birth, state')
        .eq('status', 'active')
        .not('date_of_birth', 'is', null);

      if (empError) throw empError;

      // Fetch all approved leave requests for the year
      const yearStart = `${targetYear}-01-01`;
      const yearEnd = `${targetYear}-12-31`;

      const { data: leaveRequests, error: leaveError } = await db
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
        .gte('end_date', yearStart);

      if (leaveError) throw leaveError;

      // Fetch holidays for the year
      const { data: holidays, error: holidayError } = await db
        .from('malaysian_holidays')
        .select('id, date, name, state, hr_date_override, hr_name_override, hr_state_override')
        .eq('year', targetYear)
        .not('hr_is_deleted', 'eq', true);

      if (holidayError) throw holidayError;

      const events: HRCalendarEvent[] = [];

      // Add birthday events
      if (employees) {
        for (const emp of employees) {
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
      }

      // Add leave events
      if (leaveRequests) {
        for (const leave of leaveRequests) {
          const start = new Date(leave.start_date);
          const end = new Date(leave.end_date);
          const employeeName = leave.profiles?.full_name || 'Unknown';
          const leaveTypeName = leave.leave_type?.name || 'Leave';

          // Generate an event for each day of leave
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
      }

      // Add holidays
      if (holidays) {
        for (const holiday of holidays) {
          const date = holiday.hr_date_override || holiday.date;
          const name = holiday.hr_name_override || holiday.name;
          const state = holiday.hr_state_override || holiday.state;

          events.push({
            id: `holiday-${holiday.id}`,
            date,
            title: name,
            type: 'holiday',
            stateCode: state || 'ALL',
          });
        }
      }

      // Sort by date
      return events.sort((a, b) => a.date.localeCompare(b.date));
    },
    staleTime: 60 * 1000,
  });
}
