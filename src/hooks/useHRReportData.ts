import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, format } from 'date-fns';

interface EmployeeOTSummary {
  employee_id: string;
  employee_no: string;
  employee_name: string;
  department: string;
  position: string;
  company_id: string;
  company_name: string;
  company_code: string;
  total_ot_hours: number;
  amount: number;
  monthly_total: number;
}

type ReportPeriodMode = 'all' | 'year' | 'month';

export function useHRReportData(selectedMonth?: Date, periodMode: ReportPeriodMode = 'month') {
  const month = selectedMonth || new Date();
  const startDate = periodMode === 'year'
    ? format(new Date(month.getFullYear(), 0, 1), 'yyyy-MM-dd')
    : format(startOfMonth(month), 'yyyy-MM-dd');
  const endDate = periodMode === 'year'
    ? format(new Date(month.getFullYear(), 11, 31), 'yyyy-MM-dd')
    : format(endOfMonth(month), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['hr-report', startDate, endDate, periodMode],
    queryFn: async () => {
      // Fetch OT requests
      let otQuery = supabase
        .from('ot_requests')
        .select(`
          id,
          employee_id,
          ot_date,
          total_hours,
          ot_amount,
          status,
          threshold_violations
        `)
        .in('status', ['management_approved']);

      if (periodMode !== 'all') {
        otQuery = otQuery.gte('ot_date', startDate).lte('ot_date', endDate);
      }

      const { data, error } = await otQuery.order('ot_date', { ascending: false });

      if (error) throw error;

      // Fetch current employee profiles separately to ensure we get latest company assignment
      const { data: currentProfiles, error: profileError } = await supabase
        .from('profiles')
        .select(`
          id,
          employee_id,
          full_name,
          company_id,
          department_id,
          position_id,
          departments!profiles_department_id_fkey(name, code),
          positions!profiles_position_id_fkey(title),
          companies!profiles_company_id_fkey(name, code)
        `);

      if (profileError) throw profileError;

      // Create a map for quick lookup of current profile data
      const profileMap = new Map(currentProfiles?.map(p => [p.id, p]) || []);

      // Aggregate by employee using current profile data
      const aggregated = aggregateByEmployee(data || [], profileMap);
      
      // Calculate stats
      const stats = calculateStats(data || []);

      return {
        rawData: data || [],
        aggregated,
        stats
      };
    }
  });
}

function aggregateByEmployee(requests: any[], profileMap: Map<string, any>): EmployeeOTSummary[] {
  const grouped = new Map<string, EmployeeOTSummary>();
  
  requests.forEach(req => {
    const empId = req.employee_id;
    const profile = profileMap.get(empId);
    
    if (!grouped.has(empId)) {
      grouped.set(empId, {
        employee_id: empId,
        employee_no: profile?.employee_id || empId,
        employee_name: profile?.full_name || 'Unknown',
        department: profile?.departments?.name || 'N/A',
        position: profile?.positions?.title || 'N/A',
        company_id: profile?.company_id || 'unknown',
        company_name: profile?.companies?.name || 'Unknown Company',
        company_code: profile?.companies?.code || 'N/A',
        total_ot_hours: 0,
        amount: 0,
        monthly_total: 0
      });
    }
    
    const emp = grouped.get(empId)!;
    emp.total_ot_hours += req.total_hours || 0;
    emp.amount += req.ot_amount || 0;
    emp.monthly_total = emp.amount;
  });
  
  return Array.from(grouped.values());
}

function calculateStats(requests: any[]) {
  return {
    pendingReview: requests.filter(r => r.status === 'supervisor_verified').length,
    totalHours: requests.reduce((sum, r) => sum + (r.total_hours || 0), 0),
    totalCost: requests.reduce((sum, r) => sum + (r.ot_amount || 0), 0)
  };
}
