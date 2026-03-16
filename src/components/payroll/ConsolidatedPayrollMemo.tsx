import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import { isFinanceRole } from '@/lib/financeRoles';
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
  isComputed?: boolean; // For computed subtotals (sum of other rows)
  countField?: string; // payroll_items field to count non-zero employees
  itemField?: string; // Field from payroll_items to aggregate (for zakat, cp38, etc.)
  allowanceCode?: string; // For allowance type breakdowns
  hidden?: boolean; // If true, do not render in memo
}

const SALARY_ROWS: SalaryRow[] = [
  { label: 'Employee Count', key: 'employee_count' },
  // 1. Gross Salary
  { label: 'Total Gross Salary', key: 'total_gross_salary', countField: 'gross_salary' },
  // 1a. Total OT
  { label: 'Total OT', key: 'item_ot_amount', itemField: 'ot_amount', countField: 'ot_amount' },
  // 1b. Total Claims
  { label: 'Total Claims', key: 'item_claims_amount', itemField: 'claims_amount', countField: 'claims_amount' },
  // 2. Director Fee
  { label: 'Director Fee', key: 'total_director_fee', countField: 'is_director' },
  // 3. Zakat
  { label: 'Zakat', key: 'item_zakat_amount', itemField: 'zakat_amount', countField: 'zakat_amount' },
  // 4. Monthly Tax Deduction (PCB)
  { label: 'Monthly Tax Deduction (PCB)', key: 'total_pcb', countField: 'pcb_amount' },
  // 5. CP38 (LHDN Tax)
  { label: 'CP38 (LHDN Tax)', key: 'item_cp38_amount', itemField: 'cp38_amount', countField: 'cp38_amount' },
  // 6. Sports Club Deduction
  { label: 'Sports Club Deduction', key: 'item_sports_club', itemField: 'sports_club', countField: 'sports_club' },
  // 7. Staff Loan / Rental Deduction (combined)
  { label: 'Staff Loan / Rental Deduction', key: 'item_staff_loan_rental', itemField: 'staff_loan_rental', countField: 'staff_loan_rental' },
  // 8. Net Salary
  { label: 'Net Salary', key: 'total_net_salary', isSubtotal: true },
  // 9. Net Director Fee
  { label: 'Net Director Fee', key: 'item_net_director_fee', itemField: 'net_director_fee', countField: 'net_director_fee' },
  // 10. Employee contributions
  { label: 'Employee EPF', key: 'total_employee_epf', countField: 'employee_epf' },
  { label: 'Employee SOCSO', key: 'total_employee_socso', countField: 'employee_socso' },
  { label: 'Employee EIS', key: 'total_employee_eis', countField: 'employee_eis' },
  { label: 'HRDC', key: 'total_hrdc', countField: 'employer_hrdc' },
  // 11. Employer contributions
  { label: 'Employer EPF', key: 'total_employer_epf', countField: 'employer_epf' },
  { label: 'Employer SOCSO', key: 'total_employer_socso', countField: 'employer_socso' },
  { label: 'Employer EIS', key: 'total_employer_eis', countField: 'employer_eis' },
  // B) Total Employer Contribution
  { label: 'Total Employer Contribution', key: 'computed_total_employer_contribution', isSubtotal: true, isComputed: true },
  // 12. Total Allowances
  { label: 'Total Allowances', key: 'total_allowances', countField: 'total_allowances' },
  // 13. Phone Allowance (breakdown)
  { label: 'Phone Allowance', key: 'allowance_phone', allowanceCode: 'phone', countField: 'allowance_phone' },
  // 14. Hardship Allowance — hidden from memo
  { label: 'Hardship Allowance', key: 'allowance_hardship', allowanceCode: 'hardship', countField: 'allowance_hardship', hidden: true },
  // 15. Other Deduction
  { label: 'Other Deduction', key: 'item_other_deductions', itemField: 'other_deductions', countField: 'other_deductions' },
  // A) Total Duit Keluar (Grand Total)
  { label: 'Grand Total', key: 'computed_total_duit_keluar', isSubtotal: true, isComputed: true },
];

// Count fields we need from payroll_items (includes new item-level fields)
const COUNT_FIELDS = [
  'gross_salary', 'total_allowances', 'employee_epf', 'employer_epf',
  'employee_socso', 'employer_socso', 'employee_eis', 'employer_eis',
  'employer_hrdc', 'pcb_amount', 'is_director', 'total_deductions',
  'zakat_amount', 'cp38_amount', 'sports_club', 'staff_loan', 'rental_deduction',
  'other_deductions', 'net_director_fee', 'ot_amount', 'claims_amount',
] as const;

