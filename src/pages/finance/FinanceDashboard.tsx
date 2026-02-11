import { NavLink } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { DashboardCard } from '@/components/DashboardCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageLayout } from '@/components/ui/page-layout';
import { BarChart3, BookOpen, FileText, Receipt, Wallet, Landmark, PieChart } from 'lucide-react';
import { formatCurrency } from '@/lib/otCalculations';
import { FinanceExpenseTrendChart } from '@/components/finance/FinanceExpenseTrendChart';
import { FinanceProjectCostChart } from '@/components/finance/FinanceProjectCostChart';
import { FinancePendingActions } from '@/components/finance/FinancePendingActions';
import { useFinanceDashboard } from '@/hooks/finance/useFinanceDashboard';

const QUICK_ACTIONS = [
  { to: '/finance/chart-of-accounts', label: 'Chart of Accounts', icon: BookOpen },
  { to: '/finance/claims', label: 'Claims Posting', icon: Receipt },
  { to: '/finance/petty-cash', label: 'Petty Cash', icon: Wallet },
  { to: '/finance/project-costing', label: 'Project Costing', icon: BarChart3 },
  { to: '/finance/reports', label: 'Reports', icon: FileText },
];

export default function FinanceDashboard() {
  const dashboard = useFinanceDashboard();

  return (
    <AppLayout>
      <PageLayout title="Finance Dashboard" description="Financial overview, pending approvals, and month-by-month expense trends.">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardCard
            title="Total Posted Payroll"
            value={formatCurrency(Number(dashboard.data?.stats.totalPostedPayroll || 0))}
            subtitle="All posted payroll runs"
            icon={Landmark}
          />
          <DashboardCard
            title="Total Posted Claims"
            value={formatCurrency(Number(dashboard.data?.stats.totalPostedClaims || 0))}
            subtitle="All posted claim reimbursements"
            icon={Receipt}
          />
          <DashboardCard
            title="Petty Cash Balance"
            value={formatCurrency(Number(dashboard.data?.stats.pettyCashBalance || 0))}
            subtitle="Approved top-ups minus expenditures"
            icon={Wallet}
          />
          <DashboardCard
            title="Budget Utilization"
            value={`${Number(dashboard.data?.stats.budgetUtilizationPct || 0).toFixed(1)}%`}
            subtitle="Project cost against budget"
            icon={PieChart}
          />
        </div>

        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <FinanceExpenseTrendChart data={dashboard.data?.charts.expenseTrend || []} />
          <FinanceProjectCostChart data={dashboard.data?.charts.topProjectsByCost || []} />
        </div>

        <FinancePendingActions
          pendingPayrollCount={dashboard.data?.pendingActions.pendingPayrollCount || 0}
          pendingClaimsCount={dashboard.data?.pendingActions.pendingClaimsCount || 0}
        />

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
