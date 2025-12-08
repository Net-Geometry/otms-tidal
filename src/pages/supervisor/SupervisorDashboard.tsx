import { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { MonthYearFilter } from '@/components/MonthYearFilter';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Clock, ClipboardList, CheckSquare, ClipboardCheck } from 'lucide-react';
import { SupervisorDashboardCard } from '@/components/supervisor/SupervisorDashboardCard';
import { SupervisorOTTrendChart } from '@/components/supervisor/SupervisorOTTrendChart';
import { OTVerificationBreakdownChart } from '@/components/supervisor/OTVerificationBreakdownChart';
import { SupervisorQuickActions } from '@/components/supervisor/SupervisorQuickActions';
import { FooterNote } from '@/components/supervisor/FooterNote';

export default function SupervisorDashboard() {
  const { user } = useAuth();
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>((currentDate.getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState<string>(currentDate.getFullYear().toString());
  const [stats, setStats] = useState({
    teamOTHours: 0,
    pendingVerifications: 0,
    pendingConfirmations: 0,
    verifiedRequests: 0,
    teamMembersCount: 0,
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
    if (!user) return;

    const monthStart = startOfMonth(filterDate);
    const monthEnd = endOfMonth(filterDate);

    // Fetch team members count
    const { count: teamCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('supervisor_id', user.id)
      .eq('status', 'active');

    // Fetch OT requests for team
    const { data: otRequests } = await supabase
      .from('ot_requests')
      .select('total_hours, status')
      .eq('supervisor_id', user.id)
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', monthEnd.toISOString());

    const hasData = otRequests && otRequests.length > 0;
    const teamOTHours = otRequests?.reduce((sum, req) => sum + (req.total_hours || 0), 0) || 0;
    const pendingVerifications = otRequests?.filter(req => req.status === 'pending_verification' || req.status === 'pending_supervisor_verification').length || 0;
    const verifiedRequests = otRequests?.filter(req => req.status === 'supervisor_verified' || req.status === 'hr_certified' || req.status === 'bod_approved').length || 0;

    setStats({
      teamOTHours,
      pendingVerifications,
      verifiedRequests,
      teamMembersCount: teamCount || 0,
      hasData,
    });
    setLoading(false);
  };

  return (
    <AppLayout>
      <PageLayout
        title="Supervisor Dashboard"
        description={fullName ? `Welcome back, ${fullName}! Here's your team's OT performance overview.` : "Welcome back! Here's your team's OT performance overview."}
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

        {/* KPI Cards Grid */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          {loading ? (
            <>
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </>
          ) : stats.hasData ? (
            <>
              <SupervisorDashboardCard
                title="Team Members"
                value={stats.teamMembersCount}
                subtitle="Active employees under your team"
                icon={Users}
                variant="blue"
              />
              <SupervisorDashboardCard
                title="Pending Verifications"
                value={stats.pendingVerifications}
                subtitle="Awaiting your review"
                icon={ClipboardList}
                variant="purple"
              />
              <SupervisorDashboardCard
                title="Pending Confirmations"
                value={stats.pendingConfirmations}
                subtitle="Awaiting your confirmation"
                icon={ClipboardCheck}
                variant="yellow"
              />
              <SupervisorDashboardCard
                title="Verified Requests"
                value={stats.verifiedRequests}
                subtitle={format(filterDate, 'MMMM yyyy')}
                icon={CheckSquare}
                variant="green"
              />
              <SupervisorDashboardCard
                title="Total Team OT Hours"
                value={stats.teamOTHours.toFixed(1)}
                subtitle={format(filterDate, 'MMMM yyyy')}
                icon={Clock}
                variant="yellow"
              />
            </>
          ) : (
            <>
              <div className="opacity-50 pointer-events-none">
                <SupervisorDashboardCard
                  title="Team Members"
                  value="-"
                  subtitle={`No OT data available for ${format(filterDate, 'MMMM yyyy')}`}
                  icon={Users}
                  variant="blue"
                />
              </div>
              <div className="opacity-50 pointer-events-none">
                <SupervisorDashboardCard
                  title="Pending Verifications"
                  value="-"
                  subtitle={`No OT data available for ${format(filterDate, 'MMMM yyyy')}`}
                  icon={ClipboardList}
                  variant="purple"
                />
              </div>
              <div className="opacity-50 pointer-events-none">
                <SupervisorDashboardCard
                  title="Pending Confirmations"
                  value="-"
                  subtitle={`No OT data available for ${format(filterDate, 'MMMM yyyy')}`}
                  icon={ClipboardCheck}
                  variant="yellow"
                />
              </div>
              <div className="opacity-50 pointer-events-none">
                <SupervisorDashboardCard
                  title="Verified Requests"
                  value="-"
                  subtitle={`No OT data available for ${format(filterDate, 'MMMM yyyy')}`}
                  icon={CheckSquare}
                  variant="green"
                />
              </div>
              <div className="opacity-50 pointer-events-none">
                <SupervisorDashboardCard
                  title="Total Team OT Hours"
                  value="-"
                  subtitle={`No OT data available for ${format(filterDate, 'MMMM yyyy')}`}
                  icon={Clock}
                  variant="yellow"
                />
              </div>
            </>
          )}
        </div>

        {/* Overview Charts Section */}
        <div>
          <h2 className="text-xl font-semibold mb-2">Overview Charts</h2>
          <p className="text-muted-foreground text-sm mb-4">
            Visualize your team's overtime activities and verification trends.
          </p>
          <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
            <SupervisorOTTrendChart filterDate={filterDate} />
            <OTVerificationBreakdownChart filterDate={filterDate} />
          </div>
        </div>

        {/* Quick Actions Section */}
        <SupervisorQuickActions />

        {/* Footer Note */}
        <FooterNote />
      </PageLayout>
    </AppLayout>
  );
}
