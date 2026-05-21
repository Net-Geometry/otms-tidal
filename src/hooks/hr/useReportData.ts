import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export interface ReportEmployee {
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
}

interface ReportStats {
  totalEmployees: number;
  totalHours: number;
  totalCost: number;
  totalCompanies: number;
}

interface ReportProfile {
  id: string;
  employee_id: string | null;
  full_name: string | null;
  company_id: string | null;
  department_id: string | null;
  position_id: string | null;
  departments: { name: string | null; code: string | null } | null;
  positions: { title: string | null } | null;
  companies: {
    id: string;
    name: string | null;
    code: string | null;
    parent_company_id: string | null;
  } | null;
}

interface UseReportDataParams {
  month: Date;
  reportType: 'combined' | 'individual';
  companyId?: string;
  enabled?: boolean;
}

export function useReportData({ month, reportType, companyId, enabled = false }: UseReportDataParams) {
  const startDate = format(startOfMonth(month), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(month), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['report-data', startDate, endDate, reportType, companyId],
    enabled,
    queryFn: async (): Promise<{ employees: ReportEmployee[]; stats: ReportStats }> => {
      // Fetch approved OT requests for the date range
      const { data: otRequests, error: otError } = await supabase
        .from('ot_requests')
        .select(`
          id,
          employee_id,
          ot_date,
          total_hours,
          ot_amount,
          status
        `)
        .gte('ot_date', startDate)
        .lte('ot_date', endDate)
        .in('status', ['management_approved'])
        .order('ot_date', { ascending: false });

      if (otError) throw otError;

      // Fetch profiles with company, department, and position joins
      const { data: profiles, error: profileError } = await supabase
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
          companies!profiles_company_id_fkey(id, name, code, parent_company_id)
        `);

      if (profileError) throw profileError;

      const reportProfiles = (profiles ?? []) as ReportProfile[];

      // Build a profile map keyed by profile id
      const profileMap = new Map<string, ReportProfile>(
        reportProfiles.map(p => [p.id, p])
      );

      // Determine which employees to include based on report type
      const includedProfileIds = new Set<string>();

      if (reportType !== 'combined') {
        // Individual: include only employees whose company_id matches the selected companyId
        if (companyId) {
          reportProfiles.forEach(p => {
            if (p.company_id === companyId) {
              includedProfileIds.add(p.id);
            }
          });
        }
      }

      // Aggregate OT by employee, filtering to included profiles
      const grouped = new Map<string, ReportEmployee>();

      (otRequests || []).forEach(req => {
        const empId = req.employee_id;

        // Combined reports mirror the on-screen summary and include every approved OT row.
        if (reportType !== 'combined' && !includedProfileIds.has(empId)) return;

        const profile = profileMap.get(empId);

        if (!grouped.has(empId)) {
          const company = profile?.companies;
          grouped.set(empId, {
            employee_id: empId,
            employee_no: profile?.employee_id || empId,
            employee_name: profile?.full_name || 'Unknown',
            department: profile?.departments?.name || 'N/A',
            position: profile?.positions?.title || 'N/A',
            company_id: profile?.company_id || 'unknown',
            company_name: company?.name || 'Unknown Company',
            company_code: company?.code || 'N/A',
            total_ot_hours: 0,
            amount: 0,
          });
        }

        const emp = grouped.get(empId)!;
        emp.total_ot_hours += req.total_hours || 0;
        emp.amount += req.ot_amount || 0;
      });

      // Sort by company_name then employee_name
      const employees = Array.from(grouped.values()).sort((a, b) => {
        const companyCompare = a.company_name.localeCompare(b.company_name);
        if (companyCompare !== 0) return companyCompare;
        return a.employee_name.localeCompare(b.employee_name);
      });

      // Calculate stats
      const uniqueCompanies = new Set(employees.map(e => e.company_id));
      const stats: ReportStats = {
        totalEmployees: employees.length,
        totalHours: employees.reduce((sum, e) => sum + e.total_ot_hours, 0),
        totalCost: employees.reduce((sum, e) => sum + e.amount, 0),
        totalCompanies: uniqueCompanies.size,
      };

      return { employees, stats };
    },
  });
}
