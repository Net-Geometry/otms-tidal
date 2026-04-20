import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PrfOutstandingBalance {
  prf_id: string;
  prf_number: string;
  company_id: string;
  payable_to: string | null;
  priority: 'normal' | 'urgent';
  prf_date: string;
  total_amount: number;
  allocated_amount: number;
  outstanding_amount: number;
}

export function usePrfOutstandingBalances(companyId?: string) {
  const db = supabase as any;

  return useQuery({
    queryKey: ['prf-outstanding-balances', companyId || 'all'],
    queryFn: async (): Promise<PrfOutstandingBalance[]> => {
      let q = db
        .from('prf_outstanding_balances')
        .select('*')
        .gt('outstanding_amount', 0)
        .order('prf_date', { ascending: false });

      if (companyId) q = q.eq('company_id', companyId);

      const { data, error } = await q;
      if (error) throw error;

      return ((data || []) as PrfOutstandingBalance[]).map((row) => ({
        ...row,
        total_amount: Number(row.total_amount || 0),
        allocated_amount: Number(row.allocated_amount || 0),
        outstanding_amount: Number(row.outstanding_amount || 0),
      }));
    },
    staleTime: 20 * 1000,
  });
}
