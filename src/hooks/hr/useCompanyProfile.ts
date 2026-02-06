import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useCompanyProfile() {
  return useQuery({
    queryKey: ['company-profile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_profile')
        .select('*')
        .maybeSingle();

      // Return null if no profile exists yet (not an error)
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
  });
}
