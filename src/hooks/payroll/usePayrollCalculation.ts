import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type {
  PayrollSettings,
  SocsoContributionRow,
  PayrollItem,
} from '@/types/payroll';
import {
  type EmployeeProfile,
  type CalculatedItem,
  calculateEmployee,
  recalculateRunTotals,
  populateClaimsForRun,
  getAgeAtDate,
} from '@/lib/payrollUtils';

export function usePayrollCalculation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const calculateMutation = useMutation({
    mutationFn: async (input: {
      payrollRunId: string;
      companyId: string;
      month: number;
      year: number;
      settings: PayrollSettings;
      socsoTable: SocsoContributionRow[];
    }) => {
      const db = supabase as any;

      // Fetch employees for this company
      const { data: employees, error: empError } = await db
        .from('profiles')
        .select('id, basic_salary, is_ot_eligible, ot_base, is_director, director_fee, epf_category, marital_status, pcb_category, company_id, joining_date, deleted_at, date_of_birth, employee_epf_rate, employer_epf_rate, employee_socso_rate, employer_socso_rate, employee_eis_rate, employer_eis_rate')
        .eq('company_id', input.companyId)
        .is('deleted_at', null);

      if (empError) throw empError;
      if (!employees || employees.length === 0) {
        throw new Error('No employees found for this company');
      }

      const employeeIds = (employees as EmployeeProfile[]).map((e) => e.id);

      // Fetch dependents for qualifying children count
      const { data: allDependents } = await db
        .from('employee_dependents')
        .select('employee_id, relationship, date_of_birth, is_disabled, is_studying')
        .in('employee_id', employeeIds);

      const periodEnd = new Date(input.year, input.month, 0);
      const periodEndStr = `${input.year}-${String(input.month).padStart(2, '0')}-${String(periodEnd.getDate()).padStart(2, '0')}`;

      function countQualifyingChildren(empId: string, endDateStr: string): number {
        const deps = (allDependents || []).filter(
          (d: any) => d.employee_id === empId && d.relationship === 'child'
        );
        return deps.filter((d: any) => {
          if (!d.date_of_birth) return true;
          const age = getAgeAtDate(d.date_of_birth, endDateStr);
          if (age < 18) return true;
          if (age < 25 && d.is_studying) return true;
          if (d.is_disabled) return true;
          return false;
        }).length;
      }

      // Delete existing items for this run (recalculate)
      await db
        .from('payroll_items')
        .delete()
        .eq('payroll_run_id', input.payrollRunId);

      // Calculate for each employee
      const items: CalculatedItem[] = (employees as EmployeeProfile[]).map((emp) => {
        const childCount = countQualifyingChildren(emp.id, periodEndStr);
        return calculateEmployee(emp, input.settings, input.socsoTable, input.month, input.year, childCount);
      });

      // Insert all items
      const insertData = items.map((item) => ({
        payroll_run_id: input.payrollRunId,
        ...item,
      }));

      const { error: insertError } = await db
        .from('payroll_items')
        .insert(insertData);

      if (insertError) throw insertError;

      // Populate claims from approved claims for the period
      await populateClaimsForRun(input.payrollRunId, input.month, input.year);

      // Update run totals
      await recalculateRunTotals(input.payrollRunId);

      return { itemCount: items.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-run'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-run-items'] });
      toast({
        title: 'Calculated',
        description: `Payroll calculated for ${result.itemCount} employee(s)`,
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Calculation Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async (input: {
      itemId: string;
      payrollRunId: string;
      updates: Partial<PayrollItem>;
      allowances?: { allowance_type_id: string; amount: number }[];
      deductions?: { deduction_type_id: string; amount: number }[];
    }) => {
      const db = supabase as any;

      // Update the payroll item
      const { id, payroll_run_id, employee_id, profiles, payroll_item_allowances, payroll_item_deductions, created_at, updated_at, ...safeUpdates } = input.updates as any;
      if (Object.keys(safeUpdates).length > 0) {
        const { error } = await db
          .from('payroll_items')
          .update(safeUpdates)
          .eq('id', input.itemId);
        if (error) throw error;
      }

      // Upsert allowances
      if (input.allowances) {
        await db
          .from('payroll_item_allowances')
          .delete()
          .eq('payroll_item_id', input.itemId);

        const allowanceRows = input.allowances
          .filter((a) => a.amount > 0)
          .map((a) => ({
            payroll_item_id: input.itemId,
            allowance_type_id: a.allowance_type_id,
            amount: a.amount,
          }));

        if (allowanceRows.length > 0) {
          const { error } = await db
            .from('payroll_item_allowances')
            .insert(allowanceRows);
          if (error) throw error;
        }
      }

      // Upsert deductions
      if (input.deductions) {
        await db
          .from('payroll_item_deductions')
          .delete()
          .eq('payroll_item_id', input.itemId);

        const deductionRows = input.deductions
          .filter((d) => d.amount > 0)
          .map((d) => ({
            payroll_item_id: input.itemId,
            deduction_type_id: d.deduction_type_id,
            amount: d.amount,
          }));

        if (deductionRows.length > 0) {
          const { error } = await db
            .from('payroll_item_deductions')
            .insert(deductionRows);
          if (error) throw error;
        }
      }

      // Recalculate run totals after item update
      await recalculateRunTotals(input.payrollRunId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-run'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-run-items'] });
      toast({ title: 'Updated', description: 'Payroll item updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const recalculateSingleMutation = useMutation({
    mutationFn: async (input: {
      payrollRunId: string;
      employeeId: string;
      month: number;
      year: number;
      settings: PayrollSettings;
      socsoTable: SocsoContributionRow[];
    }) => {
      const db = supabase as any;

      const { data: profile, error: profileError } = await db
        .from('profiles')
        .select('id, basic_salary, is_ot_eligible, ot_base, is_director, director_fee, epf_category, marital_status, pcb_category, company_id, joining_date, deleted_at, date_of_birth, employee_epf_rate, employer_epf_rate, employee_socso_rate, employer_socso_rate, employee_eis_rate, employer_eis_rate')
        .eq('id', input.employeeId)
        .single();

      if (profileError) throw profileError;

      // Fetch dependents for this employee
      const { data: empDependents } = await db
        .from('employee_dependents')
        .select('employee_id, relationship, date_of_birth, is_disabled, is_studying')
        .eq('employee_id', input.employeeId);

      const periodEnd = new Date(input.year, input.month, 0);
      const periodEndStr = `${input.year}-${String(input.month).padStart(2, '0')}-${String(periodEnd.getDate()).padStart(2, '0')}`;
      const childDeps = (empDependents || []).filter((d: any) => d.relationship === 'child');
      const childCount = childDeps.filter((d: any) => {
        if (!d.date_of_birth) return true;
        const age = getAgeAtDate(d.date_of_birth, periodEndStr);
        if (age < 18) return true;
        if (age < 25 && d.is_studying) return true;
        if (d.is_disabled) return true;
        return false;
      }).length;

      const calculated = calculateEmployee(
        profile as EmployeeProfile,
        input.settings,
        input.socsoTable,
        input.month,
        input.year,
        childCount
      );

      // Delete existing item for this employee in this run
      await db
        .from('payroll_items')
        .delete()
        .eq('payroll_run_id', input.payrollRunId)
        .eq('employee_id', input.employeeId);

      // Insert recalculated item
      const { error: insertError } = await db
        .from('payroll_items')
        .insert({ payroll_run_id: input.payrollRunId, ...calculated });

      if (insertError) throw insertError;

      await recalculateRunTotals(input.payrollRunId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-run'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-run-items'] });
      toast({ title: 'Recalculated', description: 'Employee payroll recalculated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const addEmployeeMutation = useMutation({
    mutationFn: async (input: {
      payrollRunId: string;
      employeeId: string;
      month: number;
      year: number;
      settings: PayrollSettings;
      socsoTable: SocsoContributionRow[];
    }) => {
      const db = supabase as any;

      // Check if employee already exists in this run
      const { data: existing } = await db
        .from('payroll_items')
        .select('id')
        .eq('payroll_run_id', input.payrollRunId)
        .eq('employee_id', input.employeeId)
        .maybeSingle();

      if (existing) throw new Error('Employee already exists in this payroll run');

      const { data: profile, error: profileError } = await db
        .from('profiles')
        .select('id, basic_salary, is_ot_eligible, ot_base, is_director, director_fee, epf_category, marital_status, pcb_category, company_id, joining_date, deleted_at, date_of_birth, employee_epf_rate, employer_epf_rate, employee_socso_rate, employer_socso_rate, employee_eis_rate, employer_eis_rate')
        .eq('id', input.employeeId)
        .single();

      if (profileError) throw profileError;

      // Fetch dependents for this employee
      const { data: addEmpDependents } = await db
        .from('employee_dependents')
        .select('employee_id, relationship, date_of_birth, is_disabled, is_studying')
        .eq('employee_id', input.employeeId);

      const addPeriodEnd = new Date(input.year, input.month, 0);
      const addPeriodEndStr = `${input.year}-${String(input.month).padStart(2, '0')}-${String(addPeriodEnd.getDate()).padStart(2, '0')}`;
      const addChildDeps = (addEmpDependents || []).filter((d: any) => d.relationship === 'child');
      const addChildCount = addChildDeps.filter((d: any) => {
        if (!d.date_of_birth) return true;
        const age = getAgeAtDate(d.date_of_birth, addPeriodEndStr);
        if (age < 18) return true;
        if (age < 25 && d.is_studying) return true;
        if (d.is_disabled) return true;
        return false;
      }).length;

      const calculated = calculateEmployee(
        profile as EmployeeProfile,
        input.settings,
        input.socsoTable,
        input.month,
        input.year,
        addChildCount
      );

      const { data: newItem, error: insertError } = await db
        .from('payroll_items')
        .insert({ payroll_run_id: input.payrollRunId, ...calculated })
        .select('id')
        .single();

      if (insertError) throw insertError;

      await recalculateRunTotals(input.payrollRunId);

      return { itemId: newItem.id, employeeId: input.employeeId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-run'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-run-items'] });
      toast({ title: 'Added', description: 'Employee added to payroll run' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    calculatePayroll: calculateMutation.mutateAsync,
    isCalculating: calculateMutation.isPending,
    updatePayrollItem: updateItemMutation.mutateAsync,
    isUpdatingItem: updateItemMutation.isPending,
    recalculateSingleEmployee: recalculateSingleMutation.mutateAsync,
    isRecalculatingSingle: recalculateSingleMutation.isPending,
    addEmployeeToRun: addEmployeeMutation.mutateAsync,
    isAddingEmployee: addEmployeeMutation.isPending,
  };
}
