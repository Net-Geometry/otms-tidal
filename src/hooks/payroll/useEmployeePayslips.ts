import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PayrollItem } from '@/types/payroll';

export function useEmployeePayslips(options?: { year?: number }) {
  const year = options?.year ?? new Date().getFullYear();
  const db = supabase as any;

  return useQuery({
    queryKey: ['employee-payslips', year],
    queryFn: async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');

      const { data, error } = await db
        .from('payroll_items')
        .select(`
          *,
          payroll_run:payroll_runs!payroll_items_payroll_run_id_fkey(
            id,
            run_number,
            pay_period_month,
            pay_period_year,
            status,
            companies:companies!payroll_runs_company_id_fkey(id, name)
          ),
          profiles:profiles!payroll_items_employee_id_fkey(
            id,
            employee_id,
            full_name,
            department_id,
            departments(name),
            epf_no,
            socso_no,
            income_tax_no,
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
        .eq('employee_id', authData.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter by year via the joined payroll_run
      const items = (data || []) as (PayrollItem & { payroll_run?: any })[];
      return items.filter(
        (item) =>
          item.payroll_run?.pay_period_year === year &&
          (item.payroll_run?.status === 'finance_approved' || item.payroll_run?.status === 'posted')
      );
    },
    staleTime: 60 * 1000,
  });
}
