import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Calculator, Download, Info, UserPlus } from 'lucide-react';
import { exportToCSV } from '@/lib/exportUtils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PayrollMemoView } from '@/components/payroll/PayrollMemoView';
import { PayrollItemsTable } from '@/components/payroll/PayrollItemsTable';
import { EmployeePayrollForm } from '@/components/payroll/EmployeePayrollForm';
import { AddEmployeeDialog } from '@/components/payroll/AddEmployeeDialog';
import { PayrollApprovalActions } from '@/components/payroll/PayrollApprovalActions';
import { usePayrollRun } from '@/hooks/payroll/usePayrollRun';
import { usePayrollCalculation } from '@/hooks/payroll/usePayrollCalculation';
import { usePayrollApproval } from '@/hooks/payroll/usePayrollApproval';
import { usePayrollSettings, useAllowanceTypes, useDeductionTypes, useSocsoTable } from '@/hooks/payroll/usePayrollSettings';
import { useActiveRole } from '@/hooks/useActiveRole';
import { isFinanceRole } from '@/lib/financeRoles';
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
import type { PayrollItem, PayrollApprovalRole } from '@/types/payroll';

export default function PayrollRunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const { activeRole } = useActiveRole();

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

  const approvalRole: PayrollApprovalRole =
    activeRole === 'management' ? 'management' :
    isFinanceRole(activeRole) ? 'finance' : 'hr';

  const approval = usePayrollApproval({ role: approvalRole });

  const [editItem, setEditItem] = useState<PayrollItem | null>(null);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showRecalcConfirm, setShowRecalcConfirm] = useState(false);

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
  const hasMemo = !!(run as any).memo_id;

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

  return (
    <AppLayout>
      <PageLayout
        title={`Payroll Run ${run.run_number}`}
        description={`${run.companies?.name || ''} — ${run.pay_period_month}/${run.pay_period_year}`}
      >
        <div className="flex items-center justify-between mb-4">
          <Button variant="outline" size="sm" onClick={() => navigate('/hr/payroll')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>

          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
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
              </>
            )}

            {hasMemo ? (
              <Alert className="flex-1">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  This run is part of a consolidated memo. Approval is managed on the Consolidated tab.
                </AlertDescription>
              </Alert>
            ) : (
              <PayrollApprovalActions
                run={run}
                role={approvalRole}
                onApprove={approval.approvePayrollRun}
                onReject={approval.rejectPayrollRun}
                isApproving={approval.isApproving}
                isRejecting={approval.isRejecting}
              />
            )}
          </div>
        </div>

        <PayrollMemoView run={run} />

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Employee Breakdown</CardTitle>
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
      </PageLayout>
    </AppLayout>
  );
}
