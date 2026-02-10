import { NavLink } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { DashboardCard } from '@/components/DashboardCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageLayout } from '@/components/ui/page-layout';
import { BarChart3, BookOpen, FileText, Receipt, Wallet } from 'lucide-react';

const QUICK_ACTIONS = [
  { to: '/finance/chart-of-accounts', label: 'Chart of Accounts', icon: BookOpen },
  { to: '/finance/claims', label: 'Claims Posting', icon: Receipt },
  { to: '/finance/petty-cash', label: 'Petty Cash', icon: Wallet },
  { to: '/finance/project-costing', label: 'Project Costing', icon: BarChart3 },
  { to: '/finance/reports', label: 'Reports', icon: FileText },
];

export default function FinanceDashboard() {
  return (
    <AppLayout>
      <PageLayout title="Finance Dashboard" description="Financial overview and postings (scaffold).">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardCard title="Total Revenue" value="-" subtitle="Coming soon" icon={BarChart3} />
          <DashboardCard title="Total Expenses" value="-" subtitle="Coming soon" icon={BarChart3} />
          <DashboardCard title="Project Costs" value="-" subtitle="Coming soon" icon={BarChart3} />
          <DashboardCard title="Pending Claims" value="-" subtitle="Coming soon" icon={Receipt} />
        </div>

        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Revenue vs Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56 rounded-md border border-dashed flex items-center justify-center text-sm text-muted-foreground">
                Chart placeholder (coming soon)
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Project Cost Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56 rounded-md border border-dashed flex items-center justify-center text-sm text-muted-foreground">
                Chart placeholder (coming soon)
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action) => (
              <Button key={action.to} variant="outline" asChild>
                <NavLink to={action.to} className="gap-2">
                  <action.icon className="h-4 w-4" />
                  {action.label}
                </NavLink>
              </Button>
            ))}
          </CardContent>
        </Card>
      </PageLayout>
    </AppLayout>
  );
}
