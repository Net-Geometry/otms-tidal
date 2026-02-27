import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FilePlus, Info } from 'lucide-react';
import { useConsolidatedPayrollRuns } from '@/hooks/payroll/useConsolidatedPayrollRuns';
import { usePayrollMemo } from '@/hooks/payroll/usePayrollMemo';
import { useActiveRole } from '@/hooks/useActiveRole';
import { MemoApprovalActions } from './MemoApprovalActions';
import { MemoApprovalTrail } from './MemoApprovalTrail';
import { formatCurrency } from '@/lib/otCalculations';
import { MEMO_STATUS_LABELS } from '@/types/payroll';
import type { PayrollApprovalRole, PayrollMemoStatus } from '@/types/payroll';

const MONTHS = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
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

function getStatusBadgeVariant(
  status: PayrollMemoStatus
): 'default' | 'destructive' | 'secondary' {
  if (status === 'posted' || status === 'finance_approved') return 'default';
  if (status === 'rejected') return 'destructive';
  return 'secondary';
}

function deriveApprovalRole(
  activeRole: string | null
): PayrollApprovalRole {
  if (activeRole === 'management' || activeRole === 'director' || activeRole === 'gm')
    return 'management';
  if (activeRole === 'finance' || activeRole === 'head_finance') return 'finance';
  return 'hr';
}

export function ConsolidatedPayrollMemo() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: runs = [], isLoading: runsLoading } =
    useConsolidatedPayrollRuns(month, year);

  const {
    memo,
    isLoading: memoLoading,
    createMemo,
    isCreating,
    deleteMemo,
    isDeleting,
    approveMemo,
    isApproving,
    rejectMemo,
    isRejecting,
    resubmitMemo,
    isResubmitting,
    postMemo,
    isPosting,
  } = usePayrollMemo(month, year);

  const { activeRole } = useActiveRole();
  const approvalRole = deriveApprovalRole(activeRole);

  const isLoading = runsLoading || memoLoading;

  // Determine readiness: all runs must have employee_count > 0
  const allRunsReady =
    runs.length > 0 && runs.every((r) => (r.employee_count ?? 0) > 0);
  const someRunsEmpty =
    runs.length > 0 && runs.some((r) => !r.employee_count || r.employee_count === 0);

  const canCreateMemo = !memo && allRunsReady && approvalRole === 'hr';
  const showReadinessWarning = !memo && someRunsEmpty && runs.length > 0;
  const showRejectionAlert = memo?.status === 'rejected';

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
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              Consolidated Payroll Memo
              {memo && (
                <Badge variant={getStatusBadgeVariant(memo.status)}>
                  {MEMO_STATUS_LABELS[memo.status]}
                </Badge>
              )}
            </CardTitle>
            {memo && (
              <p className="text-sm text-muted-foreground mt-1">
                {memo.memo_number}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="memo-month">Month</Label>
              <Select
                value={String(month)}
                onValueChange={(v) => setMonth(Number(v))}
              >
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
              <Select
                value={String(year)}
                onValueChange={(v) => setYear(Number(v))}
              >
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
        </div>

        <div className="flex items-center gap-2 mt-3">
          {canCreateMemo && (
            <Button onClick={() => createMemo()} disabled={isCreating}>
              <FilePlus className="h-4 w-4 mr-2" />
              {isCreating ? 'Creating...' : 'Create Memo'}
            </Button>
          )}
          {memo && (
            <MemoApprovalActions
              memo={memo}
              role={approvalRole}
              onApprove={approveMemo}
              onReject={rejectMemo}
              onResubmit={resubmitMemo}
              onPost={postMemo}
              onDelete={deleteMemo}
              isApproving={isApproving}
              isRejecting={isRejecting}
              isResubmitting={isResubmitting}
              isPosting={isPosting}
              isDeleting={isDeleting}
            />
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {showReadinessWarning && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Some payroll runs have no employees calculated yet. All runs must
              have employees before a memo can be created.
            </AlertDescription>
          </Alert>
        )}

        {showRejectionAlert && memo && (
          <Alert variant="destructive">
            <AlertDescription>
              <span className="font-semibold">Memo rejected</span>
              {memo.rejection_stage && (
                <> at the <strong>{memo.rejection_stage}</strong> stage</>
              )}
              {memo.rejection_remarks && <>: {memo.rejection_remarks}</>}
            </AlertDescription>
          </Alert>
        )}

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
                    <TableHead
                      key={c.id}
                      className="text-right min-w-[120px]"
                    >
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
                    className={
                      row.isSubtotal ? 'font-semibold bg-muted/50' : ''
                    }
                  >
                    <TableCell>{row.label}</TableCell>
                    {companyColumns.map((c) => (
                      <TableCell key={c.id} className="text-right">
                        {formatValue(
                          row.key,
                          Number((c.run as any)[row.key] || 0)
                        )}
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

        {memo && <MemoApprovalTrail memo={memo} />}
      </CardContent>
    </Card>
  );
}
