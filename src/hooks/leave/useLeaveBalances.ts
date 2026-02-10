import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { LeaveBalance, LeaveType } from '@/types/leave';

function computeRemaining(b: any) {
  const entitled = Number(b.entitled_days || 0);
  const carried = Number(b.carried_forward || 0);
  const adjustment = Number(b.adjustment || 0);
  const used = Number(b.used_days || 0);
  return entitled + carried + adjustment - used;
}

export function useLeaveBalances(options?: { employeeId?: string; year?: number }) {
  const year = options?.year ?? new Date().getFullYear();

  return useQuery({
    queryKey: ['leave-balances', options?.employeeId || 'me', year],
    queryFn: async () => {
      const db = supabase as any;
      const employeeId = options?.employeeId;

      let targetEmployeeId = employeeId;
      if (!targetEmployeeId) {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authData?.user) throw new Error('Not authenticated');
        targetEmployeeId = authData.user.id;
      }

      const { data, error } = await db
        .from('leave_balances')
        .select(`
          *,
          leave_type:leave_types(*)
        `)
        .eq('employee_id', targetEmployeeId)
        .eq('year', year)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return ((data || []) as any[]).map((row) => {
        const leaveType = row.leave_type as LeaveType | undefined;
        return {
          ...row,
          remaining: computeRemaining(row),
          leave_type: leaveType,
        } as LeaveBalance;
      });
    },
    staleTime: 60 * 1000,
  });
}
