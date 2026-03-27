import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Calculator, Download, FileText, Info, UserPlus,
  CheckCircle, XCircle, HelpCircle, Send, ChevronDown,
} from 'lucide-react';
import { exportToCSV, downloadTxtFile } from '@/lib/exportUtils';
import { generateSocsoEisTxt, generateEpfTxt } from '@/lib/statutoryTxtGenerator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PayrollMemoView } from '@/components/payroll/PayrollMemoView';
import { PayrollItemsTable } from '@/components/payroll/PayrollItemsTable';
import { EmployeePayrollForm } from '@/components/payroll/EmployeePayrollForm';
import { AddEmployeeDialog } from '@/components/payroll/AddEmployeeDialog';
import { GeneratePayslipsDialog } from '@/components/payroll/GeneratePayslipsDialog';
import { usePayrollRun } from '@/hooks/payroll/usePayrollRun';
import { usePayrollRuns } from '@/hooks/payroll/usePayrollRuns';
import { usePayrollCalculation } from '@/hooks/payroll/usePayrollCalculation';
import { usePayrollSettings, useAllowanceTypes, useDeductionTypes, useSocsoTable } from '@/hooks/payroll/usePayrollSettings';
import { PAYROLL_STATUS_LABELS } from '@/types/payroll';
import type { PayrollRunStatus } from '@/types/payroll';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { PayrollItem } from '@/types/payroll';

function statusVariant(status: PayrollRunStatus): string {
  if (status === 'finalized') return 'default';
  if (status === 'posted') return 'secondary';
  if (status === 'cancelled') return 'destructive';
  return 'outline';
}

