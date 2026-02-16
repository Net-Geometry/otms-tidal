import { NavLink } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { DashboardCard } from '@/components/DashboardCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageLayout } from '@/components/ui/page-layout';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, BarChart3, BookOpen, Building2, CheckCircle, ChevronDown, CreditCard, FileText, Landmark, Receipt, Users, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/otCalculations';
import { FinanceExpenseTrendChart } from '@/components/finance/FinanceExpenseTrendChart';
import { FinanceProjectCostChart } from '@/components/finance/FinanceProjectCostChart';
import { FinancePendingActions } from '@/components/finance/FinancePendingActions';
import { useFinanceDashboard } from '@/hooks/finance/useFinanceDashboard';

// Top 6: High-frequency daily actions
const TOP_ACTIONS = [
  { to: '/finance/workflow/inbox', label: 'Approval Inbox', icon: CheckCircle, color: 'text-emerald-500' },
  { to: '/finance/gl/journal-entries', label: 'Journal Entries', icon: BookOpen, color: 'text-blue-500' },
  { to: '/finance/ap/invoices', label: 'AP Invoices', icon: FileText, color: 'text-amber-500' },
  { to: '/finance/ap/payment-vouchers', label: 'Payment Vouchers', icon: CreditCard, color: 'text-purple-500' },
  { to: '/finance/ar/invoices', label: 'AR Invoices', icon: Receipt, color: 'text-cyan-500' },
  { to: '/finance/petty-cash', label: 'Petty Cash', icon: Wallet, color: 'text-rose-500' },
] as const;

// More actions: Organized by category
const MORE_ACTIONS = {
  'Accounts': [
    { to: '/finance/masters/suppliers', label: 'Suppliers', icon: Users },
    { to: '/finance/masters/customers', label: 'Customers', icon: Users },
    { to: '/finance/masters/bank-accounts', label: 'Bank Accounts', icon: Landmark },
  ],
  'Transactions': [
    { to: '/finance/ap/prf', label: 'Purchase Requests', icon: FileText },
    { to: '/finance/ar/official-receipts', label: 'Official Receipts', icon: CreditCard },
    { to: '/finance/claims', label: 'Claims Posting', icon: Receipt },
  ],
  'Project & Reports': [
    { to: '/finance/project-costing', label: 'Project Costing', icon: BarChart3 },
    { to: '/finance/reports', label: 'Reports', icon: FileText },
  ],
  'Setup': [
    { to: '/finance/setup/company-profile', label: 'Company Profile', icon: Building2 },
    { to: '/finance/setup/coa', label: 'Chart of Accounts', icon: BookOpen },
    { to: '/finance/setup/doa-matrix', label: 'DOA Matrix', icon: CheckCircle },
  ],
} as const;

export default function FinanceDashboard() {
  const dashboard = useFinanceDashboard();

  return (
    <AppLayout>
      <PageLayout title="Finance Dashboard" description="Financial overview, pending approvals, and month-by-month expense trends.">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardCard
            title="AP Outstanding"
            value={formatCurrency(Number(dashboard.data?.stats.apOutstanding || 0))}
            subtitle="Unpaid supplier invoices"
            icon={FileText}
          />
          <DashboardCard
            title="AR Outstanding"
            value={formatCurrency(Number(dashboard.data?.stats.arOutstanding || 0))}
            subtitle="Unpaid customer invoices"
            icon={Receipt}
          />
          <DashboardCard
            title="Cash Position"
            value={formatCurrency(Number(dashboard.data?.stats.cashPosition || 0))}
            subtitle="Total bank balances"
            icon={Landmark}
          />
          <DashboardCard
            title="Overdue Invoices"
            value={String(dashboard.data?.stats.overdueCount || 0)}
            subtitle="Past due date"
            icon={AlertTriangle}
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

        {/* Top Actions - Clean Grid */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Top 6 Actions */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {TOP_ACTIONS.map((action) => (
                <NavLink
                  key={action.to}
                  to={action.to}
                  className="group flex flex-col items-center gap-3 p-4 rounded-xl border bg-card hover:bg-accent/5 hover:border-accent/50 transition-all duration-200"
                >
                  <div className={`p-3 rounded-lg bg-background ${action.color} ring-1 ring-border group-hover:ring-accent/30 group-hover:scale-105 transition-all`}>
                    <action.icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium text-center leading-tight">{action.label}</span>
                </NavLink>
              ))}
            </div>

            {/* More Actions - Collapsible */}
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground hover:text-foreground">
                  <span className="text-sm">More Actions</span>
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {Object.entries(MORE_ACTIONS).map(([category, actions]) => (
                    <div key={category} className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                        {category}
                      </h4>
                      <div className="space-y-1">
                        {actions.map((action) => (
                          <NavLink
                            key={action.to}
                            to={action.to}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/5 transition-colors"
                          >
                            <action.icon className="h-4 w-4 shrink-0" />
                            <span>{action.label}</span>
                          </NavLink>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      </PageLayout>
    </AppLayout>
  );
}
