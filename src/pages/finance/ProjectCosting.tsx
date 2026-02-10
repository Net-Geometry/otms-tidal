import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageLayout } from '@/components/ui/page-layout';

export default function ProjectCosting() {
  return (
    <AppLayout>
      <PageLayout title="Project Costing" description="Cost-to-date and monthly breakdowns by project (scaffold).">
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cost-to-Date by Project</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56 rounded-md border border-dashed flex items-center justify-center text-sm text-muted-foreground">
                Dashboard placeholder (coming soon)
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monthly Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56 rounded-md border border-dashed flex items-center justify-center text-sm text-muted-foreground">
                Dashboard placeholder (coming soon)
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            This page will be expanded with project selection, allocations, posting rules, and drill-down reports.
          </CardContent>
        </Card>
      </PageLayout>
    </AppLayout>
  );
}
