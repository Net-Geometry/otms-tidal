import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, DollarSign, Clock, Building2, Users, Download, FileText, Filter } from 'lucide-react';
import { EnhancedDashboardCard } from '@/components/hr/EnhancedDashboardCard';
import { HRReportTable } from '@/components/hr/reports/HRReportTable';
import { CompanyReportCard } from '@/components/reports/CompanyReportCard';
import { useHRReportData } from '@/hooks/useHRReportData';
import { useCompanyProfile } from '@/hooks/hr/useCompanyProfile';
import { exportToCSV } from '@/lib/exportUtils';
import { generateHRReportPDF } from '@/lib/hrReportPdfGenerator';
import { groupByCompany, calculateOverallStats } from '@/lib/companyReportUtils';
import { formatCurrency, formatHours } from '@/lib/otCalculations';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function OTReports() {
  const [searchQuery, setSearchQuery] = useState('');

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>((currentDate.getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState<string>(currentDate.getFullYear().toString());
  const [appliedMonth, setAppliedMonth] = useState<string>((currentDate.getMonth() + 1).toString());
  const [appliedYear, setAppliedYear] = useState<string>(currentDate.getFullYear().toString());
  const [selectedCompany, setSelectedCompany] = useState<string>('all');

  const filterDate = useMemo(() => {
    return new Date(parseInt(appliedYear), parseInt(appliedMonth) - 1, 1);
  }, [appliedMonth, appliedYear]);

  const { data, isLoading } = useHRReportData(filterDate);
  const { data: companyProfile } = useCompanyProfile();

  const aggregatedData = data?.aggregated || [];

  const uniqueCompanies = useMemo(() => {
    const companies = new Map<string, { name: string; code: string }>();
    aggregatedData.forEach(item => {
      if (!companies.has(item.company_id)) {
        companies.set(item.company_id, {
          name: item.company_name,
          code: item.company_code
        });
      }
    });
    return Array.from(companies.entries()).map(([id, info]) => ({
      id,
      name: info.name,
      code: info.code
    }));
  }, [aggregatedData]);

  const filteredData = aggregatedData.filter(item => {
    // Company filter
    const matchesCompany = selectedCompany === 'all' || item.company_id === selectedCompany;

    // Search filter
    if (!searchQuery) return matchesCompany;

    const query = searchQuery.toLowerCase();
    const matchesSearch = (
      item.employee_no.toLowerCase().includes(query) ||
      item.employee_name.toLowerCase().includes(query) ||
      item.department.toLowerCase().includes(query) ||
      item.position.toLowerCase().includes(query) ||
      item.company_name.toLowerCase().includes(query) ||
      item.company_code.toLowerCase().includes(query)
    );

    return matchesCompany && matchesSearch;
  });

  const filteredStats = useMemo(() => {
    const uniqueCompanies = new Set(filteredData.map(item => item.company_id)).size;
    const totalEmployees = filteredData.length;
    const totalHours = filteredData.reduce((sum, item) => sum + item.total_ot_hours, 0);
    const totalCost = filteredData.reduce((sum, item) => sum + item.amount, 0);

    return {
      totalCompanies: uniqueCompanies,
      totalEmployees,
      totalHours,
      totalCost
    };
  }, [filteredData]);

  const companyGroups = useMemo(() => groupByCompany(filteredData), [filteredData]);

  const handleExportCSV = () => {
    if (filteredData.length === 0) {
      toast({
        title: 'No data to export',
        description: 'There is no data available for the selected period.',
        variant: 'destructive'
      });
      return;
    }

    const headers = [
      { key: 'company_name', label: 'Company' },
      { key: 'company_code', label: 'Company Code' },
      { key: 'employee_no', label: 'Employee No.' },
      { key: 'employee_name', label: 'Name' },
      { key: 'department', label: 'Department' },
      { key: 'position', label: 'Position' },
      { key: 'total_ot_hours', label: 'Total OT Hours' },
      { key: 'amount', label: 'Amount (RM)' },
      { key: 'monthly_total', label: 'Monthly Total (RM)' }
    ];

    const formattedData = filteredData.map(row => ({
      ...row,
      total_ot_hours: formatHours(row.total_ot_hours),
      amount: formatCurrency(row.amount),
      monthly_total: formatCurrency(row.monthly_total)
    }));

    const monthStr = format(filterDate, 'MMM_yyyy');
    exportToCSV(
      formattedData,
      `HR_OT_Report_${monthStr}`,
      headers,
      {
        reportName: 'HR Overtime Report',
        period: format(filterDate, 'MMMM yyyy'),
        generatedDate: format(new Date(), 'dd/MM/yyyy HH:mm')
      }
    );

    toast({
      title: 'Report exported',
      description: 'Excel file has been downloaded successfully.'
    });
  };

  const handleExportPDF = async () => {
    if (filteredData.length === 0) {
      toast({
        title: 'No data to export',
        description: 'There is no data available for the selected period.',
        variant: 'destructive'
      });
      return;
    }

    if (!companyProfile) {
      toast({
        title: 'Company profile not found',
        description: 'Please configure company profile in settings.',
        variant: 'destructive'
      });
      return;
    }

    try {
      await generateHRReportPDF({
        companyInfo: {
          name: companyProfile.name,
          registrationNo: companyProfile.registration_no,
          address: companyProfile.address,
          phone: companyProfile.phone,
          logoUrl: companyProfile.logo_url || undefined,
        },
        period: format(filterDate, 'MMMM yyyy'),
        generatedDate: format(new Date(), 'dd/MM/yyyy HH:mm'),
        summary: {
          totalHours: filteredStats.totalHours,
          totalCost: filteredStats.totalCost,
          totalEmployees: filteredStats.totalEmployees,
          totalCompanies: filteredStats.totalCompanies,
        },
        companyGroups: companyGroups,
      });

      toast({
        title: 'PDF generated',
        description: 'Report has been downloaded successfully.'
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Export failed',
        description: 'Failed to generate PDF report.',
        variant: 'destructive'
      });
    }
  };

  return (
    <AppLayout>
      <PageLayout
        title="OT Reports"
        description="Filter and export monthly overtime summaries by department and employee."
      >

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <EnhancedDashboardCard
            title="Total Companies"
            value={filteredStats.totalCompanies}
            icon={Building2}
            variant="primary"
            subtitle="Companies in system"
          />
          <EnhancedDashboardCard
            title="Total Employees"
            value={filteredStats.totalEmployees}
            icon={Users}
            variant="info"
            subtitle="Employees with OT this month"
          />
          <EnhancedDashboardCard
            title="Total OT Hours"
            value={formatHours(filteredStats.totalHours)}
            icon={Clock}
            variant="info"
            subtitle="Total approved hours this month"
          />
          <EnhancedDashboardCard
            title="Total OT Cost"
            value={formatCurrency(filteredStats.totalCost)}
            icon={DollarSign}
            variant="success"
            subtitle="Total RM paid for overtime this month"
          />
        </div>

        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">Monthly OT Summary Report</h2>

              <div className="flex items-center gap-3">
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[180px] border-[#E5E7EB] focus:border-[#5F26B4] focus:ring-[#5F26B4]">
                    <SelectValue placeholder="Select Month" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50 border shadow-lg">
                    <SelectItem value="1">January</SelectItem>
                    <SelectItem value="2">February</SelectItem>
                    <SelectItem value="3">March</SelectItem>
                    <SelectItem value="4">April</SelectItem>
                    <SelectItem value="5">May</SelectItem>
                    <SelectItem value="6">June</SelectItem>
                    <SelectItem value="7">July</SelectItem>
                    <SelectItem value="8">August</SelectItem>
                    <SelectItem value="9">September</SelectItem>
                    <SelectItem value="10">October</SelectItem>
                    <SelectItem value="11">November</SelectItem>
                    <SelectItem value="12">December</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-[120px] border-[#E5E7EB] focus:border-[#5F26B4] focus:ring-[#5F26B4]">
                    <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50 border shadow-lg">
                    {Array.from({ length: 5 }, (_, i) => {
                      const year = new Date().getFullYear() - i;
                      return (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                <Button
                  onClick={() => {
                    setAppliedMonth(selectedMonth);
                    setAppliedYear(selectedYear);
                  }}
                  disabled={isLoading}
                  className="bg-[#5F26B4] hover:bg-[#4C1D95] text-white font-semibold px-5 transition-all duration-200"
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Apply Filter
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by employee, department, or position..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleExportCSV}
                  disabled={isLoading || filteredData.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Excel
                </Button>
                <Button
                  onClick={handleExportPDF}
                  disabled={isLoading || filteredData.length === 0}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Export PDF
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {companyGroups.map((company, index) => (
                <CompanyReportCard
                  key={company.companyId}
                  companyName={company.companyName}
                  companyCode={company.companyCode}
                  stats={company.stats}
                  defaultExpanded={index === 0}
                >
                  <HRReportTable
                    data={company.employees}
                    isLoading={false}
                    selectedMonth={filterDate}
                  />
                </CompanyReportCard>
              ))}

              {companyGroups.length === 0 && !isLoading && (
                <div className="text-center py-12 text-muted-foreground">
                  No overtime data found for the selected period.
                </div>
              )}
            </div>
          </div>
        </Card>
      </PageLayout>
    </AppLayout>
  );
}
