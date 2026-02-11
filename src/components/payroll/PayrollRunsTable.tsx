import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye } from 'lucide-react';
import type { PayrollRun, PayrollRunStatus } from '@/types/payroll';
import { PAYROLL_STATUS_LABELS } from '@/types/payroll';
import { formatCurrency } from '@/lib/otCalculations';

const MONTHS = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function statusVariant(status: PayrollRunStatus) {
  if (status === 'finance_approved' || status === 'posted') return 'default';
  if (status === 'rejected') return 'destructive';
  if (status === 'cancelled') return 'secondary';
  if (status === 'hr_approved' || status === 'director_approved') return 'default';
  return 'outline';
}

interface PayrollRunsTableProps {
  runs: PayrollRun[];
  isLoading: boolean;
  basePath?: string;
}

export function PayrollRunsTable({ runs, isLoading, basePath = '/hr/payroll' }: PayrollRunsTableProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!runs.length) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No payroll runs found.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Run #</TableHead>
          <TableHead>Company</TableHead>
          <TableHead>Period</TableHead>
          <TableHead className="text-right">Employees</TableHead>
          <TableHead className="text-right">Gross</TableHead>
          <TableHead className="text-right">Net</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-[60px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => (
          <TableRow key={run.id} className="cursor-pointer" onClick={() => navigate(`${basePath}/${run.id}`)}>
            <TableCell className="font-medium">{run.run_number}</TableCell>
            <TableCell>{run.companies?.name || '-'}</TableCell>
            <TableCell>
              {MONTHS[run.pay_period_month]} {run.pay_period_year}
            </TableCell>
            <TableCell className="text-right">{run.employee_count}</TableCell>
            <TableCell className="text-right">
              {formatCurrency(Number(run.total_gross_salary))}
            </TableCell>
            <TableCell className="text-right">
              {formatCurrency(Number(run.total_net_salary))}
            </TableCell>
            <TableCell>
              <Badge variant={statusVariant(run.status) as any}>
                {PAYROLL_STATUS_LABELS[run.status] || run.status}
              </Badge>
            </TableCell>
            <TableCell>
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); navigate(`${basePath}/${run.id}`); }}>
                <Eye className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
