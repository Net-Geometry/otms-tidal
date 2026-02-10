import { AppLayout } from '@/components/AppLayout';
import { DashboardCard } from '@/components/DashboardCard';
import { Card, CardContent } from '@/components/ui/card';
import { PageLayout } from '@/components/ui/page-layout';
import { CheckCircle, DollarSign, Receipt } from 'lucide-react';

export default function Claims() {
  return (
    <AppLayout>
      <PageLayout
        title="Claims Management"
        description="Claims intake, review, and approvals (scaffold)."
      >
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardCard title="Pending Claims" value="-" subtitle="Coming soon" icon={Receipt} />
          <DashboardCard title="Approved Claims" value="-" subtitle="Coming soon" icon={CheckCircle} />
          <DashboardCard title="Total Claims Amount" value="-" subtitle="Coming soon" icon={DollarSign} />
        </div>

        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            This module is scaffolded for navigation and routing. Implementation will be added in a future phase.
          </CardContent>
        </Card>
      </PageLayout>
    </AppLayout>
  );
}
