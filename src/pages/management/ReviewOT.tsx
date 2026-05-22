import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { MonthlyOTReport } from '@/components/reports/MonthlyOTReport';

export default function ReviewOT() {
  return (
    <AppLayout>
      <PageLayout
        title="Management Report"
        description="Filter and export monthly overtime summaries by department and employee."
      >
        <MonthlyOTReport />
      </PageLayout>
    </AppLayout>
  );
}