export default function PayrollRunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { run, items, isLoading, refetch } = usePayrollRun(runId);
  const { settings } = usePayrollSettings();
  const { data: allowanceTypes } = useAllowanceTypes();
  const { data: deductionTypes = [] } = useDeductionTypes();
  const { data: socsoTable } = useSocsoTable();
  const {
    calculatePayroll, isCalculating,
    updatePayrollItem, isUpdatingItem,
    recalculateSingleEmployee, isRecalculatingSingle,
    addEmployeeToRun, isAddingEmployee,
  } = usePayrollCalculation();
  const { finalizePayrollRun, isFinalizing, cancelPayrollRun, isCancelling } = usePayrollRuns();

  const [editItem, setEditItem] = useState<PayrollItem | null>(null);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showRecalcConfirm, setShowRecalcConfirm] = useState(false);
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showPayslipDialog, setShowPayslipDialog] = useState(false);

  const handleCalculate = async () => {
    if (!run || !settings || !socsoTable) return;
    await calculatePayroll({
      payrollRunId: run.id,
      companyId: run.company_id,
      month: run.pay_period_month,
      year: run.pay_period_year,
      settings,
      socsoTable,
    });
    refetch();
  };

  const handleCalculateClick = () => {
    if (items.length > 0) {
      setShowRecalcConfirm(true);
    } else {
      handleCalculate();
    }
  };

  const handleRecalculateSingle = async (employeeId: string) => {
    if (!run || !settings || !socsoTable) return;
    await recalculateSingleEmployee({
      payrollRunId: run.id,
      employeeId,
      month: run.pay_period_month,
      year: run.pay_period_year,
      settings,
      socsoTable,
    });
    refetch();
  };

  const handleAddEmployee = async (employeeId: string) => {
    if (!run || !settings || !socsoTable) return;
    await addEmployeeToRun({
      payrollRunId: run.id,
      employeeId,
      month: run.pay_period_month,
      year: run.pay_period_year,
      settings,
      socsoTable,
    });
    setShowAddEmployee(false);
    refetch();
  };

  const handleFinalize = async () => {
    if (!run) return;
    await finalizePayrollRun(run.id);
    setShowFinalizeConfirm(false);
    refetch();
  };

  const handleCancel = async () => {
    if (!run) return;
    await cancelPayrollRun(run.id);
    setShowCancelConfirm(false);
    refetch();
  };

  if (isLoading) {
    return (
      <AppLayout>
        <PageLayout title="Payroll Run" description="Loading...">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-96 w-full mt-4" />
        </PageLayout>
      </AppLayout>
    );
  }

  if (!run) {
    return (
      <AppLayout>
        <PageLayout title="Payroll Run" description="Not found">
          <p className="text-muted-foreground">Payroll run not found.</p>
          <Button variant="outline" onClick={() => navigate('/hr/payroll')} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Payroll
          </Button>
        </PageLayout>
      </AppLayout>
    );
  }

  const isDraft = run.status === 'draft';
  const isPosted = run.status === 'posted';
  const hasMemo = !!run.memo_id;
  const hasItems = items.length > 0;
  const missingSettings = !settings || !socsoTable;

  const handleExportCSV = () => {
    if (!hasItems) return;

    // Column order matches Tidal's payroll Excel template
    const headers = [
      { key: 'no', label: 'No' },
      { key: 'staff_id', label: 'Staff Id' },
      { key: 'name', label: 'Name' },
      { key: 'basic_salary', label: 'Basic Salary' },
      { key: 'ot_amount', label: 'OT' },
      { key: 'allowance', label: 'Allowance' },
      { key: 'claims', label: 'Claims' },
      { key: 'gross_salary', label: 'Gross Salary' },
      // Employee deductions
      { key: 'ee_epf', label: 'EPF' },
      { key: 'ee_socso', label: 'SOCSO' },
      { key: 'ee_eis', label: 'EIS' },
      { key: 'zakat', label: 'Zakat' },
      { key: 'pcb', label: 'PCB' },
      { key: 'cp38', label: 'CP38' },
      { key: 'club_membership', label: 'Club Membership' },
      { key: 'staff_loan', label: 'Loan' },
      { key: 'total_ee_deduction', label: 'Total Employee Deduction' },
      // Net pay
      { key: 'net_pay', label: 'Net Pay' },
      // Employer contributions
      { key: 'er_epf', label: 'EPF (ER)' },
      { key: 'er_socso', label: 'SOCSO (ER)' },
      { key: 'er_eis', label: 'EIS (ER)' },
      { key: 'er_hrdc', label: 'HRDF' },
      { key: 'total_er_contribution', label: 'Total Employer Contribution' },
      // Total statutory (employer + employee combined)
      { key: 'total_epf', label: 'Total EPF' },
      { key: 'total_socso', label: 'Total SOCSO' },
      { key: 'total_eis', label: 'Total EIS' },
      { key: 'total_hrdc', label: 'Total HRDF' },
    ];

    const fmt = (v: number | string | null | undefined) => Number(v || 0).toFixed(2);

    // Helper to get deduction amount by code
    const getDeduction = (item: any, code: string): number => {
      const ded = (item.payroll_item_deductions || []).find(
        (d: any) => d.deduction_type?.code === code
      );
      return Number(ded?.amount || 0);
    };

    const data = items.map((item, idx) => {
      const eeEpf = Number(item.employee_epf || 0);
      const eeSocso = Number(item.employee_socso || 0);
      const eeEis = Number(item.employee_eis || 0);
      const erEpf = Number(item.employer_epf || 0);
      const erSocso = Number(item.employer_socso || 0);
      const erEis = Number(item.employer_eis || 0);
      const erHrdc = Number(item.employer_hrdc || 0);
      const zakat = Number(item.zakat_amount || 0);
      const pcb = Number(item.pcb_amount || 0);
      const cp38 = getDeduction(item, 'cp38');
      const club = getDeduction(item, 'sports_club');
      const loan = getDeduction(item, 'staff_loan') + getDeduction(item, 'rental');
      const totalErContribution = erEpf + erSocso + erEis + erHrdc;

      return {
        no: idx + 1,
        staff_id: item.profiles?.employee_id || '',
        name: item.profiles?.full_name || item.employee_id,
        basic_salary: fmt(item.basic_salary),
        ot_amount: fmt(item.ot_amount),
        allowance: fmt(item.total_allowances),
        claims: fmt(item.claims_amount),
        gross_salary: fmt(item.gross_salary),
        ee_epf: fmt(eeEpf),
        ee_socso: fmt(eeSocso),
        ee_eis: fmt(eeEis),
        zakat: fmt(zakat),
        pcb: fmt(pcb),
        cp38: fmt(cp38),
        club_membership: fmt(club),
        staff_loan: fmt(loan),
        total_ee_deduction: fmt(item.total_deductions),
        net_pay: fmt(item.net_salary),
        er_epf: fmt(erEpf),
        er_socso: fmt(erSocso),
        er_eis: fmt(erEis),
        er_hrdc: fmt(erHrdc),
        total_er_contribution: fmt(totalErContribution),
        total_epf: fmt(eeEpf + erEpf),
        total_socso: fmt(eeSocso + erSocso),
        total_eis: fmt(eeEis + erEis),
        total_hrdc: fmt(erHrdc),
      };
    });

    const companyName = run.companies?.name || 'Payroll';
    const filename = `${companyName}_Payroll_${run.pay_period_month}_${run.pay_period_year}`;
    exportToCSV(data, filename, headers, {
      reportName: `Payroll - ${companyName}`,
      period: `${run.pay_period_month}/${run.pay_period_year}`,
      generatedDate: new Date().toLocaleDateString(),
    });
  };

  const handleExportSocso = () => {
    if (!hasItems || !run) return;
    const companyName = run.companies?.name || 'Company';
    const txt = generateSocsoEisTxt({
      employerSocsoNo: run.companies?.socso_employer_no || '',
      companyRegNo: run.companies?.registration_no || '',
      month: run.pay_period_month,
      year: run.pay_period_year,
      items,
    });
    downloadTxtFile(txt, `${companyName}_SOCSO_EIS_${run.pay_period_month}_${run.pay_period_year}.txt`);
  };

  const handleExportEpf = () => {
    if (!hasItems || !run) return;
    const companyName = run.companies?.name || 'Company';
    const txt = generateEpfTxt({
      employerEpfNo: run.companies?.epf_employer_no || '',
      companyName,
      companyRegNo: run.companies?.registration_no || '',
      month: run.pay_period_month,
      year: run.pay_period_year,
      items,
    });
    downloadTxtFile(txt, `${companyName}_EPF_${run.pay_period_month}_${run.pay_period_year}.txt`);
  };

  return (
    <AppLayout>
      <PageLayout
        title={`Payroll Run ${run.run_number}`}
        description={`${run.companies?.name || ''} — ${run.pay_period_month}/${run.pay_period_year}`}
      >
        {/* Header row: back + status on left, actions on right */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => navigate('/hr/payroll')}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <Badge variant={statusVariant(run.status) as any}>
                {PAYROLL_STATUS_LABELS[run.status] || run.status}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              {/* Export dropdown — only when items exist */}
              {hasItems && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleExportCSV}>
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportSocso}>
                      <FileText className="h-4 w-4 mr-2" />
                      SOCSO/EIS TXT
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportEpf}>
                      <FileText className="h-4 w-4 mr-2" />
                      EPF TXT
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Draft actions: Add Employee + Calculate */}
              {isDraft && !hasMemo && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setShowAddEmployee(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Employee
                  </Button>
                  <Button size="sm" onClick={handleCalculateClick} disabled={isCalculating || missingSettings}>
                    <Calculator className="h-4 w-4 mr-2" />
                    {isCalculating ? 'Calculating...' : hasItems ? 'Recalculate All' : 'Calculate Payroll'}
                  </Button>
                </>
              )}

              {/* Draft finalize/cancel — only after items calculated */}
              {isDraft && hasItems && !hasMemo && (
                <>
                  <Button size="sm" onClick={() => setShowFinalizeConfirm(true)} disabled={isFinalizing}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {isFinalizing ? 'Finalizing...' : 'Finalize'}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setShowCancelConfirm(true)} disabled={isCancelling}>
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel Run
                  </Button>
                </>
              )}

              {/* Generate Payslips — available when items exist */}
              {hasItems && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPayslipDialog(true)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Payslips
                </Button>
              )}

              {/* Send to employees — only when posted */}
              {isPosted && (
                <Button
                  size="sm"
                  onClick={() => {
                    toast({ title: 'Payslips Sent', description: `Payslips sent to ${items.length} employee(s)` });
                  }}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send to Employees
                </Button>
              )}
            </div>
          </div>

          {/* Contextual alerts — full-width below header */}
          {isDraft && !hasMemo && missingSettings && (
            <Alert variant="destructive">
              <Info className="h-4 w-4" />
              <AlertDescription>
                {!settings && !socsoTable
                  ? 'Payroll settings and SOCSO table are not configured. Please set them up in Payroll Settings before calculating.'
                  : !settings
                  ? 'Payroll settings are not configured. Please set them up in Payroll Settings before calculating.'
                  : 'SOCSO contribution table is missing. Please contact your administrator.'}
              </AlertDescription>
            </Alert>
          )}

          {hasMemo && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                This run is part of a consolidated memo. Approval is managed on the Consolidated tab.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <PayrollMemoView run={run} />

        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Employee Breakdown</CardTitle>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-muted-foreground hover:text-foreground transition-colors">
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[420px] p-0" align="start">
                  <div className="px-4 py-3 border-b">
                    <p className="font-semibold text-sm">Statutory Contribution Rates</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Rates differ based on employee age category</p>
                  </div>
                  <div className="p-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-muted-foreground">
                          <th className="text-left pb-2 font-medium">Contribution</th>
                          <th className="text-right pb-2 font-medium">Below 60</th>
                          <th className="text-right pb-2 font-medium">60 &amp; Above</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        <tr>
                          <td className="py-1.5 font-medium">EPF (Employee)</td>
                          <td className="py-1.5 text-right">11%</td>
                          <td className="py-1.5 text-right text-amber-600 dark:text-amber-400 font-medium">0% (voluntary)</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 font-medium">EPF (Employer)</td>
                          <td className="py-1.5 text-right">13% / 12%</td>
                          <td className="py-1.5 text-right text-amber-600 dark:text-amber-400 font-medium">4%</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 font-medium">SOCSO</td>
                          <td className="py-1.5 text-right">Per table</td>
                          <td className="py-1.5 text-right text-amber-600 dark:text-amber-400 font-medium">Employment Injury only</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 font-medium">EIS</td>
                          <td className="py-1.5 text-right">0.2%</td>
                          <td className="py-1.5 text-right text-amber-600 dark:text-amber-400 font-medium">Not applicable</td>
                        </tr>
                      </tbody>
                    </table>
                    <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
                      Employer EPF: 13% for wages ≤ RM5,000, 12% for wages &gt; RM5,000.
                      Employees aged 60+ are exempt from SOCSO Invalidity and EIS contributions per Malaysian law.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
          <CardContent>
            <PayrollItemsTable
              items={items}
              isLoading={isLoading}
              onEdit={(item) => setEditItem(item)}
              onRecalculate={handleRecalculateSingle}
              isRecalculating={isRecalculatingSingle}
              readOnly={!isDraft || hasMemo}
              search={employeeSearch}
              onSearchChange={isDraft && !hasMemo ? setEmployeeSearch : undefined}
            />
          </CardContent>
        </Card>

        <EmployeePayrollForm
          item={editItem}
          open={!!editItem}
          onOpenChange={(open) => { if (!open) setEditItem(null); }}
          onSave={async (input) => {
            await updatePayrollItem(input);
            refetch();
          }}
          isSaving={isUpdatingItem}
          allowanceTypes={allowanceTypes || []}
          deductionTypes={deductionTypes}
          readOnly={!isDraft || hasMemo}
        />

        {run && (
          <AddEmployeeDialog
            open={showAddEmployee}
            onOpenChange={setShowAddEmployee}
            onAdd={handleAddEmployee}
            isAdding={isAddingEmployee}
            companyId={run.company_id}
            existingEmployeeIds={items.map((i) => i.employee_id)}
          />
        )}

        <GeneratePayslipsDialog
          open={showPayslipDialog}
          onOpenChange={setShowPayslipDialog}
          items={items}
          run={run}
        />

        <AlertDialog open={showRecalcConfirm} onOpenChange={setShowRecalcConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Recalculate All Employees?</AlertDialogTitle>
              <AlertDialogDescription>
                This will recalculate payroll for all employees and overwrite any manual changes. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { handleCalculate(); setShowRecalcConfirm(false); }}>
                Recalculate All
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showFinalizeConfirm} onOpenChange={setShowFinalizeConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Finalize Payroll Run?</AlertDialogTitle>
              <AlertDialogDescription>
                This will mark the payroll run as finalized. It can then be included in a consolidated memo for approval. You won't be able to edit calculations after finalizing.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleFinalize}>
                Finalize
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Payroll Run?</AlertDialogTitle>
              <AlertDialogDescription>
                This will cancel the payroll run. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Go Back</AlertDialogCancel>
              <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Cancel Run
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageLayout>
    </AppLayout>
  );
}
