import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calculator, Download, FileText, Info, UserPlus, CheckCircle, XCircle, HelpCircle, Send } from 'lucide-react';
import { exportToCSV, downloadTxtFile } from '@/lib/exportUtils';
import { generateSocsoEisTxt, generateEpfTxt } from '@/lib/statutoryTxtGenerator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PayrollMemoView } from '@/components/payroll/PayrollMemoView';
import { PayrollItemsTable } from '@/components/payroll/PayrollItemsTable';
import { EmployeePayrollForm } from '@/components/payroll/EmployeePayrollForm';
import { AddEmployeeDialog } from '@/components/payroll/AddEmployeeDialog';
import { usePayrollRun } from '@/hooks/payroll/usePayrollRun';
import { usePayrollRuns } from '@/hooks/payroll/usePayrollRuns';
import { usePayrollCalculation } from '@/hooks/payroll/usePayrollCalculation';
import { usePayrollSettings, useAllowanceTypes, useDeductionTypes, useSocsoTable } from '@/hooks/payroll/usePayrollSettings';
import { PAYROLL_STATUS_LABELS } from '@/types/payroll';
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
  const hasMemo = !!run.memo_id;

  const handleExportCSV = () => {
    if (!items.length) return;
    const headers = [
      { key: 'net_salary', label: 'Net Salary' },
      { key: 'employee_name', label: 'Employee' },
      { key: 'employee_id_code', label: 'Employee ID' },
      { key: 'department', label: 'Department' },
      { key: 'basic_salary', label: 'Basic Salary' },
      { key: 'gross_salary', label: 'Gross Salary' },
      { key: 'employee_epf', label: 'EPF (EE)' },
      { key: 'employer_epf', label: 'EPF (ER)' },
      { key: 'employee_socso', label: 'SOCSO (EE)' },
      { key: 'employer_socso', label: 'SOCSO (ER)' },
      { key: 'employee_eis', label: 'EIS (EE)' },
      { key: 'employer_eis', label: 'EIS (ER)' },
      { key: 'pcb_amount', label: 'PCB' },
      { key: 'total_deductions', label: 'Total Deductions' },
      { key: 'total_allowances', label: 'Total Allowances' },
    ];
    const data = items.map((item) => ({
      net_salary: Number(item.net_salary || 0).toFixed(2),
      employee_name: item.profiles?.full_name || item.employee_id,
      employee_id_code: item.profiles?.employee_id || '',
      department: item.profiles?.departments?.name || '',
      basic_salary: Number(item.basic_salary || 0).toFixed(2),
      gross_salary: Number(item.gross_salary || 0).toFixed(2),
      employee_epf: Number(item.employee_epf || 0).toFixed(2),
      employer_epf: Number(item.employer_epf || 0).toFixed(2),
      employee_socso: Number(item.employee_socso || 0).toFixed(2),
      employer_socso: Number(item.employer_socso || 0).toFixed(2),
      employee_eis: Number(item.employee_eis || 0).toFixed(2),
      employer_eis: Number(item.employer_eis || 0).toFixed(2),
      pcb_amount: Number(item.pcb_amount || 0).toFixed(2),
      total_deductions: Number(item.total_deductions || 0).toFixed(2),
      total_allowances: Number(item.total_allowances || 0).toFixed(2),
    }));
    const companyName = run.companies?.name || 'Payroll';
    const filename = `${companyName}_Payroll_${run.pay_period_month}_${run.pay_period_year}`;
    exportToCSV(data, filename, headers, {
      reportName: `Payroll - ${companyName}`,
      period: `${run.pay_period_month}/${run.pay_period_year}`,
      generatedDate: new Date().toLocaleDateString(),
    });
  };

  const handleExportSocso = () => {
    if (!items.length || !run) return;
    const companyName = run.companies?.name || 'Company';
    const txt = generateSocsoEisTxt({
      employerSocsoNo: run.companies?.socso_employer_no || '',
      month: run.pay_period_month,
      year: run.pay_period_year,
      items,
    });
    downloadTxtFile(txt, `${companyName}_SOCSO_EIS_${run.pay_period_month}_${run.pay_period_year}.txt`);
  };

  const handleExportEpf = () => {
    if (!items.length || !run) return;
    const companyName = run.companies?.name || 'Company';
    const txt = generateEpfTxt({
      employerEpfNo: run.companies?.epf_employer_no || '',
      companyName,
      month: run.pay_period_month,
      year: run.pay_period_year,
      items,
    });
    downloadTxtFile(txt, `${companyName}_EPF_${run.pay_period_month}_${run.pay_period_year}.txt`);
  };

  const statusVariant = run.status === 'finalized' ? 'default' : run.status === 'cancelled' ? 'destructive' : 'outline';

  return (
    <AppLayout>
      <PageLayout
        title={`Payroll Run ${run.run_number}`}
        description={`${run.companies?.name || ''} — ${run.pay_period_month}/${run.pay_period_year}`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate('/hr/payroll')}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Badge variant={statusVariant as any}>
              {PAYROLL_STATUS_LABELS[run.status] || run.status}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={handleExportCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportSocso}>
                  <FileText className="h-4 w-4 mr-2" />
                  SOCSO/EIS TXT
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportEpf}>
                  <FileText className="h-4 w-4 mr-2" />
                  EPF TXT
                </Button>
              </>
            )}
            {isDraft && !hasMemo && (
              <>
                <Button variant="outline" onClick={() => setShowAddEmployee(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Employee
                </Button>
                <Button onClick={handleCalculateClick} disabled={isCalculating || !settings || !socsoTable}>
                  <Calculator className="h-4 w-4 mr-2" />
                  {isCalculating ? 'Calculating...' : items.length > 0 ? 'Recalculate All' : 'Calculate Payroll'}
                </Button>
                {(!settings || !socsoTable) && (
                  <Alert variant="destructive" className="flex-1">
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
              </>
            )}

            {isDraft && items.length > 0 && !hasMemo && (
              <>
                <Button onClick={() => setShowFinalizeConfirm(true)} disabled={isFinalizing}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {isFinalizing ? 'Finalizing...' : 'Finalize'}
                </Button>
                <Button variant="destructive" onClick={() => setShowCancelConfirm(true)} disabled={isCancelling}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel Run
                </Button>
              </>
            )}

            {run.status === 'finalized' && (
              <Button
                variant="outline"
                onClick={() => {
                  toast({ title: 'Payslips Sent', description: `Payslips sent to ${items.length} employee(s)` });
                }}
              >
                <Send className="h-4 w-4 mr-2" />
                Send to Employees
              </Button>
            )}

            {hasMemo && (
              <Alert className="flex-1">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  This run is part of a consolidated memo. Approval is managed on the Consolidated tab.
                </AlertDescription>
              </Alert>
            )}
          </div>
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