// Item-level fields to SUM (not on payroll_runs)
const ITEM_SUM_FIELDS = [
  'zakat_amount', 'cp38_amount', 'sports_club', 'staff_loan', 'rental_deduction',
  'other_deductions', 'net_director_fee', 'ot_amount', 'claims_amount',
] as const;

type ComponentCounts = Record<string, Record<string, number>>; // runId -> field -> count
type ItemSums = Record<string, Record<string, number>>; // runId -> field -> sum
type AllowanceSums = Record<string, Record<string, { sum: number; count: number }>>; // runId -> allowanceCode -> { sum, count }

function useComponentCounts(runIds: string[]) {
  const db = supabase as any;
  return useQuery({
    queryKey: ['payroll-component-counts', ...runIds],
    queryFn: async () => {
      if (runIds.length === 0) return { counts: {} as ComponentCounts, itemSums: {} as ItemSums };

      const { data, error } = await db
        .from('payroll_items')
        .select(`payroll_run_id, ${COUNT_FIELDS.join(', ')}`)
        .in('payroll_run_id', runIds);

      if (error) throw error;

      const counts: ComponentCounts = {};
      const itemSums: ItemSums = {};
      for (const id of runIds) {
        counts[id] = {};
        itemSums[id] = {};
      }

      for (const item of (data || []) as Record<string, unknown>[]) {
        const runId = item.payroll_run_id as string;
        if (!counts[runId]) counts[runId] = {};
        if (!itemSums[runId]) itemSums[runId] = {};

        for (const field of COUNT_FIELDS) {
          const val = Number(item[field] || 0);
          if (field === 'is_director') {
            if (item[field]) counts[runId][field] = (counts[runId][field] || 0) + 1;
          } else if (val > 0) {
            counts[runId][field] = (counts[runId][field] || 0) + 1;
          }
        }

        // Combined staff_loan + rental_deduction count
        const staffLoan = Number(item.staff_loan || 0);
        const rental = Number(item.rental_deduction || 0);
        if (staffLoan > 0 || rental > 0) {
          counts[runId]['staff_loan_rental'] = (counts[runId]['staff_loan_rental'] || 0) + 1;
        }

        // Sum item-level fields
        for (const field of ITEM_SUM_FIELDS) {
          const val = Number(item[field] || 0);
          itemSums[runId][field] = (itemSums[runId][field] || 0) + val;
        }
        // Combined staff_loan + rental_deduction sum
        itemSums[runId]['staff_loan_rental'] =
          (itemSums[runId]['staff_loan_rental'] || 0) + staffLoan + rental;
      }

      return { counts, itemSums };
    },
    enabled: runIds.length > 0,
    staleTime: 20 * 1000,
  });
}

