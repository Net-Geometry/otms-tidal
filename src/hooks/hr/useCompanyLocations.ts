import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CompanyLocation {
  id: string;
  company_id: string | null;
  location_name: string;
  state_code: string;
  state_name: string | null;
  address: string | null;
  is_active: boolean;
}

// Query keys
export const companyLocationsKeys = {
  all: ['company-locations'] as const,
  active: () => [...companyLocationsKeys.all, 'active'] as const,
  byState: (stateCode?: string) => [...companyLocationsKeys.all, 'by-state', stateCode] as const,
};

/**
 * Hook to fetch all company locations (or filtered by state)
 * Used by HR when assigning employees to locations
 */
export function useCompanyLocations(stateCode?: string) {
  return useQuery({
    queryKey: stateCode ? companyLocationsKeys.byState(stateCode) : companyLocationsKeys.all,
    queryFn: async () => {
      let query = supabase
        .from('company_locations')
        .select('*')
        .eq('is_active', true)
        .order('location_name', { ascending: true });

      // Filter by state if provided
      if (stateCode) {
        query = query.eq('state_code', stateCode);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []) as CompanyLocation[];
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Hook to get location details by name
 * Useful for getting state code from location name
 */
export function useLocationByName(locationName?: string) {
  return useQuery({
    queryKey: ['company-location', locationName],
    queryFn: async () => {
      if (!locationName) return null;

      const { data, error } = await supabase
        .from('company_locations')
        .select('*')
        .eq('location_name', locationName)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found - return null instead of throwing
          return null;
        }
        throw error;
      }

      return data as CompanyLocation | null;
    },
    enabled: !!locationName,
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Hook to get all unique state codes
 * Useful for creating dropdowns of states
 */
export function useAvailableStates() {
  return useQuery({
    queryKey: [...companyLocationsKeys.all, 'states'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_locations')
        .select('state_code, state_name')
        .eq('is_active', true)
        .order('state_name', { ascending: true });

      if (error) throw error;

      // Get unique states
      const uniqueStates = new Map<string, string>();
      data?.forEach((item) => {
        if (item.state_code && item.state_name) {
          uniqueStates.set(item.state_code, item.state_name);
        }
      });

      return Array.from(uniqueStates.entries()).map(([code, name]) => ({
        code,
        name,
      }));
    },
    staleTime: 1000 * 60 * 10,
  });
}
