import { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { DashboardCard } from '@/components/DashboardCard';
import { MonthYearFilter } from '@/components/MonthYearFilter';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Settings, Users, Clock, DollarSign, FileText, Shield } from 'lucide-react';
import { formatCurrency } from '@/lib/otCalculations';

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>((currentDate.getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState<string>(currentDate.getFullYear().toString());
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalOTHours: 0,
    totalExpenditure: 0,
    systemHealth: 100,
    activeEmployees: 0,
    pendingRequests: 0,
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

    // Fetch total users
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Fetch active employees
    const { count: activeEmployees } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Fetch OT requests
    const { data: otRequests } = await supabase
      .from('ot_requests')
      .select('total_hours, ot_amount, status')
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', monthEnd.toISOString());

    const totalOTHours = otRequests?.reduce((sum, req) => sum + (req.total_hours || 0), 0) || 0;
    const totalExpenditure = otRequests?.reduce((sum, req) => sum + (req.ot_amount || 0), 0) || 0;
    const pendingRequests = otRequests?.filter(req =>
      req.status === 'pending_verification' || req.status === 'supervisor_verified'
    ).length || 0;
    const hasData = otRequests && otRequests.length > 0;

    setStats({
      totalUsers: totalUsers || 0,
      totalOTHours,
      totalExpenditure,
      systemHealth: 100,
      activeEmployees: activeEmployees || 0,
      pendingRequests,
      hasData,
    });
    setLoading(false);
  };

  return (
    <AppLayout>
      <PageLayout
        title="Admin Dashboard"
        description={fullName ? `Welcome back, ${fullName}! Complete system overview and administration.` : 'Welcome back! Complete system overview and administration.'}
        actions={
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate('/hr/settings')} className="gap-2">
              <Settings className="h-4 w-4" />
              Manage Settings
            </Button>
            <Button onClick={() => navigate('/hr/employees')} variant="outline" className="gap-2">
              <Users className="h-4 w-4" />
              Manage Users
            </Button>
            <Button onClick={() => navigate('/hr/ot-reports')} variant="outline" className="gap-2">
              <FileText className="h-4 w-4" />
              View All Data
            </Button>
          </div>
        }
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

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            <>
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </>
          ) : stats.hasData ? (
            <>
              <DashboardCard
                title="Total Users"
                value={stats.totalUsers}
                subtitle={`${stats.activeEmployees} active`}
                icon={Users}
              />
              <DashboardCard
                title="Pending Requests"
                value={stats.pendingRequests}
                subtitle="Awaiting action"
                icon={FileText}
              />
              <DashboardCard
                title="Total OT Hours"
                value={stats.totalOTHours.toFixed(1)}
                subtitle={format(filterDate, 'MMMM yyyy')}
                icon={Clock}
              />
              <DashboardCard
                title="Total Expenditure"
                value={formatCurrency(stats.totalExpenditure)}
                subtitle={format(filterDate, 'MMMM yyyy')}
                icon={DollarSign}
              />
              <DashboardCard
                title="System Health"
                value={`${stats.systemHealth}%`}
                subtitle="All systems operational"
                icon={Shield}
              />
            </>
          ) : (
            <>
              <div className="opacity-50 pointer-events-none">
                <DashboardCard
                  title="Total Users"
                  value="-"
                  subtitle={`No OT data available for ${format(filterDate, 'MMMM yyyy')}`}
                  icon={Users}
                />
              </div>
              <div className="opacity-50 pointer-events-none">
                <DashboardCard
                  title="Pending Requests"
                  value="-"
                  subtitle={`No OT data available for ${format(filterDate, 'MMMM yyyy')}`}
                  icon={FileText}
                />
              </div>
              <div className="opacity-50 pointer-events-none">
                <DashboardCard
                  title="Total OT Hours"
                  value="-"
                  subtitle={`No OT data available for ${format(filterDate, 'MMMM yyyy')}`}
                  icon={Clock}
                />
              </div>
              <div className="opacity-50 pointer-events-none">
                <DashboardCard
                  title="Total Expenditure"
                  value="-"
                  subtitle={`No OT data available for ${format(filterDate, 'MMMM yyyy')}`}
                  icon={DollarSign}
                />
              </div>
              <div className="opacity-50 pointer-events-none">
                <DashboardCard
                  title="System Health"
                  value="-"
                  subtitle={`No OT data available for ${format(filterDate, 'MMMM yyyy')}`}
                  icon={Shield}
                />
              </div>
            </>
          )}
        </div>
      </PageLayout>
    </AppLayout>
  );
}
