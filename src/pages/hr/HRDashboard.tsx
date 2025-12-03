import { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { EnhancedDashboardCard } from '@/components/hr/EnhancedDashboardCard';
import { OTTrendChart } from '@/components/hr/charts/OTTrendChart';
import { DepartmentOTChart } from '@/components/hr/charts/DepartmentOTChart';
import { MonthYearFilter } from '@/components/MonthYearFilter';
import { QuickActions } from '@/components/hr/QuickActions';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, Users, FileText, Clock } from 'lucide-react';

export default function HRDashboard() {
  const { user } = useAuth();
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>((currentDate.getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState<string>(currentDate.getFullYear().toString());
  const [stats, setStats] = useState({
    totalEmployees: 0,
    pendingApprovals: 0,
    approvedThisMonth: 0,
    totalOTHours: 0,
    hasData: false,
  });
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');

  const filterDate = useMemo(() => {
    return new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1);
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (user) {
      fetchStats();
      fetchProfile();
    }
  }, [user, filterDate]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    if (data) setFullName(data.full_name);
  };

  const fetchStats = async () => {
    const monthStart = startOfMonth(filterDate);
    const monthEnd = endOfMonth(filterDate);

    // Fetch employee count
    const { count: employeeCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Fetch OT requests
    const { data: otRequests } = await supabase
      .from('ot_requests')
      .select('total_hours, status')
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', monthEnd.toISOString());

    const pendingApprovals = otRequests?.filter(req =>
      req.status === 'pending_verification' || req.status === 'supervisor_verified'
    ).length || 0;

    const approvedThisMonth = otRequests?.filter(req =>
      req.status === 'hr_certified' || req.status === 'bod_approved'
    ).length || 0;

    const totalOTHours = otRequests?.reduce((sum, req) => sum + (req.total_hours || 0), 0) || 0;
    const hasData = otRequests && otRequests.length > 0;

    setStats({
      totalEmployees: employeeCount || 0,
      pendingApprovals,
      approvedThisMonth,
      totalOTHours,
      hasData,
    });
    setLoading(false);
  };

  return (
    <AppLayout>
      <PageLayout
        title="HR Dashboard"
        description={fullName ? `Welcome back, ${fullName}! Here's your organization overview.` : "Welcome back! Here's your organization overview."}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Filter by Month</h3>
          <MonthYearFilter
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onMonthChange={setSelectedMonth}
            onYearChange={setSelectedYear}
          />
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            <>
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </>
          ) : stats.hasData ? (
            <>
              <EnhancedDashboardCard
                title="Total Employees"
                value={stats.totalEmployees}
                subtitle="Active employees"
                icon={Users}
                variant="info"
              />
              <EnhancedDashboardCard
                title="Pending Approvals"
                value={stats.pendingApprovals}
                subtitle="Awaiting action"
                icon={CheckCircle}
                variant="warning"
              />
              <EnhancedDashboardCard
                title="Approved Requests"
                value={stats.approvedThisMonth}
                subtitle={format(filterDate, 'MMMM yyyy')}
                icon={FileText}
                variant="success"
              />
              <EnhancedDashboardCard
                title="Total OT Hours"
                value={stats.totalOTHours.toFixed(1)}
                subtitle={format(filterDate, 'MMMM yyyy')}
                icon={Clock}
                variant="primary"
              />
            </>
          ) : (
            <>
              <div className="opacity-50 pointer-events-none">
                <EnhancedDashboardCard
                  title="Total Employees"
                  value="-"
                  subtitle={`No OT data available for ${format(filterDate, 'MMMM yyyy')}`}
                  icon={Users}
                  variant="info"
                />
              </div>
              <div className="opacity-50 pointer-events-none">
                <EnhancedDashboardCard
                  title="Pending Approvals"
                  value="-"
                  subtitle={`No OT data available for ${format(filterDate, 'MMMM yyyy')}`}
                  icon={CheckCircle}
                  variant="warning"
                />
              </div>
              <div className="opacity-50 pointer-events-none">
                <EnhancedDashboardCard
                  title="Approved Requests"
                  value="-"
                  subtitle={`No OT data available for ${format(filterDate, 'MMMM yyyy')}`}
                  icon={FileText}
                  variant="success"
                />
              </div>
              <div className="opacity-50 pointer-events-none">
                <EnhancedDashboardCard
                  title="Total OT Hours"
                  value="-"
                  subtitle={`No OT data available for ${format(filterDate, 'MMMM yyyy')}`}
                  icon={Clock}
                  variant="primary"
                />
              </div>
            </>
          )}
        </div>

        <div>
          <h2 className="text-lg md:text-xl font-semibold mb-4">Overview Charts</h2>
          <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
            <OTTrendChart filterDate={filterDate} />
            <DepartmentOTChart filterDate={filterDate} />
          </div>
        </div>

        <QuickActions />
      </PageLayout>
    </AppLayout>
  );
}
