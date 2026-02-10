import { AppLayout } from '@/components/AppLayout';
import { DashboardCard } from '@/components/DashboardCard';
import { Card, CardContent } from '@/components/ui/card';
import { PageLayout } from '@/components/ui/page-layout';
import { CalendarOff, CheckCircle, ClipboardList } from 'lucide-react';

export default function Leave() {
  return (
    <AppLayout>
      <PageLayout
        title="Leave Management"
        description="Leave requests, balances, and approvals (scaffold)."
      >
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardCard title="Pending Leave Requests" value="-" subtitle="Coming soon" icon={ClipboardList} />
          <DashboardCard title="Approved This Month" value="-" subtitle="Coming soon" icon={CheckCircle} />
          <DashboardCard title="Total Leave Balance" value="-" subtitle="Coming soon" icon={CalendarOff} />
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
