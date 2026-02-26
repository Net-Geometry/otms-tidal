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
import { exportToCSV } from '@/lib/exportUtils';
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
  const [reportType, setReportType] = useState<'combined' | 'individual'>('combined');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [generating, setGenerating] = useState(false);

  const { data: companiesGrouped } = useCompaniesGrouped();

  const monthDate = new Date(Number(selectedYear), Number(selectedMonth) - 1, 1);

  const { refetch } = useReportData({
    month: monthDate,
    reportType,
    companyId: reportType === 'individual' ? selectedCompanyId : undefined,
    enabled: false,
  });

  const parentCompany = companiesGrouped?.parent;
  const subsidiaries = companiesGrouped?.subsidiaries ?? [];

  const periodLabel = `${MONTH_NAMES[Number(selectedMonth) - 1]} ${selectedYear}`;
  const shortPeriodLabel = `${SHORT_MONTH_NAMES[Number(selectedMonth) - 1]}_${selectedYear}`;

  const isDownloadDisabled = generating || (reportType === 'individual' && !selectedCompanyId);

  // Build year options (current year +/- 2)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentYear - 2 + i));

  const handleReportTypeChange = useCallback((value: string) => {
    setReportType(value as 'combined' | 'individual');
    setSelectedCompanyId('');
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

      if (reportType === 'combined') {
        await generateCombinedReportPDF({
          companyInfo: {
            name: parentCompany?.name ?? 'Company',
            registrationNo: parentCompany?.registration_no ?? '',
            address: parentCompany?.address ?? '',
            phone: parentCompany?.phone ?? '',
          },
          period: periodLabel,
          generatedDate,
          summary: data.stats,
          employees: data.employees,
        });
      } else {
        const selectedCompany = subsidiaries.find((c) => c.id === selectedCompanyId);
        const companyGroups = groupByCompany(data.employees);

        await generateHRReportPDF({
          companyInfo: {
            name: selectedCompany?.name ?? 'Company',
            registrationNo: selectedCompany?.registration_no ?? '',
            address: selectedCompany?.address ?? '',
            phone: selectedCompany?.phone ?? '',
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
  }, [refetch, reportType, parentCompany, subsidiaries, selectedCompanyId, periodLabel]);

  const handleDownloadCSV = useCallback(async () => {
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

      if (reportType === 'combined') {
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
        const filename = `OT_Report_Combined_${parentCode}_${shortPeriodLabel}`;

        exportToCSV(data.employees, filename, headers, {
          reportName: `OT Report (Combined) - ${parentCompany?.name ?? 'All Companies'}`,
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

        const selectedCompany = subsidiaries.find((c) => c.id === selectedCompanyId);
        const companyCode = selectedCompany?.code ?? 'Company';
        const filename = `OT_Report_${companyCode}_${shortPeriodLabel}`;

        exportToCSV(data.employees, filename, headers, {
          reportName: `OT Report - ${selectedCompany?.name ?? 'Company'}`,
          period: periodLabel,
          generatedDate,
        });
      }

      toast({
        title: 'CSV generated',
        description: 'Your report has been downloaded.',
      });
    } catch (error) {
      console.error('CSV generation failed:', error);
      toast({
        title: 'Generation failed',
        description: 'Failed to generate the CSV report. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  }, [refetch, reportType, parentCompany, subsidiaries, selectedCompanyId, periodLabel, shortPeriodLabel]);

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
                <RadioGroupItem value="combined" id="report-combined" />
                <Label htmlFor="report-combined" className="font-normal cursor-pointer">
                  Combined{parentCompany ? ` (${parentCompany.name})` : ''}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="individual" id="report-individual" />
                <Label htmlFor="report-individual" className="font-normal cursor-pointer">
                  Individual
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Company (only for individual) */}
          {reportType === 'individual' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Company</Label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger className="border-[#E5E7EB] focus:border-[#5F26B4] focus:ring-[#5F26B4]">
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent className="bg-white z-50 border shadow-lg">
                  {subsidiaries.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name} ({company.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Period */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Period</Label>
            <div className="flex gap-3">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="flex-1 border-[#E5E7EB] focus:border-[#5F26B4] focus:ring-[#5F26B4]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white z-50 border shadow-lg">
                  {MONTH_NAMES.map((name, index) => (
                    <SelectItem key={index + 1} value={String(index + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[100px] border-[#E5E7EB] focus:border-[#5F26B4] focus:ring-[#5F26B4]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white z-50 border shadow-lg">
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
                onClick={handleDownloadCSV}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {generating ? 'Generating...' : 'Download CSV'}
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
