import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { EmployeeShift } from '@/types/attendance';

function toISODate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function useEmployeeShifts(options?: { employeeId?: string }) {
  const employeeId = options?.employeeId;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const db = supabase as any;

  const query = useQuery({
    queryKey: ['employee-shifts', employeeId || 'all'],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await db
        .from('employee_shifts')
        .select(`
          *,
          shift:shifts(*),
          profiles:profiles!employee_shifts_employee_id_fkey(
            id,
            employee_id,
            full_name,
            department_id,
            departments(name)
          )
        `)
        .eq('employee_id', employeeId)
        .order('effective_date', { ascending: false });
      if (error) throw error;
      return (data || []) as EmployeeShift[];
    },
    staleTime: 30 * 1000,
  });

  const assignShiftMutation = useMutation({
    mutationFn: async (input: {
      employeeId: string;
      shiftId: string;
      effectiveDate: string;
      allowMultipleClockin?: boolean;
    }) => {
      // Close any current assignments for the employee
      const effective = new Date(input.effectiveDate);
      const endDate = new Date(effective);
      endDate.setDate(endDate.getDate() - 1);
      const endDateStr = toISODate(endDate);

      const { error: closeError } = await db
        .from('employee_shifts')
        .update({
          is_current: false,
          end_date: endDateStr,
        })
        .eq('employee_id', input.employeeId)
        .eq('is_current', true)
        .lte('effective_date', input.effectiveDate);
      if (closeError) throw closeError;

      const { error: insertError } = await db
        .from('employee_shifts')
        .insert([
          {
            employee_id: input.employeeId,
            shift_id: input.shiftId,
            effective_date: input.effectiveDate,
            end_date: null,
            is_current: true,
            allow_multiple_clockin: !!input.allowMultipleClockin,
          },
        ]);
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-shifts'] });
      toast({ title: 'Saved', description: 'Shift assignment updated' });
    },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const toggleMultipleClockInMutation = useMutation({
    mutationFn: async (input: { shiftAssignmentId: string; allow: boolean }) => {
      const { error } = await db
        .from('employee_shifts')
        .update({ allow_multiple_clockin: input.allow })
        .eq('id', input.shiftAssignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-shifts'] });
      queryClient.invalidateQueries({ queryKey: ['multiple-clockin-allowed'] });
      toast({ title: 'Saved', description: 'Multiple clock-in setting updated' });
    },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  return {
    ...query,
    assignShift: assignShiftMutation.mutateAsync,
    isAssigning: assignShiftMutation.isPending,
    toggleMultipleClockin: toggleMultipleClockInMutation.mutateAsync,
    isTogglingMultipleClockin: toggleMultipleClockInMutation.isPending,
  };
}
