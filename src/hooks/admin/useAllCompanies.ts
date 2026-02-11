import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Company } from '@/hooks/hr/useCompanies';

export function useAllCompanies() {
  return useQuery({
    queryKey: ['companies', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name');

      if (error) throw error;
      return (data || []) as Company[];
    },
  });
}
