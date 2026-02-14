import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WeeklyLeaveSummary {
  id: string;
  week_start: string;
  week_end: string;
  summary_data: {
    week_start: string;
    week_end: string;
    total_requests: number;
    departments: Record<
      string,
      {
        department_name: string;
        by_leave_type: Record<
          string,
          {
            leave_type_name: string;
            count: number;
            total_days: number;
            employees: string[];
          }
        >;
      }
    >;
  };
  generated_at: string;
  created_at: string;
}

export function useWeeklyLeaveSummary(limit = 4) {
  const db = supabase as any;

  return useQuery({
    queryKey: ['weekly-leave-summaries', limit],
    queryFn: async () => {
      const { data, error } = await db
        .from('leave_weekly_summaries')
        .select('*')
        .order('week_start', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as WeeklyLeaveSummary[];
    },
  });
}
