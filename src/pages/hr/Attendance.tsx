import { AppLayout } from '@/components/AppLayout';
import { DashboardCard } from '@/components/DashboardCard';
import { Card, CardContent } from '@/components/ui/card';
import { PageLayout } from '@/components/ui/page-layout';
import { Clock, UserCheck, UserX } from 'lucide-react';

export default function Attendance() {
  return (
    <AppLayout>
      <PageLayout
        title="Attendance Management"
        description="Attendance tracking and daily summaries (scaffold)."
      >
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardCard title="Present Today" value="-" subtitle="Coming soon" icon={UserCheck} />
          <DashboardCard title="Late Today" value="-" subtitle="Coming soon" icon={Clock} />
          <DashboardCard title="Absent Today" value="-" subtitle="Coming soon" icon={UserX} />
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
