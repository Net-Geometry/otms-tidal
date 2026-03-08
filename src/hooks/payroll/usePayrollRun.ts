import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PayrollRun, PayrollItem } from '@/types/payroll';

export function usePayrollRun(runId: string | undefined) {
  const db = supabase as any;

  const runQuery = useQuery({
    queryKey: ['payroll-run', runId],
    queryFn: async () => {
      if (!runId) throw new Error('No run ID');
      const { data, error } = await db
        .from('payroll_runs')
        .select(`
          *,
          companies:companies!payroll_runs_company_id_fkey(id, name, code, socso_employer_no, epf_employer_no)
        `)
        .eq('id', runId)
        .single();
      if (error) throw error;
      return data as PayrollRun;
    },
    enabled: !!runId,
    staleTime: 10 * 1000,
  });

  const itemsQuery = useQuery({
    queryKey: ['payroll-run-items', runId],
    queryFn: async () => {
      if (!runId) throw new Error('No run ID');
      const { data, error } = await db
        .from('payroll_items')
        .select(`
          *,
          profiles:profiles!payroll_items_employee_id_fkey(
            id,
            employee_id,
            full_name,
            department_id,
            departments(name),
            epf_no,
            socso_no,
            income_tax_no,
            ic_no,
            bank_name,
            bank_account_no
          ),
          payroll_item_allowances(
            id,
            allowance_type_id,
            amount,
            allowance_type:allowance_types(*)
          ),
          payroll_item_deductions(
            id,
            deduction_type_id,
            amount,
            deduction_type:deduction_types(*)
          )
        `)
        .eq('payroll_run_id', runId)
        .order('created_at');
      if (error) throw error;
      return (data || []) as PayrollItem[];
    },
    enabled: !!runId,
    staleTime: 10 * 1000,
  });

  return {
    run: runQuery.data,
    isLoadingRun: runQuery.isLoading,
    items: itemsQuery.data || [],
    isLoadingItems: itemsQuery.isLoading,
    isLoading: runQuery.isLoading || itemsQuery.isLoading,
    refetch: () => {
      runQuery.refetch();
      itemsQuery.refetch();
    },
  };
}
