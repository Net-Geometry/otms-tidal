import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PayrollRun } from '@/types/payroll';

export function useConsolidatedPayrollRuns(month: number, year: number) {
  return useQuery({
    queryKey: ['consolidated-payroll-runs', month, year],
    queryFn: async () => {
      const db = supabase as any;
      const { data, error } = await db
        .from('payroll_runs')
        .select(`
          *,
          companies:companies!payroll_runs_company_id_fkey(id, name, code)
        `)
        .eq('pay_period_month', month)
        .eq('pay_period_year', year)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as (PayrollRun & {
        companies: { id: string; name: string; code: string } | null;
      })[];
    },
    enabled: month > 0 && year > 0,
    staleTime: 20 * 1000,
  });
}
