import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil } from 'lucide-react';
import type { PayrollItem } from '@/types/payroll';

interface PayrollItemsTableProps {
  items: PayrollItem[];
  isLoading: boolean;
  onEdit?: (item: PayrollItem) => void;
  readOnly?: boolean;
}

export function PayrollItemsTable({ items, isLoading, onEdit, readOnly }: PayrollItemsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No payroll items. Click "Calculate" to generate payroll for all employees.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Department</TableHead>
            <TableHead className="text-right">Basic</TableHead>
            <TableHead className="text-right">Gross</TableHead>
            <TableHead className="text-right">EPF (EE)</TableHead>
            <TableHead className="text-right">SOCSO (EE)</TableHead>
            <TableHead className="text-right">EIS (EE)</TableHead>
            <TableHead className="text-right">PCB</TableHead>
            <TableHead className="text-right">Deductions</TableHead>
            <TableHead className="text-right">Allowances</TableHead>
            <TableHead className="text-right">Net</TableHead>
            {!readOnly && <TableHead className="w-[50px]" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">
                {item.profiles?.full_name || item.employee_id}
                {item.is_pro_rated && (
                  <span className="ml-1 text-xs text-orange-500">(Pro-rated)</span>
                )}
                {item.is_director && (
                  <span className="ml-1 text-xs text-blue-500">(Director)</span>
                )}
              </TableCell>
              <TableCell>{item.profiles?.departments?.name || '-'}</TableCell>
              <TableCell className="text-right">{fmt(item.basic_salary)}</TableCell>
              <TableCell className="text-right">{fmt(item.gross_salary)}</TableCell>
              <TableCell className="text-right">{fmt(item.employee_epf)}</TableCell>
              <TableCell className="text-right">{fmt(item.employee_socso)}</TableCell>
              <TableCell className="text-right">{fmt(item.employee_eis)}</TableCell>
              <TableCell className="text-right">{fmt(item.pcb_amount)}</TableCell>
              <TableCell className="text-right">{fmt(item.total_deductions)}</TableCell>
              <TableCell className="text-right">{fmt(item.total_allowances)}</TableCell>
              <TableCell className="text-right font-semibold">{fmt(item.net_salary)}</TableCell>
              {!readOnly && (
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit?.(item)}
                    disabled={item.is_locked}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function fmt(n: number | undefined): string {
  return Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
