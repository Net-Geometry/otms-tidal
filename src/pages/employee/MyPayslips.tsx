import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmployeePayslipCard } from '@/components/payroll/EmployeePayslipCard';
import { useEmployeePayslips } from '@/hooks/payroll/useEmployeePayslips';
import { generateFullPayslipPDF } from '@/lib/payslipPdfGenerator';
import type { PayrollItem } from '@/types/payroll';

export default function MyPayslips() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const years = Array.from({ length: 3 }, (_, i) => currentYear - 2 + i);

  const { data: payslips, isLoading } = useEmployeePayslips({ year: Number(year) });

  const handleDownload = async (item: PayrollItem & { payroll_run?: any }) => {
    const run = item.payroll_run;
    const profile = item.profiles;
    if (!run || !profile) return;

    await generateFullPayslipPDF({
      company: {
        name: run.companies?.name || 'Company',
      },
      employee: {
        name: profile.full_name || '',
        employeeNo: profile.employee_id || '',
        department: profile.departments?.name || '',
        epfNo: profile.epf_no || '',
        socsoNo: profile.socso_no || '',
        incomeTaxNo: profile.income_tax_no || '',
        bankName: profile.bank_name || '',
        bankAccountNo: profile.bank_account_no || '',
      },
      period: `${run.pay_period_month}/${run.pay_period_year}`,
      item,
    });
  };

  return (
    <AppLayout>
      <PageLayout title="My Payslips" description="View and download your monthly payslips.">
        <div className="flex justify-end mb-4">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : !payslips?.length ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No payslips found for {year}.
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {payslips.map((item) => (
              <EmployeePayslipCard
                key={item.id}
                item={item as any}
                onDownload={() => handleDownload(item as any)}
              />
            ))}
          </div>
        )}
      </PageLayout>
    </AppLayout>
  );
}
