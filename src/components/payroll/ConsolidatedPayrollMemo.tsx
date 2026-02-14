import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useConsolidatedPayrollRuns } from '@/hooks/payroll/useConsolidatedPayrollRuns';
import { formatCurrency } from '@/lib/otCalculations';

const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 3 }, (_, i) => CURRENT_YEAR - 1 + i);

interface SalaryRow {
  label: string;
  key: string;
  isSubtotal?: boolean;
}

const SALARY_ROWS: SalaryRow[] = [
  { label: 'Employee Count', key: 'employee_count' },
  { label: 'Gross Salary', key: 'total_gross_salary' },
  { label: 'Total Allowances', key: 'total_allowances' },
  { label: 'Employee EPF', key: 'total_employee_epf' },
  { label: 'Employer EPF', key: 'total_employer_epf' },
  { label: 'Employee SOCSO', key: 'total_employee_socso' },
  { label: 'Employer SOCSO', key: 'total_employer_socso' },
  { label: 'Employee EIS', key: 'total_employee_eis' },
  { label: 'Employer EIS', key: 'total_employer_eis' },
  { label: 'HRDC', key: 'total_hrdc' },
  { label: 'PCB', key: 'total_pcb' },
  { label: 'Director Fees', key: 'total_director_fee' },
  { label: 'Total Deductions', key: 'total_deductions', isSubtotal: true },
  { label: 'Net Salary', key: 'total_net_salary', isSubtotal: true },
];

export function ConsolidatedPayrollMemo() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: runs = [], isLoading } = useConsolidatedPayrollRuns(month, year);

  const companyColumns = runs.map((r) => ({
    id: r.company_id,
    name: r.companies?.code || r.companies?.name || 'Unknown',
    run: r,
  }));

  function getGrandTotal(key: string): number {
    return runs.reduce((sum, r) => sum + Number((r as any)[key] || 0), 0);
  }

  function formatValue(key: string, value: number): string {
    if (key === 'employee_count') return String(value);
    return formatCurrency(value);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Consolidated Payroll Memo</CardTitle>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="memo-month">Month</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger id="memo-month" className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.slice(1).map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="memo-year">Year</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger id="memo-year" className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : runs.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No payroll runs found for {MONTHS[month]} {year}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px]">Component</TableHead>
                  {companyColumns.map((c) => (
                    <TableHead key={c.id} className="text-right min-w-[120px]">
                      {c.name}
                    </TableHead>
                  ))}
                  <TableHead className="text-right min-w-[120px] font-bold">
                    Grand Total
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SALARY_ROWS.map((row) => (
                  <TableRow
                    key={row.key}
                    className={row.isSubtotal ? 'font-semibold bg-muted/50' : ''}
                  >
                    <TableCell>{row.label}</TableCell>
                    {companyColumns.map((c) => (
                      <TableCell key={c.id} className="text-right">
                        {formatValue(row.key, Number((c.run as any)[row.key] || 0))}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-bold">
                      {formatValue(row.key, getGrandTotal(row.key))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
