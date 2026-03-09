import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { ConsolidatedPayrollMemo } from '@/components/payroll/ConsolidatedPayrollMemo';

export default function ApprovePayroll() {
  return (
    <AppLayout>
      <PageLayout
        title="Approve Payroll"
        description="Review and approve consolidated payroll memos."
      >
        <ConsolidatedPayrollMemo />
      </PageLayout>
    </AppLayout>
  );
}
