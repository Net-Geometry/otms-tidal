import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EmployeeCalendarAssignment {
  calendar_id: string;
  calendar_name: string;
  is_override: boolean;
  applicable_locations: string[] | null;
  description_location: string | null;
}

// Query keys
export const calendarAssignmentKeys = {
  all: ['calendar-assignment'] as const,
  employee: (employeeId?: string) =>
    [...calendarAssignmentKeys.all, 'employee', employeeId] as const,
};

/**
 * Hook to fetch an employee's assigned calendar
 * Uses the get_employee_calendar() function which:
 * 1. Returns explicit assignment if exists
 * 2. Auto-matches based on work_location
 * 3. Falls back to company default calendar
 */
export function useEmployeeCalendarAssignment(employeeId?: string) {
  return useQuery({
    queryKey: calendarAssignmentKeys.employee(employeeId),
    queryFn: async () => {
      if (!employeeId) return null;

      const { data, error } = await supabase.rpc('get_employee_calendar', {
        _employee_id: employeeId,
      });

      if (error) throw error;

      // The function returns an array of results, but we only expect one
      if (!data || data.length === 0) return null;

      return data[0] as EmployeeCalendarAssignment;
    },
    enabled: !!employeeId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch all available calendars for a given location
 * Used by HR to see which calendars can be assigned
 */
export function useCalendarsByLocation(location?: string) {
  return useQuery({
    queryKey: [...calendarAssignmentKeys.all, 'by-location', location],
    queryFn: async () => {
      let query = supabase
        .from('holiday_calendars')
        .select('id, name, year, applicable_locations, description_location')
        .eq('year', new Date().getFullYear())
        .order('name', { ascending: true });

      // Filter by location if provided
      if (location) {
        query = query.contains('applicable_locations', [location]);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    },
    enabled: !!location,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Hook to fetch all available calendars (unfiltered)
 * Used when HR wants to see all options
 */
export function useAllCalendars() {
  return useQuery({
    queryKey: [...calendarAssignmentKeys.all, 'all-calendars'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('holiday_calendars')
        .select('id, name, year, applicable_locations, description_location')
        .eq('year', new Date().getFullYear())
        .order('name', { ascending: true });

      if (error) throw error;

      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });
}
