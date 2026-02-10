import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { LeaveType } from '@/types/leave';

export function useLeaveTypes() {
  return useQuery({
    queryKey: ['leave-types'],
    queryFn: async () => {
      const db = supabase as any;

      const { data, error } = await db
        .from('leave_types')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return (data || []) as LeaveType[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
