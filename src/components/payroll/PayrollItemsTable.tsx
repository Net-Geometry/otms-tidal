import { useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil, RotateCcw, Search } from 'lucide-react';
import type { PayrollItem } from '@/types/payroll';

interface PayrollItemsTableProps {
  items: PayrollItem[];
  isLoading: boolean;
  onEdit?: (item: PayrollItem) => void;
  onRecalculate?: (employeeId: string) => void;
  isRecalculating?: boolean;
  readOnly?: boolean;
  search?: string;
  onSearchChange?: (value: string) => void;
}

export function PayrollItemsTable({
  items,
  isLoading,
  onEdit,
  onRecalculate,
  isRecalculating,
  readOnly,
  search,
  onSearchChange,
}: PayrollItemsTableProps) {
  const filtered = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.profiles?.full_name?.toLowerCase().includes(q) ||
        item.profiles?.employee_id?.toLowerCase().includes(q)
    );
  }, [items, search]);

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
    <div className="space-y-3">
      {onSearchChange && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            value={search || ''}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead className="w-[40px]" />
              <TableHead>Department</TableHead>
              <TableHead className="text-right">Basic</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">EPF (EE)</TableHead>
              <TableHead className="text-right">EPF (ER)</TableHead>
              <TableHead className="text-right">SOCSO (EE)</TableHead>
              <TableHead className="text-right">SOCSO (ER)</TableHead>
              <TableHead className="text-right">EIS (EE)</TableHead>
              <TableHead className="text-right">EIS (ER)</TableHead>
              <TableHead className="text-right">PCB</TableHead>
              <TableHead className="text-right">Deductions</TableHead>
              <TableHead className="text-right">Allowances</TableHead>
              <TableHead className="text-right">Net</TableHead>
              {!readOnly && <TableHead className="w-[80px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((item) => {
              const isManuallyEdited = !!(item.calculation_notes as Record<string, unknown>)?.manually_edited;
              return (
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
                  <TableCell>
                    {isManuallyEdited ? (
                      <span className="text-blue-500" title="Manually edited">
                        &#9998;
                      </span>
                    ) : (
                      <span className="text-green-500" title="Auto-calculated">
                        &#9679;
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{item.profiles?.departments?.name || '-'}</TableCell>
                  <TableCell className="text-right">{fmt(item.basic_salary)}</TableCell>
                  <TableCell className="text-right">{fmt(item.gross_salary)}</TableCell>
                  <TableCell className="text-right">{fmt(item.employee_epf)}</TableCell>
                  <TableCell className="text-right">{fmt(item.employer_epf)}</TableCell>
                  <TableCell className="text-right">{fmt(item.employee_socso)}</TableCell>
                  <TableCell className="text-right">{fmt(item.employer_socso)}</TableCell>
                  <TableCell className="text-right">{fmt(item.employee_eis)}</TableCell>
                  <TableCell className="text-right">{fmt(item.employer_eis)}</TableCell>
                  <TableCell className="text-right">{fmt(item.pcb_amount)}</TableCell>
                  <TableCell className="text-right">{fmt(item.total_deductions)}</TableCell>
                  <TableCell className="text-right">{fmt(item.total_allowances)}</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(item.net_salary)}</TableCell>
                  {!readOnly && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit?.(item)}
                          disabled={item.is_locked}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {onRecalculate && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onRecalculate(item.employee_id)}
                            disabled={item.is_locked || isRecalculating}
                            title="Recalculate"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function fmt(n: number | undefined): string {
  return Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
