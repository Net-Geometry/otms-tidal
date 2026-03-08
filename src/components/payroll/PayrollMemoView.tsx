import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { PayrollRun } from '@/types/payroll';
import { PAYROLL_STATUS_LABELS } from '@/types/payroll';
import { formatCurrency } from '@/lib/otCalculations';

const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface PayrollMemoViewProps {
  run: PayrollRun;
}

export function PayrollMemoView({ run }: PayrollMemoViewProps) {
  const period = `${MONTHS[run.pay_period_month]} ${run.pay_period_year}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Payroll Memo — {run.run_number}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {run.companies?.name || 'Unknown Company'} | {period}
            </p>
          </div>
          <Badge variant="outline">
            {PAYROLL_STATUS_LABELS[run.status] || run.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <InfoItem label="Employees" value={String(run.employee_count)} />
          <InfoItem label="Total Gross" value={formatCurrency(Number(run.total_gross_salary))} />
          <InfoItem label="Total Net" value={formatCurrency(Number(run.total_net_salary))} />
          <InfoItem label="Total Allowances" value={formatCurrency(Number(run.total_allowances))} />
        </div>

        <Separator />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <InfoItem label="Employer EPF" value={formatCurrency(Number(run.total_employer_epf))} />
          <InfoItem label="Employee EPF" value={formatCurrency(Number(run.total_employee_epf))} />
          <InfoItem label="Employer SOCSO" value={formatCurrency(Number(run.total_employer_socso))} />
          <InfoItem label="Employee SOCSO" value={formatCurrency(Number(run.total_employee_socso))} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <InfoItem label="Employer EIS" value={formatCurrency(Number(run.total_employer_eis))} />
          <InfoItem label="Employee EIS" value={formatCurrency(Number(run.total_employee_eis))} />
          <InfoItem label="HRDC" value={formatCurrency(Number(run.total_hrdc))} />
          <InfoItem label="PCB" value={formatCurrency(Number(run.total_pcb))} />
        </div>

        {Number(run.total_director_fee) > 0 && (
          <>
            <Separator />
            <div className="text-sm">
              <InfoItem label="Director Fees" value={formatCurrency(Number(run.total_director_fee))} />
            </div>
          </>
        )}

        {run.memo_id && (
          <>
            <Separator />
            <div className="text-sm">
              <p className="text-muted-foreground">Part of consolidated memo. Approval managed via memo.</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
