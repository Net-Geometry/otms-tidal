import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { FileSpreadsheet, Download } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

import { useCompaniesGrouped } from '@/hooks/hr/useCompanies';
import { useReportData } from '@/hooks/hr/useReportData';
import { generateCombinedReportPDF, generateHRReportPDF } from '@/lib/hrReportPdfGenerator';
import { exportToXLSX } from '@/lib/xlsxExport';
import { groupByCompany } from '@/lib/companyReportUtils';

interface GenerateReportDialogProps {
  defaultMonth: string; // e.g. "2" for February
  defaultYear: string;  // e.g. "2026"
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SHORT_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function GenerateReportDialog({ defaultMonth, defaultYear }: GenerateReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [reportType, setReportType] = useState<'all_companies' | 'by_company' | 'by_year' | 'by_month'>('all_companies');
  const [companyPeriodMode, setCompanyPeriodMode] = useState<'all' | 'year' | 'month'>('all');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [generating, setGenerating] = useState(false);

  const { data: companiesGrouped } = useCompaniesGrouped();

  const monthDate = new Date(Number(selectedYear), Number(selectedMonth) - 1, 1);
  const periodMode = reportType === 'all_companies'
    ? 'all'
    : reportType === 'by_company'
    ? companyPeriodMode
    : reportType === 'by_year'
    ? 'year'
    : 'month';

  const { refetch } = useReportData({
    month: monthDate,
    reportType: reportType === 'by_company' ? 'individual' : 'combined',
    companyId: reportType === 'by_company' ? selectedCompanyId : undefined,
    periodMode,
    enabled: false,
  });

  const parentCompany = companiesGrouped?.parent;
  const reportCompanies = companiesGrouped?.all ?? [];

  const periodLabel = periodMode === 'all'
    ? 'All Periods'
    : periodMode === 'year'
    ? selectedYear
    : `${MONTH_NAMES[Number(selectedMonth) - 1]} ${selectedYear}`;
  const shortPeriodLabel = periodMode === 'all'
    ? 'All_Periods'
    : periodMode === 'year'
    ? selectedYear
    : `${SHORT_MONTH_NAMES[Number(selectedMonth) - 1]}_${selectedYear}`;

  const isDownloadDisabled = generating || (reportType === 'by_company' && !selectedCompanyId);

  // Build year options (current year +/- 2)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentYear - 2 + i));

  const handleReportTypeChange = useCallback((value: string) => {
    setReportType(value as 'all_companies' | 'by_company' | 'by_year' | 'by_month');
    setSelectedCompanyId('');
    setCompanyPeriodMode('all');
  }, []);

  const handleDownloadPDF = useCallback(async () => {
    setGenerating(true);
    try {
      const { data } = await refetch();
      if (!data || data.employees.length === 0) {
        toast({
          title: 'No data found',
          description: 'There are no approved OT records for the selected period.',
          variant: 'destructive',
        });
        return;
      }

      const generatedDate = format(new Date(), 'dd MMM yyyy, hh:mm a');

      if (reportType !== 'by_company') {
        await generateCombinedReportPDF({
          companyInfo: {
            name: parentCompany?.name ?? 'Company',
            registrationNo: parentCompany?.registration_no ?? '',
            address: parentCompany?.address ?? '',
            phone: parentCompany?.phone ?? '',
            logoUrl: parentCompany?.logo_url ?? undefined,
          },
          period: periodLabel,
          generatedDate,
          summary: data.stats,
          employees: data.employees,
        });
      } else {
        const selectedCompany = reportCompanies.find((c) => c.id === selectedCompanyId);
        const companyGroups = groupByCompany(data.employees);

        await generateHRReportPDF({
          companyInfo: {
            name: selectedCompany?.name ?? 'Company',
            registrationNo: selectedCompany?.registration_no ?? '',
            address: selectedCompany?.address ?? '',
            phone: selectedCompany?.phone ?? '',
            logoUrl: selectedCompany?.logo_url ?? undefined,
          },
          period: periodLabel,
          generatedDate,
          summary: data.stats,
          companyGroups,
        });
      }

      toast({
        title: 'PDF generated',
        description: 'Your report has been downloaded.',
      });
    } catch (error) {
      console.error('PDF generation failed:', error);
      toast({
        title: 'Generation failed',
        description: 'Failed to generate the PDF report. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  }, [refetch, reportType, parentCompany, reportCompanies, selectedCompanyId, periodLabel]);

  const handleDownloadExcel = useCallback(async () => {
    setGenerating(true);
    try {
      const { data } = await refetch();
      if (!data || data.employees.length === 0) {
        toast({
          title: 'No data found',
          description: 'There are no approved OT records for the selected period.',
          variant: 'destructive',
        });
        return;
      }

      const generatedDate = format(new Date(), 'dd MMM yyyy, hh:mm a');

      if (reportType !== 'by_company') {
        const headers = [
          { key: 'company_name', label: 'Company' },
          { key: 'employee_no', label: 'Employee No.' },
          { key: 'employee_name', label: 'Name' },
          { key: 'department', label: 'Department' },
          { key: 'position', label: 'Position' },
          { key: 'total_ot_hours', label: 'Total OT Hours' },
          { key: 'amount', label: 'Amount (RM)' },
        ];

        const parentCode = parentCompany?.code ?? 'Combined';
        const filename = `OT_Report_${reportType}_${parentCode}_${shortPeriodLabel}`;

        await exportToXLSX(data.employees, filename, headers, {
          reportName: `OT Report (${getReportTypeLabel(reportType)}) - ${parentCompany?.name ?? 'All Companies'}`,
          period: periodLabel,
          generatedDate,
        });
      } else {
        const headers = [
          { key: 'employee_no', label: 'Employee No.' },
          { key: 'employee_name', label: 'Name' },
          { key: 'department', label: 'Department' },
          { key: 'position', label: 'Position' },
          { key: 'total_ot_hours', label: 'Total OT Hours' },
          { key: 'amount', label: 'Amount (RM)' },
        ];

        const selectedCompany = reportCompanies.find((c) => c.id === selectedCompanyId);
        const companyCode = selectedCompany?.code ?? 'Company';
        const filename = `OT_Report_${companyCode}_${shortPeriodLabel}`;

        await exportToXLSX(data.employees, filename, headers, {
          reportName: `OT Report - ${selectedCompany?.name ?? 'Company'}`,
          period: periodLabel,
          generatedDate,
        });
      }

      toast({
        title: 'Excel generated',
        description: 'Your report has been downloaded.',
      });
    } catch (error) {
      console.error('Excel generation failed:', error);
      toast({
        title: 'Generation failed',
        description: 'Failed to generate the Excel report. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  }, [refetch, reportType, parentCompany, reportCompanies, selectedCompanyId, periodLabel, shortPeriodLabel]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#5F26B4] hover:bg-[#4C1D95] text-white font-semibold">
          <Download className="h-4 w-4 mr-2" />
          Generate Report
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Generate OT Report</DialogTitle>
          <DialogDescription>
            Choose the report type, period, and download format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Report Type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Report Type</Label>
            <RadioGroup
              value={reportType}
              onValueChange={handleReportTypeChange}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all_companies" id="report-all-companies" />
                  <Label htmlFor="report-all-companies" className="font-normal cursor-pointer">
                    Total All Companies
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="by_company" id="report-by-company" />
                  <Label htmlFor="report-by-company" className="font-normal cursor-pointer">
                    Total By Company
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="by_year" id="report-by-year" />
                  <Label htmlFor="report-by-year" className="font-normal cursor-pointer">
                    Total By Year
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="by_month" id="report-by-month" />
                  <Label htmlFor="report-by-month" className="font-normal cursor-pointer">
                    Total By Month
                  </Label>
                </div>
            </RadioGroup>
          </div>

          {/* Company (only for individual) */}
          {reportType === 'by_company' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Company</Label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger className="border-[#E5E7EB] focus:border-[#5F26B4] focus:ring-[#5F26B4]">
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent className="bg-white text-gray-900 z-[200] border shadow-lg" position="popper" sideOffset={4}>
                  {reportCompanies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name} ({company.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {reportType === 'by_company' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Company Period Scope</Label>
              <RadioGroup
                value={companyPeriodMode}
                onValueChange={(value) => setCompanyPeriodMode(value as 'all' | 'year' | 'month')}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="company-period-all" />
                  <Label htmlFor="company-period-all" className="font-normal cursor-pointer">
                    All Period
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="year" id="company-period-year" />
                  <Label htmlFor="company-period-year" className="font-normal cursor-pointer">
                    By Year
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="month" id="company-period-month" />
                  <Label htmlFor="company-period-month" className="font-normal cursor-pointer">
                    By Month and Year
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Period */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Period</Label>
            <div className="flex gap-3">
              <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={periodMode === 'all' || periodMode === 'year'}>
                <SelectTrigger className="flex-1 border-[#E5E7EB] focus:border-[#5F26B4] focus:ring-[#5F26B4]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white text-gray-900 z-[200] border shadow-lg" position="popper" sideOffset={4}>
                  {MONTH_NAMES.map((name, index) => (
                    <SelectItem key={index + 1} value={String(index + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear} disabled={periodMode === 'all'}>
                <SelectTrigger className="w-[100px] border-[#E5E7EB] focus:border-[#5F26B4] focus:ring-[#5F26B4]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white text-gray-900 z-[200] border shadow-lg" position="popper" sideOffset={4}>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Format / Download buttons */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Format</Label>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                disabled={isDownloadDisabled}
                onClick={handleDownloadExcel}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {generating ? 'Generating...' : 'Download Excel'}
              </Button>
              <Button
                className="flex-1 bg-[#5F26B4] hover:bg-[#4C1D95] text-white font-semibold"
                disabled={isDownloadDisabled}
                onClick={handleDownloadPDF}
              >
                <Download className="h-4 w-4 mr-2" />
                {generating ? 'Generating...' : 'Download PDF'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getReportTypeLabel(reportType: 'all_companies' | 'by_company' | 'by_year' | 'by_month') {
  switch (reportType) {
    case 'all_companies':
      return 'Total All Companies';
    case 'by_company':
      return 'Total By Company';
    case 'by_year':
      return 'Total By Year';
    case 'by_month':
      return 'Total By Month';
  }
}
