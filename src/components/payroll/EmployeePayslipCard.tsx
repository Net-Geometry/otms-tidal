import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { PayrollItem } from '@/types/payroll';
import { formatCurrency } from '@/lib/otCalculations';

const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface EmployeePayslipCardProps {
  item: PayrollItem & { payroll_run?: { pay_period_month: number; pay_period_year: number; companies?: { name: string } } };
  onDownload: (item: PayrollItem) => void;
}

export function EmployeePayslipCard({ item, onDownload }: EmployeePayslipCardProps) {
  const month = item.payroll_run?.pay_period_month || 0;
  const year = item.payroll_run?.pay_period_year || 0;
  const company = item.payroll_run?.companies?.name || '';

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-sm">
              {MONTHS[month]} {year}
            </h4>
            {company && <p className="text-xs text-muted-foreground">{company}</p>}
          </div>
          <Button variant="outline" size="sm" onClick={() => onDownload(item)}>
            <Download className="h-4 w-4 mr-1" />
            PDF
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
          <div>
            <span className="text-muted-foreground">Gross:</span>{' '}
            <span className="font-medium">{formatCurrency(Number(item.gross_salary))}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Net:</span>{' '}
            <span className="font-medium">{formatCurrency(Number(item.net_salary))}</span>
          </div>
          <div>
            <span className="text-muted-foreground">EPF (EE):</span>{' '}
            <span>{formatCurrency(Number(item.employee_epf))}</span>
          </div>
          <div>
            <span className="text-muted-foreground">SOCSO (EE):</span>{' '}
            <span>{formatCurrency(Number(item.employee_socso))}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
