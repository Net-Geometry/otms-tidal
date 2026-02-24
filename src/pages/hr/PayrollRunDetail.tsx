import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Calculator, UserPlus } from 'lucide-react';
import { PayrollMemoView } from '@/components/payroll/PayrollMemoView';
import { PayrollItemsTable } from '@/components/payroll/PayrollItemsTable';
import { EmployeePayrollForm } from '@/components/payroll/EmployeePayrollForm';
import { AddEmployeeDialog } from '@/components/payroll/AddEmployeeDialog';
import { PayrollApprovalActions } from '@/components/payroll/PayrollApprovalActions';
import { usePayrollRun } from '@/hooks/payroll/usePayrollRun';
import { usePayrollCalculation } from '@/hooks/payroll/usePayrollCalculation';
import { usePayrollApproval } from '@/hooks/payroll/usePayrollApproval';
import { usePayrollSettings, useAllowanceTypes, useSocsoTable } from '@/hooks/payroll/usePayrollSettings';
import { useActiveRole } from '@/hooks/useActiveRole';
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
  const { data: socsoTable } = useSocsoTable();
  const {
    calculatePayroll, isCalculating,
    updatePayrollItem, isUpdatingItem,
    recalculateSingleEmployee, isRecalculatingSingle,
    addEmployeeToRun, isAddingEmployee,
  } = usePayrollCalculation();

  const approvalRole: PayrollApprovalRole =
    activeRole === 'management' ? 'management' :
    activeRole === 'finance' ? 'finance' : 'hr';

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
            {isDraft && (
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

            <PayrollApprovalActions
              run={run}
              role={approvalRole}
              onApprove={approval.approvePayrollRun}
              onReject={approval.rejectPayrollRun}
              isApproving={approval.isApproving}
              isRejecting={approval.isRejecting}
            />
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
              readOnly={!isDraft}
              search={employeeSearch}
              onSearchChange={isDraft ? setEmployeeSearch : undefined}
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
          readOnly={!isDraft}
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
