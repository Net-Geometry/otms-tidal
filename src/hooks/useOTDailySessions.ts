import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { OTRequest } from '@/types/otms';

interface UseOTDailySessionsOptions {
  employeeId: string;
  otDate: string;
  enabled?: boolean;
}

export function useOTDailySessions({ employeeId, otDate, enabled = true }: UseOTDailySessionsOptions) {
  return useQuery({
    queryKey: ['ot-daily-sessions', employeeId, otDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ot_requests')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('ot_date', otDate)
        .neq('status', 'rejected')
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data as OTRequest[];
    },
    enabled: enabled && !!employeeId && !!otDate,
  });
}
