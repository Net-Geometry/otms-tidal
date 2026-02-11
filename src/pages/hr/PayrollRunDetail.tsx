import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Calculator } from 'lucide-react';
import { PayrollMemoView } from '@/components/payroll/PayrollMemoView';
import { PayrollItemsTable } from '@/components/payroll/PayrollItemsTable';
import { PayrollItemEditSheet } from '@/components/payroll/PayrollItemEditSheet';
import { PayrollApprovalActions } from '@/components/payroll/PayrollApprovalActions';
import { usePayrollRun } from '@/hooks/payroll/usePayrollRun';
import { usePayrollCalculation } from '@/hooks/payroll/usePayrollCalculation';
import { usePayrollApproval } from '@/hooks/payroll/usePayrollApproval';
import { usePayrollSettings, useAllowanceTypes, useSocsoTable } from '@/hooks/payroll/usePayrollSettings';
import { useActiveRole } from '@/hooks/useActiveRole';
import type { PayrollItem, PayrollApprovalRole } from '@/types/payroll';

export default function PayrollRunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const { activeRole } = useActiveRole();

  const { run, items, isLoading, refetch } = usePayrollRun(runId);
  const { settings } = usePayrollSettings();
  const { data: allowanceTypes } = useAllowanceTypes();
  const { data: socsoTable } = useSocsoTable();
  const { calculatePayroll, isCalculating, updatePayrollItem, isUpdatingItem } = usePayrollCalculation();

  const approvalRole: PayrollApprovalRole =
    activeRole === 'management' ? 'management' :
    activeRole === 'finance' ? 'finance' : 'hr';

  const approval = usePayrollApproval({ role: approvalRole });

  const [editItem, setEditItem] = useState<PayrollItem | null>(null);

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
              <Button
                onClick={handleCalculate}
                disabled={isCalculating || !settings || !socsoTable}
              >
                <Calculator className="h-4 w-4 mr-2" />
                {isCalculating ? 'Calculating...' : 'Calculate Payroll'}
              </Button>
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
              readOnly={!isDraft}
            />
          </CardContent>
        </Card>

        <PayrollItemEditSheet
          item={editItem}
          open={!!editItem}
          onOpenChange={(open) => { if (!open) setEditItem(null); }}
          onSave={async (input) => {
            await updatePayrollItem(input);
            refetch();
          }}
          isSaving={isUpdatingItem}
          allowanceTypes={allowanceTypes || []}
          deductionTypes={[]}
        />
      </PageLayout>
    </AppLayout>
  );
}
