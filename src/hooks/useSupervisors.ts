import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Supervisor {
  id: string;
  full_name: string;
  employee_id: string;
}

// Query key factory pattern for consistency
export const supervisorKeys = {
  all: ['supervisors'] as const,
  list: () => [...supervisorKeys.all, 'list'] as const,
  active: () => [...supervisorKeys.all, 'active'] as const,
  filtered: (employeeId?: string) => [...supervisorKeys.active(), employeeId] as const,
} as const;

interface UseSupervisorsOptions {
  /**
   * Employee ID to exclude their direct supervisor from the list
   * If provided, the direct supervisor will be filtered out
   */
  employeeId?: string;
}

/**
 * Fetches all active supervisors from the database
 * Uses an Edge Function to bypass RLS and get all supervisors with the supervisor role
 * Optionally filters out the employee's direct supervisor
 *
 * @param options - Configuration options
 * @param options.employeeId - Employee ID to exclude their direct supervisor from results
 * @returns Query object with supervisors list, loading state, and error
 */
export function useSupervisors(options?: UseSupervisorsOptions) {
  return useQuery({
    queryKey: supervisorKeys.filtered(options?.employeeId),
    queryFn: async (): Promise<Supervisor[]> => {
      // Call Edge Function to fetch supervisors (bypasses RLS)
      const { data, error } = await supabase.functions.invoke('get-supervisors', {
        body: {
          employeeId: options?.employeeId,
        },
      });

      if (error) {
        throw new Error(`Failed to fetch supervisors: ${error.message}`);
      }

      return (data?.supervisors || []) as Supervisor[];
    },
    // Cache supervisor list for 5 minutes
    staleTime: 1000 * 60 * 5,
  });
}
