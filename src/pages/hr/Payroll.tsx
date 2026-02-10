import { AppLayout } from '@/components/AppLayout';
import { DashboardCard } from '@/components/DashboardCard';
import { Card, CardContent } from '@/components/ui/card';
import { PageLayout } from '@/components/ui/page-layout';
import { FileText, Shield, Wallet } from 'lucide-react';

export default function Payroll() {
  return (
    <AppLayout>
      <PageLayout
        title="Payroll Management"
        description="Payroll runs, payslips, and statutory deductions (scaffold)."
      >
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardCard title="Total Payroll" value="-" subtitle="Coming soon" icon={Wallet} />
          <DashboardCard title="Pending Payslips" value="-" subtitle="Coming soon" icon={FileText} />
          <DashboardCard title="EPF Summary" value="-" subtitle="Coming soon" icon={Shield} />
          <DashboardCard title="SOCSO Summary" value="-" subtitle="Coming soon" icon={Shield} />
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
