import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { MonthlyOTReport } from '@/components/reports/MonthlyOTReport';

export default function OTReports() {
  return (
    <AppLayout>
      <PageLayout
        title="OT Reports"
        description="Filter and export monthly overtime summaries by department and employee."
      >
        <MonthlyOTReport />
      </PageLayout>
    </AppLayout>
  );
}
