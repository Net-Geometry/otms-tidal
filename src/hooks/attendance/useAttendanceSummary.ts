import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AttendanceMonthlySummary, AttendanceRecord } from '@/types/attendance';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function monthRange(year: number, month: number) {
  const start = `${year}-${pad2(month)}-01`;
  const endDate = new Date(year, month, 0);
  const end = `${year}-${pad2(month)}-${pad2(endDate.getDate())}`;
  return { start, end };
}

export function useAttendanceSummary(options: {
  year: number;
  month: number; // 1-12
  departmentId?: string;
  employeeId?: string;
}) {
  const db = supabase as any;
  const { start, end } = monthRange(options.year, options.month);

  return useQuery({
    queryKey: ['attendance-summary', options],
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
          )
        `)
        .gte('date', start)
        .lte('date', end);

      if (options.employeeId) q = q.eq('employee_id', options.employeeId);
      if (options.departmentId) {
        const { data: emps, error: empErr } = await db
          .from('profiles')
          .select('id')
          .eq('department_id', options.departmentId);
        if (empErr) throw empErr;
        const ids = (emps || []).map((e: any) => String(e.id));
        if (ids.length === 0) return [] as AttendanceMonthlySummary[];
        q = q.in('employee_id', ids);
      }

      const { data, error } = await q;
      if (error) throw error;
      const records = (data || []) as AttendanceRecord[];

      const byEmp = new Map<string, AttendanceMonthlySummary>();
      for (const r of records) {
        const p = r.profiles;
        const empId = r.employee_id;
        const existing = byEmp.get(empId);
        const summary: AttendanceMonthlySummary = existing || {
          employee_id: empId,
          employee_code: p?.employee_id || empId,
          employee_name: p?.full_name || empId,
          department_name: p?.departments?.name || '—',
          present_count: 0,
          late_count: 0,
          absent_count: 0,
          total_records: 0,
          late_minutes_total: 0,
        };

        summary.total_records += 1;
        if (r.status === 'late') summary.late_count += 1;
        else if (r.status === 'absent') summary.absent_count += 1;
        else if (r.status === 'present') summary.present_count += 1;

        summary.late_minutes_total += Number(r.late_minutes || 0);
        byEmp.set(empId, summary);
      }

      return Array.from(byEmp.values()).sort((a, b) => a.employee_name.localeCompare(b.employee_name));
    },
    staleTime: 30 * 1000,
  });
}