function useAllowanceBreakdowns(runIds: string[]) {
  const db = supabase as any;
  return useQuery({
    queryKey: ['payroll-allowance-breakdowns', ...runIds],
    queryFn: async () => {
      if (runIds.length === 0) return {} as AllowanceSums;

      // Get payroll_item_ids for these runs
      const { data: items, error: itemsErr } = await db
        .from('payroll_items')
        .select('id, payroll_run_id')
        .in('payroll_run_id', runIds);

      if (itemsErr) throw itemsErr;
      if (!items || items.length === 0) return {} as AllowanceSums;

      const itemIds = items.map((i: any) => i.id);
      const itemRunMap: Record<string, string> = {};
      for (const i of items as any[]) itemRunMap[i.id] = i.payroll_run_id;

      // Fetch allowance breakdowns with type codes
      const { data: allowances, error: allowErr } = await db
        .from('payroll_item_allowances')
        .select('payroll_item_id, amount, allowance_type_id, allowance_types!inner(code)')
        .in('payroll_item_id', itemIds);

      if (allowErr) throw allowErr;

      const result: AllowanceSums = {};
      for (const id of runIds) result[id] = {};

      for (const a of (allowances || []) as any[]) {
        const runId = itemRunMap[a.payroll_item_id];
        if (!runId) continue;
        const code = a.allowance_types?.code;
        if (!code) continue;
        const amount = Number(a.amount || 0);
        if (!result[runId][code]) result[runId][code] = { sum: 0, count: 0 };
        result[runId][code].sum += amount;
        if (amount > 0) result[runId][code].count += 1;
      }

      return result;
    },
    enabled: runIds.length > 0,
    staleTime: 20 * 1000,
  });
}

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
  if (activeRole === 'dmd') return 'dmd';
  if (activeRole === 'management' || activeRole === 'director' || activeRole === 'gm' || activeRole === 'sgm')
    return 'management';
  if (isFinanceRole(activeRole) || activeRole === 'head_finance') return 'finance';
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

  const runIds = useMemo(() => runs.map((r) => r.id), [runs]);
  const { data: countData } = useComponentCounts(runIds);
  const componentCounts = countData?.counts ?? {};
  const itemSums: Record<string, Record<string, number>> = countData?.itemSums ?? {};
  const allowanceSums: AllowanceSums = useAllowanceBreakdowns(runIds).data ?? {};

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

  function getRunValue(row: SalaryRow, run: any): number {
    if (row.isComputed) {
      return getComputedValue(row.key, run);
    }
    if (row.itemField) {
      return itemSums[run.id]?.[row.itemField] || 0;
    }
    if (row.allowanceCode) {
      return allowanceSums[run.id]?.[row.allowanceCode]?.sum || 0;
    }
    return Number(run[row.key] || 0);
  }

  function getComputedValue(key: string, run: any): number {
    if (key === 'computed_total_employer_contribution') {
      return (
        Number(run.total_employer_epf || 0) +
        Number(run.total_employer_socso || 0) +
        Number(run.total_employer_eis || 0) +
        Number(run.total_hrdc || 0)
      );
    }
    if (key === 'computed_total_duit_keluar') {
      const grossSalary = Number(run.total_gross_salary || 0);
      const employerContrib =
        Number(run.total_employer_epf || 0) +
        Number(run.total_employer_socso || 0) +
        Number(run.total_employer_eis || 0) +
        Number(run.total_hrdc || 0);
      const totalAllowances = Number(run.total_allowances || 0);
      return grossSalary + employerContrib + totalAllowances;
    }
    return 0;
  }

  function getGrandTotal(row: SalaryRow): number {
    return runs.reduce((sum, r) => sum + getRunValue(row, r), 0);
  }

  function formatValue(key: string, value: number): string {
    if (key === 'employee_count') return String(value);
    return formatCurrency(value);
  }

  function getComponentCount(runId: string, countField?: string): number {
    if (!countField) return 0;
    // Check allowance counts first
    if (countField.startsWith('allowance_')) {
      const code = countField.replace('allowance_', '');
      return allowanceSums[runId]?.[code]?.count || 0;
    }
    return componentCounts[runId]?.[countField] || 0;
  }

  function getGrandCount(countField?: string): number {
    if (!countField) return 0;
    return runs.reduce((sum, r) => sum + getComponentCount(r.id, countField), 0);
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
                      colSpan={2}
                    >
                      {c.name}
                    </TableHead>
                  ))}
                  <TableHead className="text-right min-w-[120px] font-bold" colSpan={2}>
                    Grand Total
                  </TableHead>
                </TableRow>
                <TableRow>
                  <TableHead />
                  {companyColumns.map((c) => (
                    <React.Fragment key={`${c.id}-sub`}>
                      <TableHead className="text-right text-xs">Amount</TableHead>
                      <TableHead className="text-center text-xs w-[50px]">#</TableHead>
                    </React.Fragment>
                  ))}
                  <TableHead className="text-right text-xs">Amount</TableHead>
                  <TableHead className="text-center text-xs w-[50px]">#</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SALARY_ROWS.filter((row) => !row.hidden).map((row) => (
                  <TableRow
                    key={row.key}
                    className={
                      row.isSubtotal ? 'font-semibold bg-muted/50' : ''
                    }
                  >
                    <TableCell>{row.label}</TableCell>
                    {companyColumns.map((c) => (
                      <React.Fragment key={`${c.id}-${row.key}`}>
                        <TableCell className="text-right">
                          {formatValue(
                            row.key,
                            getRunValue(row, c.run)
                          )}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground text-xs">
                          {row.key === 'employee_count' ? '' : row.countField ? getComponentCount(c.run.id, row.countField) || '-' : ''}
                        </TableCell>
                      </React.Fragment>
                    ))}
                    <TableCell className="text-right font-bold">
                      {formatValue(row.key, getGrandTotal(row))}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground text-xs font-bold">
                      {row.key === 'employee_count' ? '' : row.countField ? getGrandCount(row.countField) || '-' : ''}
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
