import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ClaimType } from '@/types/claims';

export function useClaimTypes() {
  return useQuery({
    queryKey: ['claim-types'],
    queryFn: async () => {
      const db = supabase as any;
      const { data, error } = await db
        .from('claim_types')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return (data || []) as ClaimType[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
