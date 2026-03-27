import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { AttendanceRecord, AttendanceRecordStatus } from '@/types/attendance';

export interface AttendanceRecordsFilter {
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  employeeId?: string;
  departmentId?: string;
  statuses?: AttendanceRecordStatus[];
}

export function useAttendanceRecords(filter?: AttendanceRecordsFilter) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const db = supabase as any;

  const query = useQuery({
    queryKey: ['attendance-records', filter || {}],
    queryFn: async () => {
      let q = db
        .from('attendance_records')
        .select(`
          *,
          profiles:profiles!attendance_records_employee_id_fkey(
            id,
            employee_id,
            full_name,
            department_id,
            departments(name)
          ),
          shift:shifts(*),
          attendance_imports:attendance_imports(id, filename, status),
          attendance_sessions(id, session_number, clock_in, clock_out)
        `)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (filter?.startDate) q = q.gte('date', filter.startDate);
      if (filter?.endDate) q = q.lte('date', filter.endDate);
      if (filter?.employeeId) q = q.eq('employee_id', filter.employeeId);
      if (filter?.statuses && filter.statuses.length > 0) q = q.in('status', filter.statuses);
      if (filter?.departmentId) {
        const { data: emps, error: empErr } = await db
          .from('profiles')
          .select('id')
          .eq('department_id', filter.departmentId);
        if (empErr) throw empErr;
        const ids = (emps || []).map((e: any) => String(e.id));
        if (ids.length === 0) return [] as AttendanceRecord[];
        q = q.in('employee_id', ids);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as AttendanceRecord[];
    },
    staleTime: 15 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: async (input: { id: string; values: Partial<AttendanceRecord> }) => {
      const { error } = await db
        .from('attendance_records')
        .update(input.values)
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-records'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-summary'] });
      toast({ title: 'Saved', description: 'Attendance record updated' });
    },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (input: { id: string }) => {
      const { error } = await db.from('attendance_records').delete().eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-records'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-summary'] });
      toast({ title: 'Deleted', description: 'Attendance record deleted' });
    },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  return {
    ...query,
    updateRecord: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteRecord: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
