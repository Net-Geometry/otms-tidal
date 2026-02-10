import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { LeaveBalance, LeaveType } from '@/types/leave';

function computeRemaining(row: any) {
  return (
    Number(row.entitled_days || 0) +
    Number(row.carried_forward || 0) +
    Number(row.adjustment || 0) -
    Number(row.used_days || 0)
  );
}

export function useLeaveBalanceAdmin(options?: { employeeId?: string; year?: number }) {
  const year = options?.year ?? new Date().getFullYear();
  const employeeId = options?.employeeId;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const db = supabase as any;

  const balancesQuery = useQuery({
    queryKey: ['leave-balances-admin', employeeId || 'none', year],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await db
        .from('leave_balances')
        .select(`*, leave_type:leave_types(*)`)
        .eq('employee_id', employeeId)
        .eq('year', year)
        .order('created_at', { ascending: true });
      if (error) throw error;

      return ((data || []) as any[]).map((row) => ({
        ...row,
        remaining: computeRemaining(row),
      })) as LeaveBalance[];
    },
  });

  const upsertBalance = useMutation({
    mutationFn: async (input: {
      employeeId: string;
      leaveTypeId: string;
      year: number;
      entitled_days?: number;
      carried_forward?: number;
      adjustment?: number;
    }) => {
      const payload: any = {
        employee_id: input.employeeId,
        leave_type_id: input.leaveTypeId,
        year: input.year,
      };
      if (input.entitled_days != null) payload.entitled_days = input.entitled_days;
      if (input.carried_forward != null) payload.carried_forward = input.carried_forward;
      if (input.adjustment != null) payload.adjustment = input.adjustment;

      const { error } = await db
        .from('leave_balances')
        .upsert(payload, { onConflict: 'employee_id,leave_type_id,year' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-balances-admin'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      toast({ title: 'Saved', description: 'Leave balance updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const bulkInitializeYear = useMutation({
    mutationFn: async (input: { year: number }) => {
      const { data: leaveTypes, error: ltError } = await db
        .from('leave_types')
        .select('id, default_days, is_active')
        .eq('is_active', true);
      if (ltError) throw ltError;

      const { data: employees, error: empError } = await supabase
        .from('profiles')
        .select('id, status');
      if (empError) throw empError;

      const activeEmployeeIds = (employees || [])
        .filter((e: any) => (e.status || 'active') === 'active')
        .map((e: any) => e.id);

      const rows: any[] = [];
      for (const empId of activeEmployeeIds) {
        for (const lt of (leaveTypes || []) as any[]) {
          rows.push({
            employee_id: empId,
            leave_type_id: lt.id,
            year: input.year,
            entitled_days: Number(lt.default_days || 0),
            used_days: 0,
            carried_forward: 0,
            adjustment: 0,
          });
        }
      }

      if (rows.length === 0) return;

      const { error } = await db
        .from('leave_balances')
        .upsert(rows, { onConflict: 'employee_id,leave_type_id,year' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-balances-admin'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      toast({ title: 'Initialized', description: 'Leave balances initialized for the year' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const processCarryForward = useMutation({
    mutationFn: async (input: { fromYear: number; toYear: number }) => {
      const { data: prev, error } = await db
        .from('leave_balances')
        .select(`*, leave_type:leave_types(id, code, is_carry_forward, max_carry_forward)`)
        .eq('year', input.fromYear);
      if (error) throw error;

      const updates: any[] = [];
      for (const row of (prev || []) as any[]) {
        const lt = row.leave_type as LeaveType | undefined;
        if (!lt?.is_carry_forward) continue;

        const remaining = computeRemaining(row);
        const max = Number(lt.max_carry_forward || 0);
        const carry = Math.max(0, Math.min(remaining, max));

        updates.push({
          employee_id: row.employee_id,
          leave_type_id: row.leave_type_id,
          year: input.toYear,
          carried_forward: carry,
        });
      }

      if (updates.length === 0) return;

      const { error: upsertError } = await db
        .from('leave_balances')
        .upsert(updates, { onConflict: 'employee_id,leave_type_id,year' });
      if (upsertError) throw upsertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-balances-admin'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      toast({ title: 'Done', description: 'Carry forward processed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    balancesQuery,
    upsertBalance: upsertBalance.mutateAsync,
    isSaving: upsertBalance.isPending,
    bulkInitializeYear: bulkInitializeYear.mutateAsync,
    isInitializing: bulkInitializeYear.isPending,
    processCarryForward: processCarryForward.mutateAsync,
    isProcessingCarryForward: processCarryForward.isPending,
  };
}
