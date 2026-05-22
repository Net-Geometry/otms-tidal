import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { Building2, Clock, DollarSign, Download, Filter, Search, Users } from 'lucide-react';

import { EnhancedDashboardCard } from '@/components/hr/EnhancedDashboardCard';
import { GenerateReportDialog } from '@/components/hr/reports/GenerateReportDialog';
import { HRReportTable } from '@/components/hr/reports/HRReportTable';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useHRReportData } from '@/hooks/useHRReportData';
import { supabase } from '@/integrations/supabase/client';
import { groupByCompany } from '@/lib/companyReportUtils';
import { buildOTManagementExportRows } from '@/lib/otManagementExport';
import { formatCurrency, formatHours } from '@/lib/otCalculations';
import { exportToXLSX } from '@/lib/xlsxExport';
import { CompanyReportCard } from './CompanyReportCard';

type ReportView = 'summary' | 'submissions';

export function MonthlyOTReport() {
  const [searchQuery, setSearchQuery] = useState('');
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>((currentDate.getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState<string>(currentDate.getFullYear().toString());
  const [appliedMonth, setAppliedMonth] = useState<string>((currentDate.getMonth() + 1).toString());
  const [appliedYear, setAppliedYear] = useState<string>(currentDate.getFullYear().toString());
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedPosition, setSelectedPosition] = useState<string>('all');
  const [reportView, setReportView] = useState<ReportView>('summary');

  const filterDate = useMemo(() => {
    return new Date(parseInt(appliedYear), parseInt(appliedMonth) - 1, 1);
  }, [appliedMonth, appliedYear]);

  const { data, isLoading } = useHRReportData(filterDate);
  const submissionStartDate = format(startOfMonth(filterDate), 'yyyy-MM-dd');
  const submissionEndDate = format(endOfMonth(filterDate), 'yyyy-MM-dd');

  const { data: submissionData = [], isLoading: isLoadingSubmissions } = useQuery({
    queryKey: ['monthly-ot-all-submissions', submissionStartDate, submissionEndDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ot_requests')
        .select(`
          *,
          profiles!ot_requests_employee_id_fkey(
            employee_id,
            full_name,
            department_id,
            position_id,
            company_id,
            departments!profiles_department_id_fkey(name),
            positions!profiles_position_id_fkey(title),
            companies!profiles_company_id_fkey(id, name, code)
          )
        `)
        .gte('ot_date', submissionStartDate)
        .lte('ot_date', submissionEndDate)
        .order('ot_date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const aggregatedData = data?.aggregated || [];

  const uniqueCompanies = useMemo(() => {
    const companies = new Map<string, { name: string; code: string }>();

    aggregatedData.forEach((item) => {
      if (!companies.has(item.company_id)) {
        companies.set(item.company_id, {
          name: item.company_name,
          code: item.company_code,
        });
      }
    });

    (submissionData as any[]).forEach((item) => {
      const company = item.profiles?.companies;
      const companyId = item.profiles?.company_id || company?.id;

      if (companyId && !companies.has(companyId)) {
        companies.set(companyId, {
          name: company?.name || 'Unknown Company',
          code: company?.code || 'N/A',
        });
      }
    });

    return Array.from(companies.entries())
      .map(([id, info]) => ({ id, name: info.name, code: info.code }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [aggregatedData, submissionData]);

  const uniqueDepartments = useMemo(() => {
    const departments = new Set<string>();

    aggregatedData.forEach((item) => {
      if (item.department && item.department !== 'N/A') departments.add(item.department);
    });

    (submissionData as any[]).forEach((item) => {
      const department = item.profiles?.departments?.name;
      if (department && department !== 'N/A') departments.add(department);
    });

    return Array.from(departments).sort((a, b) => a.localeCompare(b));
  }, [aggregatedData, submissionData]);

  const uniquePositions = useMemo(() => {
    const positions = new Set<string>();

    aggregatedData.forEach((item) => {
      if (item.position && item.position !== 'N/A') positions.add(item.position);
    });

    (submissionData as any[]).forEach((item) => {
      const position = item.profiles?.positions?.title;
      if (position && position !== 'N/A') positions.add(position);
    });

    return Array.from(positions).sort((a, b) => a.localeCompare(b));
  }, [aggregatedData, submissionData]);

  const filteredData = useMemo(() => {
    const query = searchQuery.toLowerCase();

    return aggregatedData.filter((item) => {
      const matchesCompany = selectedCompany === 'all' || item.company_id === selectedCompany;
      const matchesDepartment = selectedDepartment === 'all' || item.department === selectedDepartment;
      const matchesPosition = selectedPosition === 'all' || item.position === selectedPosition;
      const matchesStructuredFilters = matchesCompany && matchesDepartment && matchesPosition;

      if (!query) return matchesStructuredFilters;

      return matchesStructuredFilters && (
        item.employee_no.toLowerCase().includes(query) ||
        item.employee_name.toLowerCase().includes(query) ||
        item.department.toLowerCase().includes(query) ||
        item.position.toLowerCase().includes(query) ||
        item.company_name.toLowerCase().includes(query) ||
        item.company_code.toLowerCase().includes(query)
      );
    });
  }, [aggregatedData, searchQuery, selectedCompany, selectedDepartment, selectedPosition]);

  const filteredSubmissions = useMemo(() => {
    const query = searchQuery.toLowerCase();

    return (submissionData as any[])
      .filter((item) => {
        const profile = item.profiles;
        const companyId = profile?.company_id || profile?.companies?.id;
        const department = profile?.departments?.name || 'N/A';
        const position = profile?.positions?.title || 'N/A';
        const matchesCompany = selectedCompany === 'all' || companyId === selectedCompany;
        const matchesDepartment = selectedDepartment === 'all' || department === selectedDepartment;
        const matchesPosition = selectedPosition === 'all' || position === selectedPosition;
        const matchesStructuredFilters = matchesCompany && matchesDepartment && matchesPosition;

        if (!query) return matchesStructuredFilters;

        return matchesStructuredFilters && (
          String(item.ticket_number || '').toLowerCase().includes(query) ||
          String(profile?.employee_id || '').toLowerCase().includes(query) ||
          String(profile?.full_name || '').toLowerCase().includes(query) ||
          String(department).toLowerCase().includes(query) ||
          String(position).toLowerCase().includes(query) ||
          String(profile?.companies?.name || '').toLowerCase().includes(query) ||
          String(item.status || '').toLowerCase().includes(query)
        );
      })
      .map((item) => ({
        ...item,
        sessions: [{
          start_time: item.start_time,
          end_time: item.end_time,
          total_hours: item.total_hours,
        }],
      }));
  }, [searchQuery, selectedCompany, selectedDepartment, selectedPosition, submissionData]);

  const submissionRows = useMemo(() => buildOTManagementExportRows(filteredSubmissions), [filteredSubmissions]);
  const companyGroups = useMemo(() => groupByCompany(filteredData), [filteredData]);

  const filteredStats = useMemo(() => {
    const uniqueCompanies = new Set(filteredData.map((item) => item.company_id)).size;
    const totalEmployees = filteredData.length;
    const totalHours = filteredData.reduce((sum, item) => sum + item.total_ot_hours, 0);
    const totalCost = filteredData.reduce((sum, item) => sum + item.amount, 0);

    return { totalCompanies: uniqueCompanies, totalEmployees, totalHours, totalCost };
  }, [filteredData]);

  const handleExportAllSubmissionsExcel = async () => {
    if (submissionRows.length === 0) {
      toast({
        title: 'No data to export',
        description: 'There are no OT submissions for the selected filters.',
        variant: 'destructive',
      });
      return;
    }

    await exportToXLSX(
      submissionRows,
      `OT_All_Submissions_${format(filterDate, 'MMM_yyyy')}`,
      [
        { key: 'ticket_number', label: 'Ticket #' },
        { key: 'employee_no', label: 'Employee No.' },
        { key: 'employee_name', label: 'Employee Name' },
        { key: 'company', label: 'Company' },
        { key: 'department', label: 'Department' },
        { key: 'ot_date', label: 'OT Date' },
        { key: 'sessions', label: 'Submitted OT Sessions' },
        { key: 'total_hours', label: 'Total OT Hours' },
        { key: 'ot_amount', label: 'OT Amount (RM)' },
        { key: 'current_status', label: 'Current Status' },
        { key: 'included_in_claim', label: 'Included In Claim' },
        { key: 'claim_amount', label: 'Claim Amount (RM)' },
        { key: 'supervisor_date', label: 'Supervisor Date' },
        { key: 'respective_supervisor_date', label: 'Respective Supervisor Date' },
        { key: 'hr_certified_date', label: 'HR Certified Date' },
        { key: 'management_approved_date', label: 'Management Approved Date' },
        { key: 'rejection_stage', label: 'Rejection Stage' },
        { key: 'remarks', label: 'Remarks' },
      ],
      {
        reportName: 'OT All Submissions',
        period: format(filterDate, 'MMMM yyyy'),
        generatedDate: format(new Date(), 'dd/MM/yyyy HH:mm'),
      },
    );

    toast({
      title: 'Report exported',
      description: 'All submissions Excel file has been downloaded successfully.',
    });
  };

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <EnhancedDashboardCard title="Total Companies" value={filteredStats.totalCompanies} icon={Building2} variant="primary" subtitle="Companies in system" />
        <EnhancedDashboardCard title="Total Employees" value={filteredStats.totalEmployees} icon={Users} variant="info" subtitle="Employees with OT this month" />
        <EnhancedDashboardCard title="Total OT Hours" value={formatHours(filteredStats.totalHours)} icon={Clock} variant="info" subtitle="Total approved hours this month" />
        <EnhancedDashboardCard title="Total OT Cost" value={formatCurrency(filteredStats.totalCost)} icon={DollarSign} variant="success" subtitle="Total RM paid for overtime this month" />
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Monthly OT Report</h2>
              <div className="flex rounded-lg border border-border bg-background p-1 text-sm">
                <button type="button" onClick={() => setReportView('summary')} className={`rounded-md px-3 py-1.5 transition ${reportView === 'summary' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  Approved Summary
                </button>
                <button type="button" onClick={() => setReportView('submissions')} className={`rounded-md px-3 py-1.5 transition ${reportView === 'submissions' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  All Submissions
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[140px] border-input bg-background focus:border-ring focus:ring-ring"><SelectValue placeholder="Select Month" /></SelectTrigger>
                <SelectContent className="bg-popover z-50 border shadow-lg">
                  {MONTHS.map((month) => <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[100px] border-input bg-background focus:border-ring focus:ring-ring"><SelectValue placeholder="Select Year" /></SelectTrigger>
                <SelectContent className="bg-popover z-50 border shadow-lg">
                  {Array.from({ length: 5 }, (_, i) => {
                    const year = new Date().getFullYear() - i;
                    return <SelectItem key={year} value={year.toString()}>{year}</SelectItem>;
                  })}
                </SelectContent>
              </Select>

              <Button onClick={() => { setAppliedMonth(selectedMonth); setAppliedYear(selectedYear); }} disabled={isLoading || isLoadingSubmissions} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5 transition-all duration-200">
                <Filter className="mr-2 h-4 w-4" />
                Apply Filter
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by employee, department, position, ticket, or status..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="pl-10" />
            </div>
            <div className="flex gap-2">
              {reportView === 'submissions' && (
                <Button variant="outline" onClick={handleExportAllSubmissionsExcel} disabled={isLoadingSubmissions || submissionRows.length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Excel
                </Button>
              )}
              {reportView === 'summary' && <GenerateReportDialog defaultMonth={appliedMonth} defaultYear={appliedYear} />}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <FilterSelect label="Company" value={selectedCompany} onValueChange={setSelectedCompany} allLabel="All Companies" items={uniqueCompanies.map((company) => ({ value: company.id, label: `${company.name} (${company.code})` }))} />
            <FilterSelect label="Department" value={selectedDepartment} onValueChange={setSelectedDepartment} allLabel="All Departments" items={uniqueDepartments.map((department) => ({ value: department, label: department }))} />
            <FilterSelect label="Position" value={selectedPosition} onValueChange={setSelectedPosition} allLabel="All Positions" items={uniquePositions.map((position) => ({ value: position, label: position }))} />
          </div>

          {reportView === 'summary' ? (
            <div className="space-y-4">
              {companyGroups.map((company, index) => (
                <CompanyReportCard key={company.companyId} companyName={company.companyName} companyCode={company.companyCode} stats={company.stats} defaultExpanded={index === 0}>
                  <HRReportTable data={company.employees} isLoading={false} selectedMonth={filterDate} />
                </CompanyReportCard>
              ))}

              {companyGroups.length === 0 && !isLoading && <div className="text-center py-12 text-muted-foreground">No overtime data found for the selected period.</div>}
            </div>
          ) : (
            <AllSubmissionsTable rows={submissionRows} isLoading={isLoadingSubmissions} />
          )}
        </div>
      </Card>
    </>
  );
}

function FilterSelect({ label, value, onValueChange, allLabel, items }: { label: string; value: string; onValueChange: (value: string) => void; allLabel: string; items: { value: string; label: string }[] }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="border-input bg-background focus:border-ring focus:ring-ring"><SelectValue placeholder={allLabel} /></SelectTrigger>
        <SelectContent className="bg-popover z-50 border shadow-lg">
          <SelectItem value="all">{allLabel}</SelectItem>
          {items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function AllSubmissionsTable({ rows, isLoading }: { rows: ReturnType<typeof buildOTManagementExportRows>; isLoading: boolean }) {
  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading submissions...</div>;
  if (rows.length === 0) return <div className="text-center py-12 text-muted-foreground">No OT submissions found for the selected filters.</div>;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Ticket #</th>
            <th className="px-4 py-3 text-left font-medium">Employee</th>
            <th className="px-4 py-3 text-left font-medium">Company</th>
            <th className="px-4 py-3 text-left font-medium">Department</th>
            <th className="px-4 py-3 text-left font-medium">OT Date</th>
            <th className="px-4 py-3 text-left font-medium">Sessions</th>
            <th className="px-4 py-3 text-right font-medium">Hours</th>
            <th className="px-4 py-3 text-right font-medium">Amount</th>
            <th className="px-4 py-3 text-left font-medium">Current Status</th>
            <th className="px-4 py-3 text-left font-medium">Included In Claim</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.ticket_number}-${row.ot_date}-${row.sessions}`} className="border-t border-border">
              <td className="px-4 py-3 font-mono text-primary">{row.ticket_number}</td>
              <td className="px-4 py-3"><div className="font-medium">{row.employee_name}</div><div className="text-xs text-muted-foreground">{row.employee_no}</div></td>
              <td className="px-4 py-3">{row.company}</td>
              <td className="px-4 py-3">{row.department}</td>
              <td className="px-4 py-3 whitespace-nowrap">{row.ot_date}</td>
              <td className="px-4 py-3 min-w-[220px]">{row.sessions}</td>
              <td className="px-4 py-3 text-right">{formatHours(row.total_hours)}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(row.ot_amount)}</td>
              <td className="px-4 py-3 whitespace-nowrap">{row.current_status}</td>
              <td className="px-4 py-3">{row.included_in_claim}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];
