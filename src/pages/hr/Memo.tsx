import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { ConsolidatedPayrollMemo } from '@/components/payroll/ConsolidatedPayrollMemo';

export default function Memo() {
  return (
    <AppLayout>
      <PageLayout
        title="Generate Memo"
        description="Consolidated payroll memo with approval workflow."
      >
        <ConsolidatedPayrollMemo />
      </PageLayout>
    </AppLayout>
  );
}
